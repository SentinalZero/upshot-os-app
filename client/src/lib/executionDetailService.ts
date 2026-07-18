import { supabase } from "./supabase";

export interface WorkflowExecutionDetail {
  id: string;
  organization_id: string;
  specialist_id: string;
  specialist_workflow_deployment_id: string | null;
  n8n_execution_id: string | null;
  status: string;
  trigger_source: string | null;
  summary: string | null;
  input_summary: Record<string, unknown>;
  output_summary: Record<string, unknown>;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  trigger_metadata: Record<string, unknown> | null;
  input_payload: Record<string, unknown>;
  external_event_id: string | null;
}

export async function fetchWorkflowExecutionDetail(
  organizationId: string,
  executionId: string,
): Promise<{ data: WorkflowExecutionDetail | null; error: string | null }> {
  if (!supabase) {
    return { data: null, error: "Supabase is not configured." };
  }

  const { data, error } = await supabase
    .from("workflow_executions")
    .select(
      "id, organization_id, specialist_id, specialist_workflow_deployment_id, n8n_execution_id, status, trigger_source, summary, input_summary, output_summary, error_message, started_at, completed_at, created_at, trigger_metadata, input_payload, external_event_id",
    )
    .eq("id", executionId)
    .eq("organization_id", organizationId)
    .single();

  if (error) {
    console.error("[ExecutionDetailService] fetch error:", error);
    return { data: null, error: error.message };
  }

  return { data: data as WorkflowExecutionDetail, error: null };
}
