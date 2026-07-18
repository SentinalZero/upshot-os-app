/**
 * google-oauth-start
 *
 * Initiates the Google OAuth 2.0 authorization flow.
 * Called by the frontend when a user clicks "Connect" on Google Workspace.
 *
 * Requires authenticated user (JWT in Authorization header).
 * Returns a JSON response with the Google consent URL.
 *
 * Secrets required:
 *   - GOOGLE_CLIENT_ID
 *   - GOOGLE_REDIRECT_URI (the callback Edge Function URL)
 *
 * Never exposes GOOGLE_CLIENT_SECRET to this function's response.
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { getAuthenticatedUser } from "../_shared/supabase-admin.ts";
import { getSupabaseAdmin } from "../_shared/supabase-admin.ts";

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const user = await getAuthenticatedUser(req);
    const body = await req.json();
    const { integration_id, organization_id } = body;

    if (!integration_id || !organization_id) {
      return new Response(
        JSON.stringify({ error: "integration_id and organization_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { data: membership, error: memberError } = await supabaseAdmin
      .from("organization_members")
      .select("id")
      .eq("user_id", user.id)
      .eq("organization_id", organization_id)
      .single();

    if (memberError || !membership) {
      return new Response(
        JSON.stringify({ error: "You do not belong to this organization" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
    const redirectUri = Deno.env.get("GOOGLE_REDIRECT_URI");

    if (!clientId || !redirectUri) {
      return new Response(
        JSON.stringify({ error: "Google OAuth is not configured on this server" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const statePayload = JSON.stringify({
      integration_id,
      organization_id,
      user_id: user.id,
      ts: Date.now(),
    });
    const state = btoa(statePayload);

    const { error: stateError } = await supabaseAdmin
      .from("integrations")
      .update({
        status: "pending",
        metadata: { oauth_state: state, initiated_at: new Date().toISOString() },
        updated_at: new Date().toISOString(),
      })
      .eq("id", integration_id)
      .eq("organization_id", organization_id);

    if (stateError) {
      return new Response(
        JSON.stringify({ error: `Could not prepare Google connection: ${stateError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Keep requested permissions aligned with the scopes approved in Google Auth Platform.
    const scopes = [
      "openid",
      "email",
      "profile",
      "https://www.googleapis.com/auth/gmail.compose",
      "https://www.googleapis.com/auth/calendar.events",
    ].join(" ");

    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", scopes);
    authUrl.searchParams.set("access_type", "offline");
    authUrl.searchParams.set("prompt", "consent");
    authUrl.searchParams.set("include_granted_scopes", "true");
    authUrl.searchParams.set("state", state);

    return new Response(
      JSON.stringify({ url: authUrl.toString() }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = message.includes("Unauthorized") ? 401 : 500;
    return new Response(
      JSON.stringify({ error: message }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
