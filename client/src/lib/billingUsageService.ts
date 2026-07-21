import { supabase } from "./supabase";

export interface BillingUsageSnapshot {
  requesterRole: string;
  subscription: {
    planKey: string;
    status: string;
    monthlyPriceCents: number;
    workflowRunLimit: number;
    retentionDays: number;
    trialEndsAt: string;
    currentPeriodStart: string;
    currentPeriodEnd: string;
  };
  usage: {
    workflowRunsUsed: number;
    workflowRunsLimit: number;
    workflowRunsRemaining: number;
    percentUsed: number;
  };
}

export async function fetchBillingUsage(organizationId: string): Promise<{ data: BillingUsageSnapshot | null; error: string | null }> {
  if (!supabase) return { data: null, error: "Supabase is not configured." };
  const { data, error } = await supabase.functions.invoke("get-billing-usage", { body: { organization_id: organizationId } });
  if (error) return { data: null, error: error.message || "Billing usage could not be loaded." };
  if (data?.error) return { data: null, error: String(data.error) };
  return {
    data: {
      requesterRole: String(data.requester_role || "member"),
      subscription: {
        planKey: String(data.subscription?.plan_key || "starter"),
        status: String(data.subscription?.status || "trialing"),
        monthlyPriceCents: Number(data.subscription?.monthly_price_cents || 0),
        workflowRunLimit: Number(data.subscription?.workflow_run_limit || 0),
        retentionDays: Number(data.subscription?.retention_days || 0),
        trialEndsAt: String(data.subscription?.trial_ends_at || ""),
        currentPeriodStart: String(data.subscription?.current_period_start || ""),
        currentPeriodEnd: String(data.subscription?.current_period_end || ""),
      },
      usage: {
        workflowRunsUsed: Number(data.usage?.workflow_runs_used || 0),
        workflowRunsLimit: Number(data.usage?.workflow_runs_limit || 0),
        workflowRunsRemaining: Number(data.usage?.workflow_runs_remaining || 0),
        percentUsed: Number(data.usage?.percent_used || 0),
      },
    },
    error: null,
  };
}
