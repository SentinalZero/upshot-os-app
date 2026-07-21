import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { getAuthenticatedUser, getSupabaseAdmin } from "../_shared/supabase-admin.ts";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function respond(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  if (req.method !== "POST") return respond({ error: "Method not allowed" }, 405);

  try {
    const user = await getAuthenticatedUser(req);
    const body = await req.json().catch(() => ({}));
    const organizationId = typeof body.organization_id === "string" ? body.organization_id : "";
    if (!UUID_PATTERN.test(organizationId)) return respond({ error: "Valid organization_id is required" }, 400);

    const admin = getSupabaseAdmin();
    const { data: membership } = await admin.from("organization_members").select("role")
      .eq("organization_id", organizationId).eq("user_id", user.id).single();
    if (!membership) return respond({ error: "You do not belong to this organization" }, 403);

    let { data: subscription, error: subscriptionError } = await admin.from("organization_subscriptions")
      .select("plan_key, status, monthly_price_cents, workflow_run_limit, retention_days, trial_ends_at, current_period_start, current_period_end")
      .eq("organization_id", organizationId).single();

    if (subscriptionError || !subscription) {
      const created = await admin.from("organization_subscriptions").insert({ organization_id: organizationId })
        .select("plan_key, status, monthly_price_cents, workflow_run_limit, retention_days, trial_ends_at, current_period_start, current_period_end").single();
      if (created.error || !created.data) return respond({ error: created.error?.message || "Billing record could not be loaded" }, 500);
      subscription = created.data;
    }

    const { count, error: usageError } = await admin.from("workflow_executions")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .gte("created_at", subscription.current_period_start)
      .lt("created_at", subscription.current_period_end);
    if (usageError) return respond({ error: usageError.message }, 500);

    const used = count || 0;
    const limit = Number(subscription.workflow_run_limit || 0);
    const remaining = Math.max(limit - used, 0);
    const percentUsed = limit > 0 ? Math.min(Math.round((used / limit) * 100), 100) : 100;

    return respond({
      success: true,
      requester_role: membership.role,
      subscription,
      usage: { workflow_runs_used: used, workflow_runs_limit: limit, workflow_runs_remaining: remaining, percent_used: percentUsed },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("[get-billing-usage]", message);
    return respond({ error: message }, 500);
  }
});
