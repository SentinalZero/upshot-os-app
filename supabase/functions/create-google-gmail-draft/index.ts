import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { decryptToken, encryptToken } from "../_shared/crypto.ts";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { getSupabaseAdmin } from "../_shared/supabase-admin.ts";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TOKEN_REFRESH_BUFFER_MS = 2 * 60 * 1000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function respond(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function secretsMatch(received: string, expected: string): boolean {
  const encoder = new TextEncoder();
  const left = encoder.encode(received);
  const right = encoder.encode(expected);
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}

function normalizeRecipients(value: unknown): string[] {
  const values = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [];
  return [...new Set(values.map((item) => String(item).trim().toLowerCase()).filter((item) => EMAIL_PATTERN.test(item)))];
}

function recipientsFromInput(inputPayload: unknown, sourceEmail: string | null): string[] {
  if (!isJsonObject(inputPayload) || !Array.isArray(inputPayload.attendees)) return [];
  return [...new Set(inputPayload.attendees
    .filter(isJsonObject)
    .filter((attendee) => attendee.is_self !== true && attendee.response_status !== "declined")
    .map((attendee) => typeof attendee.email === "string" ? attendee.email.trim().toLowerCase() : "")
    .filter((email) => EMAIL_PATTERN.test(email) && email !== String(sourceEmail || "").toLowerCase()))];
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

async function refreshGoogleAccessToken(admin: ReturnType<typeof getSupabaseAdmin>, integration: Record<string, any>, secrets: Record<string, any>) {
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
  if (!response.ok) {
    await admin.from("integrations").update({
      status: "error",
      last_error: `Google token refresh failed (${response.status}). Reconnect Google Workspace.`,
      updated_at: new Date().toISOString(),
    }).eq("id", integration.id).eq("organization_id", integration.organization_id);
    throw new Error("Google authorization expired. Reconnect Google Workspace.");
  }

  const payload = await response.json();
  const accessToken = typeof payload.access_token === "string" ? payload.access_token : "";
  if (!accessToken) throw new Error("Google did not return a refreshed access token.");
  const expiresAt = new Date(Date.now() + Number(payload.expires_in || 3600) * 1000).toISOString();
  const now = new Date().toISOString();
  await admin.from("integration_secrets").update({
    encrypted_access_token: await encryptToken(accessToken),
    token_type: payload.token_type || secrets.token_type || "Bearer",
    expires_at: expiresAt,
    updated_at: now,
  }).eq("integration_id", integration.id).eq("organization_id", integration.organization_id);
  await admin.from("integrations").update({ status: "connected", expires_at: expiresAt, last_verified_at: now, last_error: null, updated_at: now })
    .eq("id", integration.id).eq("organization_id", integration.organization_id);
  return accessToken;
}

async function getAccessToken(admin: ReturnType<typeof getSupabaseAdmin>, integration: Record<string, any>, secrets: Record<string, any>, forceRefresh = false) {
  const expiresAtMs = secrets.expires_at ? Date.parse(secrets.expires_at) : Number.NaN;
  const valid = Number.isFinite(expiresAtMs) && expiresAtMs - Date.now() > TOKEN_REFRESH_BUFFER_MS;
  if (!forceRefresh && secrets.encrypted_access_token && (valid || !Number.isFinite(expiresAtMs))) {
    return decryptToken(secrets.encrypted_access_token);
  }
  return refreshGoogleAccessToken(admin, integration, secrets);
}

async function createDraft(accessToken: string, raw: string): Promise<Response> {
  return fetch("https://gmail.googleapis.com/gmail/v1/users/me/drafts", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ message: { raw } }),
  });
}

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  if (req.method !== "POST") return respond({ error: "Method not allowed" }, 405);

  try {
    const expectedSecret = Deno.env.get("N8N_WORKFLOW_TRIGGER_SECRET");
    const receivedSecret = req.headers.get("X-Upshot-Workflow-Secret") || "";
    if (!expectedSecret || !receivedSecret || !secretsMatch(receivedSecret, expectedSecret)) {
      return respond({ error: "Unauthorized workflow request" }, 401);
    }

    const body = await req.json().catch(() => ({}));
    if (!isJsonObject(body)) return respond({ error: "Request body must be a JSON object" }, 400);
    const executionId = typeof body.execution_id === "string" ? body.execution_id : "";
    const organizationId = typeof body.organization_id === "string" ? body.organization_id : "";
    const subject = typeof body.subject === "string" ? body.subject.trim().slice(0, 998) : "";
    const messageBody = typeof body.body === "string" ? body.body.trim() : "";
    if (!UUID_PATTERN.test(executionId) || !UUID_PATTERN.test(organizationId)) return respond({ error: "Valid execution_id and organization_id are required" }, 400);
    if (!subject || !messageBody) return respond({ error: "subject and body are required" }, 400);
    if (messageBody.length > 100_000) return respond({ error: "Email body is too large" }, 413);

    const admin = getSupabaseAdmin();
    const { data: execution } = await admin.from("workflow_executions")
      .select("id, organization_id, specialist_id, source_integration_id, input_payload, trigger_metadata, status")
      .eq("id", executionId).eq("organization_id", organizationId).single();
    if (!execution) return respond({ error: "Workflow execution was not found" }, 404);

    const existingMetadata = isJsonObject(execution.trigger_metadata) ? execution.trigger_metadata : {};
    if (typeof existingMetadata.gmail_draft_id === "string") {
      return respond({
        execution_id: executionId,
        organization_id: organizationId,
        draft_id: existingMetadata.gmail_draft_id,
        message_id: existingMetadata.gmail_message_id || null,
        recipients: existingMetadata.gmail_draft_recipients || [],
        duplicate: true,
      });
    }

    if (!execution.source_integration_id) return respond({ error: "Execution has no source Google integration" }, 409);
    const { data: integration } = await admin.from("integrations")
      .select("id, organization_id, digital_specialist_id, provider_key, status, external_account_email")
      .eq("id", execution.source_integration_id).eq("organization_id", organizationId).single();
    if (!integration || integration.provider_key !== "google_workspace") return respond({ error: "Source Google integration was not found" }, 404);
    if (String(integration.status || "").toLowerCase() !== "connected") return respond({ error: "Google Workspace integration is not connected" }, 409);

    const { data: secrets } = await admin.from("integration_secrets")
      .select("encrypted_access_token, encrypted_refresh_token, expires_at, token_type, granted_scopes")
      .eq("integration_id", integration.id).eq("organization_id", organizationId).single();
    if (!secrets) return respond({ error: "Google integration credentials are unavailable" }, 409);
    const scopes = Array.isArray(secrets.granted_scopes) ? secrets.granted_scopes.map(String) : [];
    if (!scopes.includes("https://www.googleapis.com/auth/gmail.compose")) {
      return respond({ error: "Google connection does not include Gmail draft permission. Reconnect Google Workspace." }, 409);
    }

    const suppliedRecipients = normalizeRecipients(body.to);
    const recipients = suppliedRecipients.length ? suppliedRecipients : recipientsFromInput(execution.input_payload, integration.external_account_email);
    if (!recipients.length) return respond({ error: "No external meeting attendee is available for the follow up draft" }, 422);

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
    let accessToken = await getAccessToken(admin, integration, secrets);
    let draftResponse = await createDraft(accessToken, raw);
    if (draftResponse.status === 401) {
      accessToken = await getAccessToken(admin, integration, secrets, true);
      draftResponse = await createDraft(accessToken, raw);
    }
    const responseText = await draftResponse.text();
    let draftPayload: Record<string, any> = {};
    try { draftPayload = responseText ? JSON.parse(responseText) : {}; } catch { draftPayload = {}; }
    if (!draftResponse.ok || typeof draftPayload.id !== "string") {
      return respond({ error: `Gmail draft creation failed (${draftResponse.status})`, details: responseText.slice(0, 500) }, 502);
    }

    const createdAt = new Date().toISOString();
    const updatedMetadata = {
      ...existingMetadata,
      gmail_draft_id: draftPayload.id,
      gmail_message_id: draftPayload.message?.id || null,
      gmail_thread_id: draftPayload.message?.threadId || null,
      gmail_draft_recipients: recipients,
      gmail_draft_subject: subject,
      gmail_draft_created_at: createdAt,
    };
    const { error: updateError } = await admin.from("workflow_executions").update({ trigger_metadata: updatedMetadata })
      .eq("id", executionId).eq("organization_id", organizationId);
    if (updateError) return respond({ error: `Draft was created but metadata could not be stored: ${updateError.message}` }, 500);

    await admin.from("activity_logs").insert({
      organization_id: organizationId,
      digital_specialist_id: execution.specialist_id,
      activity_type: "gmail_draft_created",
      title: "Follow up email drafted",
      description: `A Gmail draft was prepared for ${recipients.join(", ")}.`,
      severity: "success",
      metadata: { execution_id: executionId, draft_id: draftPayload.id, recipients, subject },
    });

    return respond({
      execution_id: executionId,
      organization_id: organizationId,
      draft_id: draftPayload.id,
      message_id: draftPayload.message?.id || null,
      thread_id: draftPayload.message?.threadId || null,
      recipients,
      subject,
      duplicate: false,
    }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("[create-google-gmail-draft]", message);
    return respond({ error: message }, 500);
  }
});
