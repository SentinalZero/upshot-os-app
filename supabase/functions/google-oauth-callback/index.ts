/**
 * google-oauth-callback
 *
 * Handles the OAuth 2.0 callback from Google after user consent.
 * This is the GOOGLE_REDIRECT_URI target.
 *
 * Flow:
 * 1. Receives ?code=...&state=... from Google
 * 2. Exchanges the authorization code for access + refresh tokens
 * 3. Encrypts both tokens using AES-GCM with TOKEN_ENCRYPTION_KEY
 * 4. Stores encrypted tokens in integration_secrets table
 * 5. Updates the integrations record to "connected" status
 * 6. Redirects the user back to the frontend Connections page
 *
 * Secrets required:
 *   - GOOGLE_CLIENT_ID
 *   - GOOGLE_CLIENT_SECRET (server-only, never sent to browser)
 *   - GOOGLE_REDIRECT_URI
 *   - TOKEN_ENCRYPTION_KEY (server-only, never sent to browser)
 *   - SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
  *   - APP_URL (e.g., https://demo.upshottheory.com)
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { encryptToken } from "../_shared/crypto.ts";
import { getSupabaseAdmin } from "../_shared/supabase-admin.ts";

serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    const appUrl = Deno.env.get("APP_URL");
    if (!appUrl) {
      console.error("[google-oauth-callback] APP_URL secret is not configured");
      return new Response("Server misconfiguration: APP_URL not set", { status: 500 });
    }
    const baseUrl = appUrl.replace(/\/+$/, "");
    const connectionsUrl = `${baseUrl}/app/connections`;

    // Handle error from Google (user denied, etc.)
    if (error) {
      return Response.redirect(
        `${connectionsUrl}?google=error&reason=${encodeURIComponent(error)}`,
        302
      );
    }

    if (!code || !state) {
      return Response.redirect(
        `${connectionsUrl}?google=error&reason=missing_code_or_state`,
        302
      );
    }

    // Decode state to get integration context
    let statePayload: {
      integration_id: string;
      organization_id: string;
      user_id: string;
      ts: number;
    };

    try {
      statePayload = JSON.parse(atob(state));
    } catch {
      return Response.redirect(
        `${connectionsUrl}?google=error&reason=invalid_state`,
        302
      );
    }

    const { integration_id, organization_id, user_id } = statePayload;

    // Verify state hasn't expired (10 minute window)
    if (Date.now() - statePayload.ts > 10 * 60 * 1000) {
      return Response.redirect(
        `${connectionsUrl}?google=error&reason=state_expired`,
        302
      );
    }

    // Verify the stored state matches
    const supabaseAdmin = getSupabaseAdmin();
    const { data: integration, error: fetchError } = await supabaseAdmin
      .from("integrations")
      .select("id, status, metadata")
      .eq("id", integration_id)
      .eq("organization_id", organization_id)
      .single();

    if (fetchError || !integration) {
      return Response.redirect(
        `${connectionsUrl}?google=error&reason=integration_not_found`,
        302
      );
    }

    if (integration.metadata?.oauth_state !== state) {
      return Response.redirect(
        `${connectionsUrl}?google=error&reason=state_mismatch`,
        302
      );
    }

    // Exchange authorization code for tokens
    const clientId = Deno.env.get("GOOGLE_CLIENT_ID")!;
    const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
    const redirectUri = Deno.env.get("GOOGLE_REDIRECT_URI")!;

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      const errBody = await tokenResponse.text();
      console.error("[google-oauth-callback] Token exchange failed:", errBody);
      return Response.redirect(
        `${connectionsUrl}?google=error&reason=token_exchange_failed`,
        302
      );
    }

    const tokens = await tokenResponse.json();
    const { access_token, refresh_token, scope, expires_in } = tokens;

    if (!access_token) {
      return Response.redirect(
        `${connectionsUrl}?google=error&reason=no_access_token`,
        302
      );
    }

    // Fetch user info from Google to store account details
    const userInfoResponse = await fetch(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      { headers: { Authorization: `Bearer ${access_token}` } }
    );

    let googleEmail = "";
    let googleName = "";
    if (userInfoResponse.ok) {
      const userInfo = await userInfoResponse.json();
      googleEmail = userInfo.email || "";
      googleName = userInfo.name || "";
    }

    // Encrypt tokens using AES-GCM (unique IV per operation)
    const encryptedAccessToken = await encryptToken(access_token);
    const encryptedRefreshToken = refresh_token
      ? await encryptToken(refresh_token)
      : null;

    // Store encrypted tokens in integration_secrets (server-side only)
    // Upsert: if a record exists for this integration, update it
    const { error: secretsError } = await supabaseAdmin
      .from("integration_secrets")
      .upsert(
        {
          integration_id,
          encrypted_access_token: encryptedAccessToken,
          encrypted_refresh_token: encryptedRefreshToken,
          token_expires_at: new Date(Date.now() + (expires_in || 3600) * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "integration_id" }
      );

    if (secretsError) {
      console.error("[google-oauth-callback] Failed to store secrets:", secretsError);
      return Response.redirect(
        `${connectionsUrl}?google=error&reason=secret_storage_failed`,
        302
      );
    }

    // Update the integration record to "connected"
    const grantedScopes = scope ? scope.split(" ") : [];
    const { error: updateError } = await supabaseAdmin
      .from("integrations")
      .update({
        status: "connected",
        external_account_email: googleEmail,
        external_account_name: googleName,
        connected_at: new Date().toISOString(),
        last_verified_at: new Date().toISOString(),
        granted_scopes: grantedScopes,
        metadata: {
          ...integration.metadata,
          oauth_state: null, // Clear the state
          token_expires_at: new Date(Date.now() + (expires_in || 3600) * 1000).toISOString(),
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", integration_id);

    if (updateError) {
      console.error("[google-oauth-callback] Failed to update integration:", updateError);
      return Response.redirect(
        `${connectionsUrl}?google=error&reason=update_failed`,
        302
      );
    }

    // Log activity
    await supabaseAdmin.from("activity_logs").insert({
      organization_id,
      user_id,
      activity_type: "integration_connected",
      title: "Google Workspace connected",
      description: `Connected as ${googleEmail || "unknown account"}`,
      severity: "success",
      metadata: { integration_id, provider: "google_workspace" },
    });

    // Redirect back to frontend with success
    return Response.redirect(
      `${connectionsUrl}?google=connected`,
      302
    );
  } catch (err) {
    console.error("[google-oauth-callback] Unexpected error:", err);
    const appUrl = Deno.env.get("APP_URL");
    const baseUrl = appUrl ? appUrl.replace(/\/+$/, "") : "";
    if (!baseUrl) {
      return new Response("Server misconfiguration: APP_URL not set", { status: 500 });
    }
    return Response.redirect(
      `${baseUrl}/app/connections?google=error&reason=unexpected_error`,
      302
    );
  }
});
