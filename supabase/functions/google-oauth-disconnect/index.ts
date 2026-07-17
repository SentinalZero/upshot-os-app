/**
 * google-oauth-disconnect
 *
 * Disconnects a Google Workspace integration:
 * 1. Decrypts the stored access token server-side
 * 2. Revokes the token with Google
 * 3. Deletes the encrypted secrets from integration_secrets
 * 4. Updates the integration status to "disconnected"
 *
 * Never sends decrypted tokens or secrets to the browser.
 *
 * Secrets required:
 *   - TOKEN_ENCRYPTION_KEY (for decryption)
 *   - SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { getAuthenticatedUser, getSupabaseAdmin } from "../_shared/supabase-admin.ts";
import { decryptToken } from "../_shared/crypto.ts";

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
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user belongs to the organization
    const supabaseAdmin = getSupabaseAdmin();
    const { data: membership } = await supabaseAdmin
      .from("organization_members")
      .select("id")
      .eq("user_id", user.id)
      .eq("organization_id", organization_id)
      .single();

    if (!membership) {
      return new Response(
        JSON.stringify({ error: "Forbidden" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch the encrypted secrets
    const { data: secrets, error: secretsError } = await supabaseAdmin
      .from("integration_secrets")
      .select("encrypted_access_token")
      .eq("integration_id", integration_id)
      .single();

    if (!secretsError && secrets?.encrypted_access_token) {
      // Decrypt the access token server-side to revoke it with Google
      try {
        const accessToken = await decryptToken(secrets.encrypted_access_token);

        // Revoke the token with Google
        await fetch(`https://oauth2.googleapis.com/revoke?token=${accessToken}`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        });
      } catch (decryptErr) {
        // If decryption fails, still proceed with cleanup
        console.error("[google-oauth-disconnect] Failed to decrypt/revoke token:", decryptErr);
      }
    }

    // Delete the secrets record
    await supabaseAdmin
      .from("integration_secrets")
      .delete()
      .eq("integration_id", integration_id);

    // Update integration status to "disconnected"
    const { error: updateError } = await supabaseAdmin
      .from("integrations")
      .update({
        status: "disconnected",
        external_account_email: null,
        external_account_name: null,
        connected_at: null,
        last_verified_at: null,
        granted_scopes: null,
        metadata: {},
        updated_at: new Date().toISOString(),
      })
      .eq("id", integration_id)
      .eq("organization_id", organization_id);

    if (updateError) {
      console.error("[google-oauth-disconnect] Failed to update integration:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to update integration status" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log activity
    await supabaseAdmin.from("activity_logs").insert({
      organization_id,
      user_id: user.id,
      activity_type: "integration_disconnected",
      title: "Google Workspace disconnected",
      description: "OAuth tokens revoked and removed",
      severity: "warning",
      metadata: { integration_id, provider: "google_workspace" },
    });

    return new Response(
      JSON.stringify({ success: true, status: "disconnected" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = message.includes("Unauthorized") ? 401 : 500;
    return new Response(
      JSON.stringify({ error: message }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

