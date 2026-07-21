import { supabase } from "./supabase";

export type WorkflowReviewAction = "approve" | "request_changes" | "dismiss";

export interface WorkflowReviewRecord {
  status: "approved" | "changes_requested" | "dismissed";
  note: string | null;
  reviewed_at: string;
  reviewed_by_user_id: string;
  reviewed_by_role: string;
}

export interface WorkflowReviewResult {
  success: boolean;
  review: WorkflowReviewRecord | null;
  error: string | null;
}

export async function reviewWorkflowOutput(
  organizationId: string,
  executionId: string,
  action: WorkflowReviewAction,
  note?: string,
): Promise<WorkflowReviewResult> {
  if (!supabase) return { success: false, review: null, error: "Supabase is not configured." };

  const { data, error } = await supabase.functions.invoke("review-workflow-output", {
    body: {
      organization_id: organizationId,
      execution_id: executionId,
      action,
      note: note?.trim() || undefined,
    },
  });

  if (error) {
    const context = (error as { context?: { json?: () => Promise<unknown> } }).context;
    if (context?.json) {
      try {
        const body = await context.json() as { error?: string };
        if (body?.error) return { success: false, review: null, error: body.error };
      } catch {
        // Fall back to the function client error below.
      }
    }
    return { success: false, review: null, error: error.message || "The draft review could not be saved." };
  }

  if (data?.error) return { success: false, review: null, error: String(data.error) };
  return {
    success: data?.success === true,
    review: data?.review || null,
    error: data?.success === true ? null : "The draft review could not be saved.",
  };
}
