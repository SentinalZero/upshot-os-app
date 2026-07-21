import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { decryptToken, encryptToken } from "../_shared/crypto.ts";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { getAuthenticatedUser, getSupabaseAdmin } from "../_shared/supabase-admin.ts";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TOKEN_REFRESH_BUFFER_MS = 2 * 60 * 1000;

function respond(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function objectValue(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function encodeBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

function sanitizeHeader(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

async function refreshAccessToken(admin: ReturnType<typeof getSupabaseAdmin>, integration: Record<string, any>, secrets: Record<string, any>) {
  if (!secrets.encrypted_refresh_token) throw new Error("Google refresh token is unavailable. Reconnect Google Workspace.");
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  if (!clientId || !clientSecret) throw new Error("Google OAuth client credentials are not configured.");

  const refreshToken = await decryptToken(secrets.encrypted_refresh_token);
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" }),
  });
  if (!response.ok) throw new Error("Google authorization expired. Reconnect Google Workspace.");
  const payload = await response.json();
  const accessToken = typeof payload.access_token === "string" ? payload.access_token : "";
  if (!accessToken) throw new Error("Google did not return an access token.");
  const expiresAt = new Date(Date.now() + Number(payload.expires_in || 3600) * 1000).toISOString();
  const now = new Date().toISOString();
  await admin.from("integration_secrets").update({ encrypted_access_token: await encryptToken(accessToken), expires_at: expiresAt, token_type: payload.token_type || secrets.token_type || "Bearer", updated_at: now })
    .eq("integration_id", integration.id).eq("organization_id", integration.organization_id);
  await admin.from("integrations").update({ status: "connected", expires_at: expiresAt, last_verified_at: now, last_error: null, updated_at: now })
    .eq("id", integration.id).eq("organization_id", integration.organization_id);
  return accessToken;
}

async function accessToken(admin: ReturnType<typeof getSupabaseAdmin>, integration: Record<string, any>, secrets: Record<string, any>, forceRefresh = false) {
  const expiresAt = secrets.expires_at ? Date.parse(secrets.expires_at) : Number.NaN;
  const valid = Number.isFinite(expiresAt) && expiresAt - Date.now() > TOKEN_REFRESH_BUFFER_MS;
  if (!forceRefresh && secrets.encrypted_access_token && (valid || !Number.isFinite(expiresAt))) return decryptToken(secrets.encrypted_access_token);
  return refreshAccessToken(admin, integration, secrets);
}

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  if (req.method !== "POST") return respond({ error: "Method not allowed" }, 405);

  try {
    const user = await getAuthenticatedUser(req);
    const body = objectValue(await req.json().catch(() => ({})));
    const organizationId = typeof body.organization_id === "string" ? body.organization_id : "";
    const executionId = typeof body.execution_id === "string" ? body.execution_id : "";
    const subject = typeof body.subject === "string" ? body.subject.trim().slice(0, 998) : "";
    const messageBody = typeof body.body === "string" ? body.body.trim() : "";
    if (!UUID_PATTERN.test(organizationId) || !UUID_PATTERN.test(executionId)) return respond({ error: "Valid organization_id and execution_id are required" }, 400);
    if (!subject || !messageBody) return respond({ error: "Subject and message are required" }, 400);
    if (messageBody.length > 100_000) return respond({ error: "Email body is too large" }, 413);

    const admin = getSupabaseAdmin();
    const { data: membership } = await admin.from("organization_members").select("id, role")
      .eq("organization_id", organizationId).eq("user_id", user.id).single();
    if (!membership) return respond({ error: "You do not belong to this organization" }, 403);

    const { data: execution, error: executionError } = await admin.from("workflow_executions")
      .select("id, organization_id, specialist_id, source_integration_id, trigger_metadata, output_summary")
      .eq("id", executionId).eq("organization_id", organizationId).single();
    if (executionError || !execution) return respond({ error: executionError?.message || "Workflow execution was not found" }, 404);

    const metadata = objectValue(execution.trigger_metadata);
    const draftId = typeof metadata.gmail_draft_id === "string" ? metadata.gmail_draft_id : "";
    const recipients = Array.isArray(metadata.gmail_draft_recipients) ? metadata.gmail_draft_recipients.map(String).filter(Boolean) : [];
    if (!draftId) return respond({ error: "This execution does not have a Gmail draft" }, 409);
    if (!recipients.length) return respond({ error: "Draft recipients were not recorded" }, 409);
    if (!execution.source_integration_id) return respond({ error: "Execution has no source Google integration" }, 409);

    const { data: integration } = await admin.from("integrations")
      .select("id, organization_id, provider_key, status")
      .eq("id", execution.source_integration_id).eq("organization_id", organizationId).single();
    if (!integration || integration.provider_key !== "google_workspace") return respond({ error: "Google Workspace integration was not found" }, 404);
    if (String(integration.status || "").toLowerCase() !== "connected") return respond({ error: "Google Workspace is not connected" }, 409);

    const { data: secrets } = await admin.from("integration_secrets")
      .select("encrypted_access_token, encrypted_refresh_token, expires_at, token_type, granted_scopes")
      .eq("integration_id", integration.id).eq("organization_id", organizationId).single();
    if (!secrets) return respond({ error: "Google integration credentials are unavailable" }, 409);
    const scopes = Array.isArray(secrets.granted_scopes) ? secrets.granted_scopes.map(String) : [];
    if (!scopes.includes("https://www.googleapis.com/auth/gmail.compose")) return respond({ error: "Google connection does not include Gmail draft permission. Reconnect Google Workspace." }, 409);

    const mime = [
      `To: ${recipients.map(sanitizeHeader).join(", ")}`,
      `Subject: ${sanitizeHeader(subject)}`,
      "MIME-Version: 1.0",
      "Content-Type: text/plain; charset=UTF-8",
      "Content-Transfer-Encoding: 8bit",
      "",
      messageBody,
    ].join("\r\n");
    const raw = encodeBase64Url(mime);

    let token = await accessToken(admin, integration, secrets);
    let gmailResponse = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/drafts/${encodeURIComponent(draftId)}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ id: draftId, message: { raw } }),
    });
    if (gmailResponse.status === 401) {
      token = await accessToken(admin, integration, secrets, true);
      gmailResponse = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/drafts/${encodeURIComponent(draftId)}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ id: draftId, message: { raw } }),
      });
    }
    const responseText = await gmailResponse.text();
    if (!gmailResponse.ok) return respond({ error: `Gmail draft update failed (${gmailResponse.status})`, details: responseText.slice(0, 500) }, 502);

    const now = new Date().toISOString();
    const output = objectValue(execution.output_summary);
    const existingFollowUp = objectValue(output.follow_up_email);
    const existingDraft = objectValue(output.gmail_draft);
    const updatedOutput = {
      ...output,
      follow_up_email: { ...existingFollowUp, subject, body: messageBody },
      gmail_draft: { ...existingDraft, subject, body: messageBody, recipients, draft_id: draftId },
    };
    const updatedMetadata = {
      ...metadata,
      gmail_draft_subject: subject,
      gmail_draft_body: messageBody,
      gmail_draft_edited_at: now,
      gmail_draft_edited_by_user_id: user.id,
      human_review: null,
    };
    const { error: updateError } = await admin.from("workflow_executions")
      .update({ trigger_metadata: updatedMetadata, output_summary: updatedOutput })
      .eq("id", executionId).eq("organization_id", organizationId);
    if (updateError) return respond({ error: `Draft updated in Gmail but Upshot could not save the revision: ${updateError.message}` }, 500);

    await admin.from("activity_logs").insert({
      organization_id: organizationId,
      digital_specialist_id: execution.specialist_id || null,
      activity_type: "gmail_draft_updated",
      title: "Follow up draft edited",
      description: "A team member edited the prepared Gmail draft. The draft requires review again.",
      severity: "warning",
      metadata: { execution_id: executionId, draft_id: draftId, edited_by_user_id: user.id },
    });

    return respond({ success: true, execution_id: executionId, draft_id: draftId, subject, body: messageBody, recipients, edited_at: now });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("[update-google-gmail-draft]", message);
    return respond({ error: message }, 500);
  }
});
