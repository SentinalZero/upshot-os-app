/**
 * google-oauth-callback
 *
 * Handles Google's OAuth callback, encrypts tokens server-side, stores them in
 * integration_secrets, and redirects back to the Upshot OS Connections page.
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

    if (error) {
      return Response.redirect(
        `${connectionsUrl}?google=error&reason=${encodeURIComponent(error)}`,
        302,
      );
    }

    if (!code || !state) {
      return Response.redirect(
        `${connectionsUrl}?google=error&reason=missing_code_or_state`,
        302,
      );
    }

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
        302,
      );
    }

    const { integration_id, organization_id, user_id } = statePayload;

    if (Date.now() - statePayload.ts > 10 * 60 * 1000) {
      return Response.redirect(
        `${connectionsUrl}?google=error&reason=state_expired`,
        302,
      );
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { data: integration, error: fetchError } = await supabaseAdmin
      .from("integrations")
      .select("id, status, connection_metadata")
      .eq("id", integration_id)
      .eq("organization_id", organization_id)
      .single();

    if (fetchError || !integration) {
      return Response.redirect(
        `${connectionsUrl}?google=error&reason=integration_not_found`,
        302,
      );
    }

    if (integration.connection_metadata?.oauth_state !== state) {
      return Response.redirect(
        `${connectionsUrl}?google=error&reason=state_mismatch`,
        302,
      );
    }

    const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
    const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
    const redirectUri = Deno.env.get("GOOGLE_REDIRECT_URI");

    if (!clientId || !clientSecret || !redirectUri) {
      console.error("[google-oauth-callback] Google OAuth secrets are incomplete");
      return Response.redirect(
        `${connectionsUrl}?google=error&reason=server_configuration`,
        302,
      );
    }

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
        302,
      );
    }

    const tokens = await tokenResponse.json();
    const {
      access_token,
      refresh_token,
      scope,
      expires_in,
      token_type,
    } = tokens;

    if (!access_token) {
      return Response.redirect(
        `${connectionsUrl}?google=error&reason=no_access_token`,
        302,
      );
    }

    const userInfoResponse = await fetch(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      { headers: { Authorization: `Bearer ${access_token}` } },
    );

    let googleAccountId = "";
    let googleEmail = "";
    let googleName = "";
    if (userInfoResponse.ok) {
      const userInfo = await userInfoResponse.json();
      googleAccountId = userInfo.id || "";
      googleEmail = userInfo.email || "";
      googleName = userInfo.name || "";
    }

    const { data: existingSecrets } = await supabaseAdmin
      .from("integration_secrets")
      .select("encrypted_refresh_token")
      .eq("integration_id", integration_id)
      .maybeSingle();

    const encryptedAccessToken = await encryptToken(access_token);
    const encryptedRefreshToken = refresh_token
      ? await encryptToken(refresh_token)
      : existingSecrets?.encrypted_refresh_token || null;

    const grantedScopes = scope ? String(scope).split(" ").filter(Boolean) : [];
    const expiresAt = new Date(
      Date.now() + Number(expires_in || 3600) * 1000,
    ).toISOString();
    const now = new Date().toISOString();

    const { error: secretsError } = await supabaseAdmin
      .from("integration_secrets")
      .upsert(
        {
          organization_id,
          integration_id,
          encrypted_access_token: encryptedAccessToken,
          encrypted_refresh_token: encryptedRefreshToken,
          token_type: token_type || "Bearer",
          granted_scopes: grantedScopes,
          expires_at: expiresAt,
          encryption_version: 1,
          updated_at: now,
        },
        { onConflict: "integration_id" },
      );

    if (secretsError) {
      console.error("[google-oauth-callback] Failed to store secrets:", secretsError);
      return Response.redirect(
        `${connectionsUrl}?google=error&reason=secret_storage_failed`,
        302,
      );
    }

    const { error: updateError } = await supabaseAdmin
      .from("integrations")
      .update({
        status: "connected",
        external_account_id: googleAccountId || null,
        external_account_email: googleEmail || null,
        external_account_name: googleName || null,
        connected_at: now,
        disconnected_at: null,
        expires_at: expiresAt,
        last_verified_at: now,
        last_error: null,
        secret_reference: `integration_secrets:${integration_id}`,
        granted_scopes: grantedScopes,
        connection_metadata: {
          ...(integration.connection_metadata || {}),
          oauth_state: null,
          token_expires_at: expiresAt,
        },
        updated_at: now,
      })
      .eq("id", integration_id)
      .eq("organization_id", organization_id);

    if (updateError) {
      console.error("[google-oauth-callback] Failed to update integration:", updateError);
      return Response.redirect(
        `${connectionsUrl}?google=error&reason=update_failed`,
        302,
      );
    }

    await supabaseAdmin.from("activity_logs").insert({
      organization_id,
      user_id,
      activity_type: "integration_connected",
      title: "Google Workspace connected",
      description: `Connected as ${googleEmail || "unknown account"}`,
      severity: "success",
      metadata: { integration_id, provider: "google_workspace" },
    });

    return Response.redirect(`${connectionsUrl}?google=connected`, 302);
  } catch (err) {
    console.error("[google-oauth-callback] Unexpected error:", err);
    const appUrl = Deno.env.get("APP_URL");
    const baseUrl = appUrl ? appUrl.replace(/\/+$/, "") : "";
    if (!baseUrl) {
      return new Response("Server misconfiguration: APP_URL not set", { status: 500 });
    }
    return Response.redirect(
      `${baseUrl}/app/connections?google=error&reason=unexpected_error`,
      302,
    );
  }
});
