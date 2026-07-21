type SupabaseAdmin = ReturnType<typeof import("./supabase-admin.ts").getSupabaseAdmin>;

export interface BillingGuardResult {
  allowed: boolean;
  status: string;
  reason: "allowed" | "inactive_subscription" | "trial_expired" | "usage_limit_reached" | "missing_subscription";
  message: string;
  workflowRunLimit: number;
  workflowRunsUsed: number;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
}

export async function checkWorkflowRunAllowance(
  admin: SupabaseAdmin,
  organizationId: string,
): Promise<BillingGuardResult> {
  const { data: subscription, error } = await admin
    .from("organization_subscriptions")
    .select("status, workflow_run_limit, trial_ends_at, current_period_start, current_period_end")
    .eq("organization_id", organizationId)
    .single();

  if (error || !subscription) {
    return {
      allowed: false,
      status: "missing",
      reason: "missing_subscription",
      message: "Billing is not configured for this workspace. Open Billing & Usage to finish setup.",
      workflowRunLimit: 0,
      workflowRunsUsed: 0,
      currentPeriodStart: null,
      currentPeriodEnd: null,
    };
  }

  const status = String(subscription.status || "").toLowerCase();
  const workflowRunLimit = Number(subscription.workflow_run_limit || 0);
  const currentPeriodStart = subscription.current_period_start || null;
  const currentPeriodEnd = subscription.current_period_end || null;

  if (!["trialing", "active"].includes(status)) {
    return {
      allowed: false,
      status,
      reason: "inactive_subscription",
      message: `Workflow runs are unavailable while the subscription is ${status.replaceAll("_", " ")}. Open Billing & Usage to manage the workspace plan.`,
      workflowRunLimit,
      workflowRunsUsed: 0,
      currentPeriodStart,
      currentPeriodEnd,
    };
  }

  if (status === "trialing" && subscription.trial_ends_at && Date.parse(subscription.trial_ends_at) <= Date.now()) {
    return {
      allowed: false,
      status,
      reason: "trial_expired",
      message: "The workspace trial has ended. Activate the Starter plan to continue running workflows.",
      workflowRunLimit,
      workflowRunsUsed: 0,
      currentPeriodStart,
      currentPeriodEnd,
    };
  }

  const usageQuery = admin
    .from("workflow_executions")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId);

  if (currentPeriodStart) usageQuery.gte("created_at", currentPeriodStart);
  if (currentPeriodEnd) usageQuery.lt("created_at", currentPeriodEnd);

  const { count, error: usageError } = await usageQuery;
  if (usageError) throw new Error(`Could not verify workflow usage: ${usageError.message}`);

  const workflowRunsUsed = count || 0;
  if (workflowRunLimit <= 0 || workflowRunsUsed >= workflowRunLimit) {
    return {
      allowed: false,
      status,
      reason: "usage_limit_reached",
      message: `This workspace has used all ${workflowRunLimit.toLocaleString()} workflow runs for the current billing period.`,
      workflowRunLimit,
      workflowRunsUsed,
      currentPeriodStart,
      currentPeriodEnd,
    };
  }

  return {
    allowed: true,
    status,
    reason: "allowed",
    message: "Workflow execution is allowed.",
    workflowRunLimit,
    workflowRunsUsed,
    currentPeriodStart,
    currentPeriodEnd,
  };
}

export async function logBlockedWorkflowRun(
  admin: SupabaseAdmin,
  organizationId: string,
  guard: BillingGuardResult,
  metadata: Record<string, unknown>,
) {
  const { error } = await admin.from("activity_logs").insert({
    organization_id: organizationId,
    digital_specialist_id: typeof metadata.digital_specialist_id === "string" ? metadata.digital_specialist_id : null,
    activity_type: "workflow_execution_blocked_by_billing",
    title: "Workflow run blocked",
    description: guard.message,
    severity: "warning",
    metadata: {
      ...metadata,
      billing_status: guard.status,
      billing_reason: guard.reason,
      workflow_runs_used: guard.workflowRunsUsed,
      workflow_run_limit: guard.workflowRunLimit,
      current_period_start: guard.currentPeriodStart,
      current_period_end: guard.currentPeriodEnd,
    },
  });
  if (error) console.error("[billing-guard] activity log error", error.message);
}
