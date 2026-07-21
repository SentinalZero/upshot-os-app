import type { ActivityLog } from "@/lib/supabaseService";

export type AttentionCategory = "approval" | "exception" | "recommendation" | "risk";

export interface AttentionQueueItem {
  activity: ActivityLog;
  category: AttentionCategory;
  urgency: "standard" | "high" | "critical";
  businessImpact: string;
  requestedDecision: string;
  recommendedAction: string;
}

export function buildAttentionQueue(activity: ActivityLog[]): AttentionQueueItem[] {
  return activity
    .filter(item => {
      const severity = item.severity?.toLowerCase();
      return severity === "warning"
        || severity === "critical"
        || item.metadata?.requires_human_attention === true
        || item.metadata?.requires_human_attention === "true";
    })
    .map(classifyAttentionItem)
    .sort((left, right) => urgencyRank(right.urgency) - urgencyRank(left.urgency))
    .slice(0, 8);
}

function classifyAttentionItem(activity: ActivityLog): AttentionQueueItem {
  const metadata = activity.metadata || {};
  const searchable = `${activity.title || ""} ${activity.description || ""} ${activity.message || ""} ${activity.activity_type || ""} ${activity.event_type || ""}`.toLowerCase();
  const explicitCategory = typeof metadata.attention_category === "string" ? metadata.attention_category.toLowerCase() : "";

  const category: AttentionCategory = explicitCategory === "approval" || searchable.includes("approv") || searchable.includes("review draft")
    ? "approval"
    : explicitCategory === "risk" || searchable.includes("risk") || searchable.includes("stalled") || searchable.includes("overdue")
      ? "risk"
      : explicitCategory === "recommendation" || searchable.includes("recommend") || searchable.includes("suggest")
        ? "recommendation"
        : "exception";

  const severity = activity.severity?.toLowerCase();
  const urgency = severity === "critical" ? "critical" : severity === "warning" ? "high" : "standard";

  return {
    activity,
    category,
    urgency,
    businessImpact: metadataText(metadata.business_impact) || defaultImpact(category),
    requestedDecision: metadataText(metadata.requested_decision) || defaultDecision(category),
    recommendedAction: metadataText(metadata.recommended_action) || defaultRecommendation(category),
  };
}

function metadataText(value: unknown): string {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : "";
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
