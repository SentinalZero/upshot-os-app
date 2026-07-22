import type { ActivityLog, CommandDecision } from "@/lib/supabaseService";

export type AttentionCategory = "approval" | "exception" | "recommendation" | "risk";

export interface AttentionQueueItem {
  activity: ActivityLog;
  category: AttentionCategory;
  urgency: "standard" | "high" | "critical";
  businessImpact: string;
  requestedDecision: string;
  recommendedAction: string;
}

export function buildAttentionQueue(decisions: CommandDecision[]): AttentionQueueItem[] {
  return decisions
    .map(decisionToQueueItem)
    .sort((left, right) => urgencyRank(right.urgency) - urgencyRank(left.urgency))
    .slice(0, 8);
}

function decisionToQueueItem(decision: CommandDecision): AttentionQueueItem {
  const urgency = decision.urgency === "critical" ? "critical" : decision.urgency === "high" ? "high" : "standard";
  const activity: ActivityLog = {
    id: decision.id,
    organization_id: decision.organization_id,
    digital_specialist_id: decision.specialist_id,
    event_type: "command_decision",
    activity_type: `decision_${decision.category}`,
    title: decision.title,
    description: decision.summary,
    message: decision.summary,
    severity: decision.urgency === "critical" ? "critical" : decision.urgency === "high" ? "warning" : "info",
    metadata: {
      execution_id: decision.workflow_execution_id,
      decision_id: decision.id,
      decision_status: decision.status,
    },
    created_at: decision.created_at,
  };

  return {
    activity,
    category: decision.category,
    urgency,
    businessImpact: decision.business_impact || defaultImpact(decision.category),
    requestedDecision: decision.requested_decision || defaultDecision(decision.category),
    recommendedAction: decision.recommended_action || defaultRecommendation(decision.category),
  };
}

function defaultImpact(category: AttentionCategory): string {
  if (category === "approval") return "Work is paused until an authorized person approves the next action.";
  if (category === "risk") return "Waiting may increase customer, revenue, or operational exposure.";
  if (category === "recommendation") return "A timely decision can improve execution quality or speed.";
  return "The Specialist cannot continue safely without clarification or intervention.";
}

function defaultDecision(category: AttentionCategory): string {
  if (category === "approval") return "Approve, request changes, or dismiss the proposed action.";
  if (category === "risk") return "Choose whether to act now, monitor, or escalate.";
  if (category === "recommendation") return "Accept, modify, or decline the recommendation.";
  return "Resolve the exception or provide the missing information.";
}

function defaultRecommendation(category: AttentionCategory): string {
  if (category === "approval") return "Review the prepared output and confirm it follows company policy.";
  if (category === "risk") return "Review the evidence and assign a clear owner and next step.";
  if (category === "recommendation") return "Review the supporting context before accepting the proposed action.";
  return "Open the details, verify the missing context, and provide direction.";
}

function urgencyRank(urgency: AttentionQueueItem["urgency"]): number {
  if (urgency === "critical") return 3;
  if (urgency === "high") return 2;
  return 1;
}
