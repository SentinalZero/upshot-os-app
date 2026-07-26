import { supabase } from "@/lib/supabase";

export type CommandDecisionCategory = "approval" | "exception" | "recommendation" | "risk";
export type CommandDecisionStatus = "open" | "in_review" | "approved" | "rejected" | "resolved" | "expired";
export type CommandDecisionUrgency = "critical" | "high" | "normal" | "low";

export interface CommandDecision {
  id: string;
  organization_id: string;
  specialist_id: string | null;
  capability_id: string | null;
  workflow_execution_id: string | null;
  source_activity_log_id: string | null;
  category: CommandDecisionCategory;
  status: CommandDecisionStatus;
  urgency: CommandDecisionUrgency;
  title: string;
  summary: string;
  business_impact: string;
  recommended_action: string;
  requested_decision: string;
  assigned_user_id: string | null;
  assigned_role: "owner" | "admin" | "member" | null;
  due_at: string | null;
  resolution_note: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

const urgencyOrder: Record<CommandDecisionUrgency, number> = {
  critical: 0,
  high: 1,
  normal: 2,
  low: 3,
};

export async function fetchActiveCommandDecisions(organizationId: string): Promise<{ data: CommandDecision[]; error: string | null }> {
  if (!supabase) return { data: [], error: "Supabase is not configured." };

  const { data, error } = await supabase
    .from("command_decisions")
    .select("*")
    .eq("organization_id", organizationId)
    .in("status", ["open", "in_review"])
    .limit(50);

  if (error) return { data: [], error: error.message };

  const decisions = ((data || []) as CommandDecision[]).sort((a, b) => {
    const urgencyDifference = urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
    if (urgencyDifference !== 0) return urgencyDifference;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });

  return { data: decisions, error: null };
}

export async function updateCommandDecision(
  organizationId: string,
  decisionId: string,
  status: CommandDecisionStatus,
  resolutionNote?: string,
): Promise<{ success: boolean; error: string | null }> {
  if (!supabase) return { success: false, error: "Supabase is not configured." };

  const updates: Record<string, unknown> = { status };
  if (resolutionNote !== undefined) updates.resolution_note = resolutionNote.trim() || null;

  const { error } = await supabase
    .from("command_decisions")
    .update(updates)
    .eq("organization_id", organizationId)
    .eq("id", decisionId);

  return error ? { success: false, error: error.message } : { success: true, error: null };
}

export async function resolveCommandDecision(
  organizationId: string,
  decision: CommandDecision,
  status: CommandDecisionStatus,
  resolvedBy?: string | null,
): Promise<{ success: boolean; error: string | null; dispatchPending?: boolean }> {
  if (!supabase) return { success: false, error: "Supabase is not configured." };

  const resolvedAt = new Date().toISOString();
  const continuationStatus = status === "rejected" ? "cancelled" : "queued";
  const originalDecisionStatus = decision.status;

  const { error: decisionError } = await supabase
    .from("command_decisions")
    .update({
      status,
      resolved_at: resolvedAt,
      resolved_by: resolvedBy || null,
      resolution_note: status === "rejected" ? "Rejected by human reviewer." : "Authorized by human reviewer.",
    })
    .eq("organization_id", organizationId)
    .eq("id", decision.id);

  if (decisionError) return { success: false, error: decisionError.message };

  if (decision.workflow_execution_id) {
    const { error: executionError } = await supabase
      .from("workflow_executions")
      .update({
        status: continuationStatus,
        completed_at: continuationStatus === "cancelled" ? resolvedAt : null,
      })
      .eq("organization_id", organizationId)
      .eq("id", decision.workflow_execution_id);

    if (executionError) {
      await supabase
        .from("command_decisions")
        .update({
          status: originalDecisionStatus,
          resolved_at: null,
          resolved_by: null,
          resolution_note: decision.resolution_note,
        })
        .eq("organization_id", organizationId)
        .eq("id", decision.id);

      return {
        success: false,
        error: `The decision was not applied because the linked workflow could not be updated: ${executionError.message}`,
      };
    }
  }

  const actionLabel = status === "rejected" ? "rejected" : status === "approved" ? "approved" : "resolved";
  const { error: activityError } = await supabase.from("activity_logs").insert({
    organization_id: organizationId,
    digital_specialist_id: decision.specialist_id,
    event_type: "command_decision_resolved",
    activity_type: "human_oversight",
    title: `${decision.title} ${actionLabel}`,
    description: status === "rejected"
      ? "The reviewer rejected the proposed action and the linked workflow was cancelled."
      : "The reviewer authorized the next action and the linked workflow was queued to continue.",
    message: `${decision.category} decision ${actionLabel}`,
    severity: "info",
    metadata: {
      command_decision_id: decision.id,
      workflow_execution_id: decision.workflow_execution_id,
      decision_status: status,
      continuation_status: continuationStatus,
      resolved_by: resolvedBy || null,
      requires_human_attention: false,
    },
  });

  if (status !== "rejected" && decision.workflow_execution_id) {
    const { data: dispatchData, error: dispatchError } = await supabase.functions.invoke("continue-workflow", {
      body: {
        organizationId,
        executionId: decision.workflow_execution_id,
        decisionId: decision.id,
        decisionStatus: status,
      },
    });

    // A missing continuation URL intentionally leaves the execution queued. It can be
    // configured and retried without reversing the user's decision.
    const dispatchPending = Boolean(dispatchError) || dispatchData?.dispatched === false;

    return {
      success: true,
      dispatchPending,
      error: activityError
        ? `The decision was applied, but the audit event could not be written: ${activityError.message}`
        : null,
    };
  }

  return {
    success: true,
    error: activityError ? `The workflow state was updated, but the audit event could not be written: ${activityError.message}` : null,
  };
}

export function subscribeToCommandDecisions(organizationId: string, onChange: () => void): () => void {
  if (!supabase) return () => undefined;
  const client = supabase;

  const channel = client
    .channel(`command-decisions-${organizationId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "command_decisions", filter: `organization_id=eq.${organizationId}` },
      onChange,
    )
    .subscribe();

  return () => {
    void client.removeChannel(channel);
  };
}
