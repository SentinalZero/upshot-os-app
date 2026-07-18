/**
 * google-oauth-status
 *
 * Returns public connection status for a Google Workspace integration.
 * Never returns tokens, encrypted token values, or encryption keys.
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { getAuthenticatedUser, getSupabaseAdmin } from "../_shared/supabase-admin.ts";

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const user = await getAuthenticatedUser(req);
    const url = new URL(req.url);
    const integrationId = url.searchParams.get("integration_id");
    const organizationId = url.searchParams.get("organization_id");

    if (!integrationId || !organizationId) {
      return new Response(
        JSON.stringify({ error: "integration_id and organization_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { data: membership } = await supabaseAdmin
      .from("organization_members")
      .select("id")
      .eq("user_id", user.id)
      .eq("organization_id", organizationId)
      .single();

    if (!membership) {
      return new Response(
        JSON.stringify({ error: "Forbidden" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: integration, error } = await supabaseAdmin
      .from("integrations")
      .select("id, status, external_account_email, external_account_name, connected_at, expires_at, last_verified_at, granted_scopes")
      .eq("id", integrationId)
      .eq("organization_id", organizationId)
      .single();

    if (error || !integration) {
      return new Response(
        JSON.stringify({ error: "Integration not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: secrets } = await supabaseAdmin
      .from("integration_secrets")
      .select("id, expires_at")
      .eq("integration_id", integrationId)
      .eq("organization_id", organizationId)
      .maybeSingle();

    return new Response(
      JSON.stringify({
        ...integration,
        has_tokens: !!secrets,
        token_expires_at: secrets?.expires_at || integration.expires_at || null,
      }),
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
