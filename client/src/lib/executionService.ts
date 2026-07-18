import { supabase } from "./supabase";

export interface StartWorkflowExecutionInput {
  specialistWorkflowDeploymentId: string;
  inputPayload?: Record<string, unknown>;
  requestId?: string;
}

export interface StartWorkflowExecutionResult {
  success: boolean;
  executionId?: string;
  organizationId?: string;
  digitalSpecialistId?: string;
  specialistWorkflowDeploymentId?: string;
  triggeredByUserId?: string;
  requestId?: string;
  status?: string;
  duplicate?: boolean;
  error?: string;
}

export async function startWorkflowExecution(
  input: StartWorkflowExecutionInput,
): Promise<StartWorkflowExecutionResult> {
  if (!supabase) {
    return { success: false, error: "Supabase is not configured" };
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (sessionError || !accessToken) {
    return { success: false, error: "You must be signed in to start a job" };
  }

  const requestId = input.requestId || crypto.randomUUID();
  const { data, error } = await supabase.functions.invoke("start-workflow-execution", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: {
      specialist_workflow_deployment_id: input.specialistWorkflowDeploymentId,
      input_payload: input.inputPayload || {},
      request_id: requestId,
    },
  });

  if (error) {
    return { success: false, error: error.message };
  }

  if (data?.error) {
    return {
      success: false,
      executionId: data.execution_id,
      error: String(data.error),
    };
  }

  return {
    success: true,
    executionId: data.execution_id,
    organizationId: data.organization_id,
    digitalSpecialistId: data.digital_specialist_id,
    specialistWorkflowDeploymentId: data.specialist_workflow_deployment_id,
    triggeredByUserId: data.triggered_by_user_id,
    requestId: data.request_id || requestId,
    status: data.status,
    duplicate: data.duplicate === true,
  };
}
