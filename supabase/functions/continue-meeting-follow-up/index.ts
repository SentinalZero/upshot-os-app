import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALGORITHM = "AES-GCM";
const IV_LENGTH = 12;
const TAG_LENGTH = 128;

function getSupabaseAdmin() {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRoleKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  }
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/\s/g, "");
  const bytes = new Uint8Array(clean.length / 2);
  for (let index = 0; index < bytes.length; index++) {
    bytes[index] = Number.parseInt(clean.substring(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function getEncryptionKey(): Promise<CryptoKey> {
  const keyHex = Deno.env.get("TOKEN_ENCRYPTION_KEY");
  if (!keyHex) throw new Error("TOKEN_ENCRYPTION_KEY is not configured");
  const keyBytes = hexToBytes(keyHex);
  if (keyBytes.length !== 32) {
    throw new Error("TOKEN_ENCRYPTION_KEY must be exactly 32 bytes (64 hex characters)");
  }
  return crypto.subtle.importKey("raw", keyBytes, { name: ALGORITHM }, false, ["encrypt", "decrypt"]);
}

async function encryptToken(plaintext: string): Promise<string> {
  const key = await getEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv, tagLength: TAG_LENGTH },
    key,
    encoded,
  );
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return bytesToBase64(combined);
}

async function decryptToken(encryptedBase64: string): Promise<string> {
  const key = await getEncryptionKey();
  const combined = base64ToBytes(encryptedBase64);
  if (combined.length < IV_LENGTH + 16) throw new Error("Encrypted value is invalid");
  const iv = combined.slice(0, IV_LENGTH);
  const ciphertext = combined.slice(IV_LENGTH);
  const decrypted = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv, tagLength: TAG_LENGTH },
    key,
    ciphertext,
  );
  return new TextDecoder().decode(decrypted);
}

interface ContinuationPayload {
  integration_id?: string;
  to?: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject?: string;
  body?: string;
  upshot?: {
    organization_id?: string;
    workflow_execution_id?: string;
    specialist_id?: string | null;
    command_decision_id?: string | null;
    authorized_by?: string;
    authorized_at?: string;
  };
}

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function normalizeRecipients(value: string | string[] | undefined): string[] {
  const values = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [];
  return values.map(item => item.trim()).filter(Boolean);
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function encodeHeader(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `=?UTF-8?B?${btoa(binary)}?=`;
}

function base64UrlEncode(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function buildRawMessage(payload: ContinuationPayload): string {
  const to = normalizeRecipients(payload.to);
  const cc = normalizeRecipients(payload.cc);
  const bcc = normalizeRecipients(payload.bcc);
  const headers = [
    `To: ${to.join(", ")}`,
    ...(cc.length ? [`Cc: ${cc.join(", ")}`] : []),
    ...(bcc.length ? [`Bcc: ${bcc.join(", ")}`] : []),
    `Subject: ${encodeHeader(payload.subject || "")}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
  ];
  return base64UrlEncode(`${headers.join("\r\n")}\r\n\r\n${payload.body || ""}`);
}

async function getAccessToken(
  integrationId: string,
  organizationId: string,
): Promise<{ accessToken: string; accountEmail: string | null }> {
  const admin = getSupabaseAdmin();
  const { data: integration, error: integrationError } = await admin
    .from("integrations")
    .select("id, status, provider_key, external_account_email")
    .eq("id", integrationId)
    .eq("organization_id", organizationId)
    .single();

  if (integrationError || !integration) throw new Error("Google Workspace integration was not found.");
  if (String(integration.provider_key || "").toLowerCase().replaceAll("-", "_") !== "google_workspace") {
    throw new Error("The selected integration is not Google Workspace.");
  }
  if (integration.status !== "connected") throw new Error("Google Workspace is not connected.");

  const { data: secrets, error: secretsError } = await admin
    .from("integration_secrets")
    .select("encrypted_access_token, encrypted_refresh_token, expires_at")
    .eq("integration_id", integrationId)
    .eq("organization_id", organizationId)
    .single();

  if (secretsError || !secrets?.encrypted_access_token) throw new Error("Google credentials are unavailable.");

  const expiresAt = secrets.expires_at ? new Date(secrets.expires_at).getTime() : 0;
  if (expiresAt > Date.now() + 60_000) {
    return {
      accessToken: await decryptToken(secrets.encrypted_access_token),
      accountEmail: integration.external_account_email || null,
    };
  }

  if (!secrets.encrypted_refresh_token) throw new Error("Google authorization expired. Reconnect Google Workspace.");

  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  if (!clientId || !clientSecret) throw new Error("Google OAuth secrets are incomplete.");

  const refreshToken = await decryptToken(secrets.encrypted_refresh_token);
  const refreshResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!refreshResponse.ok) {
    const detail = await refreshResponse.text();
    throw new Error(`Google token refresh failed: ${detail.slice(0, 200)}`);
  }

  const refreshed = await refreshResponse.json();
  if (!refreshed.access_token) throw new Error("Google did not return a refreshed access token.");

  const refreshedExpiresAt = new Date(Date.now() + Number(refreshed.expires_in || 3600) * 1000).toISOString();
  await admin
    .from("integration_secrets")
    .update({
      encrypted_access_token: await encryptToken(refreshed.access_token),
      expires_at: refreshedExpiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("integration_id", integrationId)
    .eq("organization_id", organizationId);

  await admin
    .from("integrations")
    .update({ expires_at: refreshedExpiresAt, last_verified_at: new Date().toISOString(), last_error: null })
    .eq("id", integrationId)
    .eq("organization_id", organizationId);

  return {
    accessToken: refreshed.access_token,
    accountEmail: integration.external_account_email || null,
  };
}

serve(async req => {
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const expectedSecret = Deno.env.get("WORKFLOW_CONTINUATION_SECRET");
  const suppliedSecret = req.headers.get("X-Upshot-Continuation-Secret");
  if (!expectedSecret || suppliedSecret !== expectedSecret) {
    return json({ error: "Continuation authorization failed." }, 401);
  }

  let payload: ContinuationPayload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "A valid JSON payload is required." }, 400);
  }

  const organizationId = payload.upshot?.organization_id;
  const executionId = payload.upshot?.workflow_execution_id;
  const integrationId = payload.integration_id;
  const to = normalizeRecipients(payload.to);
  const cc = normalizeRecipients(payload.cc);
  const bcc = normalizeRecipients(payload.bcc);

  if (!organizationId || !executionId || !integrationId) {
    return json({ error: "organization_id, workflow_execution_id, and integration_id are required." }, 400);
  }
  if (!to.length || [...to, ...cc, ...bcc].some(address => !isEmail(address))) {
    return json({ error: "At least one valid recipient email address is required." }, 400);
  }
  if (!payload.subject?.trim() || !payload.body?.trim()) {
    return json({ error: "subject and body are required." }, 400);
  }
  if (payload.subject.length > 998 || payload.body.length > 100_000) {
    return json({ error: "The approved follow-up exceeds the supported message size." }, 400);
  }

  const admin = getSupabaseAdmin();

  try {
    const { data: execution, error: executionError } = await admin
      .from("workflow_executions")
      .select("id, organization_id, status")
      .eq("id", executionId)
      .eq("organization_id", organizationId)
      .single();

    if (executionError || !execution) return json({ error: "Workflow execution was not found." }, 404);
    if (execution.status !== "running") return json({ error: "Workflow execution is not in the dispatching state." }, 409);

    const { accessToken, accountEmail } = await getAccessToken(integrationId, organizationId);
    const gmailResponse = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw: buildRawMessage(payload) }),
      signal: AbortSignal.timeout(20_000),
    });

    const gmailBody = await gmailResponse.json().catch(() => ({}));
    if (!gmailResponse.ok) {
      throw new Error(`Gmail send failed (${gmailResponse.status}): ${JSON.stringify(gmailBody).slice(0, 250)}`);
    }

    await admin.from("activity_logs").insert({
      organization_id: organizationId,
      digital_specialist_id: payload.upshot?.specialist_id || null,
      event_type: "meeting_follow_up_sent",
      activity_type: "customer_communication",
      title: "Approved meeting follow-up sent",
      description: `Sent the approved follow-up to ${to.join(", ")}.`,
      message: "Meeting follow-up sent through Google Workspace",
      severity: "success",
      metadata: {
        workflow_execution_id: executionId,
        command_decision_id: payload.upshot?.command_decision_id || null,
        integration_id: integrationId,
        sender: accountEmail,
        recipients: to,
        gmail_message_id: gmailBody.id || null,
        gmail_thread_id: gmailBody.threadId || null,
        requires_human_attention: false,
      },
    });

    return json({
      sent: true,
      provider: "google_workspace",
      message_id: gmailBody.id || null,
      thread_id: gmailBody.threadId || null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Meeting follow-up failed.";

    await admin.from("activity_logs").insert({
      organization_id: organizationId,
      digital_specialist_id: payload.upshot?.specialist_id || null,
      event_type: "meeting_follow_up_failed",
      activity_type: "customer_communication",
      title: "Approved meeting follow-up could not be sent",
      description: message,
      message: "Google Workspace follow-up failed",
      severity: "warning",
      metadata: {
        workflow_execution_id: executionId,
        command_decision_id: payload.upshot?.command_decision_id || null,
        integration_id: integrationId,
        requires_human_attention: true,
      },
    });

    return json({ sent: false, error: message }, 502);
  }
});
