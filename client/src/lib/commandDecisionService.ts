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

export function subscribeToCommandDecisions(organizationId: string, onChange: () => void): () => void {
  if (!supabase) return () => undefined;

  const channel = supabase
    .channel(`command-decisions-${organizationId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "command_decisions", filter: `organization_id=eq.${organizationId}` },
      onChange,
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
