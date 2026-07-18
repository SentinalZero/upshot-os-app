/**
 * Trusted n8n callback for completing an existing workflow execution.
 * Deploy with JWT verification disabled; X-Upshot-Workflow-Secret authenticates it.
 */
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { getSupabaseAdmin } from "../_shared/supabase-admin.ts";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TERMINAL_STATUSES = new Set(["successful", "failed"]);
const COMPLETABLE_STATUSES = new Set(["running", "queued", "processing", "in_progress"]);

function respond(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function secretsMatch(received: string, expected: string): boolean {
  const encoder = new TextEncoder();
  const left = encoder.encode(received);
  const right = encoder.encode(expected);
  if (left.length !== right.length) return false;

  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index] ^ right[index];
  }
  return difference === 0;
}

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  if (req.method !== "POST") return respond({ error: "Method not allowed" }, 405);

  try {
    const expectedSecret = Deno.env.get("N8N_WORKFLOW_TRIGGER_SECRET");
    const receivedSecret = req.headers.get("X-Upshot-Workflow-Secret") || "";

    if (!expectedSecret || !receivedSecret || !secretsMatch(receivedSecret, expectedSecret)) {
      return respond({ error: "Unauthorized workflow completion" }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const executionId = typeof body.execution_id === "string" ? body.execution_id : "";
    const organizationId = typeof body.organization_id === "string" ? body.organization_id : "";
    const status = typeof body.status === "string" ? body.status.trim().toLowerCase() : "";
    const summary = typeof body.summary === "string" ? body.summary.trim() : "";
    const errorMessage = typeof body.error_message === "string" ? body.error_message.trim() : "";
    const n8nExecutionId = typeof body.n8n_execution_id === "string"
      ? body.n8n_execution_id.trim().slice(0, 255)
      : "";
    const outputSummary = body.output_summary ?? {};

    if (!UUID_PATTERN.test(executionId)) {
      return respond({ error: "A valid execution_id is required" }, 400);
    }
    if (!UUID_PATTERN.test(organizationId)) {
      return respond({ error: "A valid organization_id is required" }, 400);
    }
    if (!TERMINAL_STATUSES.has(status)) {
      return respond({ error: "status must be successful or failed" }, 400);
    }
    if (!isJsonObject(outputSummary)) {
      return respond({ error: "output_summary must be a JSON object" }, 400);
    }
    if (summary.length > 50_000) {
      return respond({ error: "summary is too large" }, 413);
    }
    if (errorMessage.length > 10_000) {
      return respond({ error: "error_message is too large" }, 413);
    }
    if (JSON.stringify(outputSummary).length > 100_000) {
      return respond({ error: "output_summary is too large" }, 413);
    }
    if (status === "failed" && !errorMessage) {
      return respond({ error: "error_message is required when status is failed" }, 400);
    }

    const admin = getSupabaseAdmin();
    const { data: execution, error: fetchError } = await admin
      .from("workflow_executions")
      .select("id, organization_id, specialist_id, specialist_workflow_deployment_id, status, summary, output_summary, error_message, completed_at, trigger_metadata")
      .eq("id", executionId)
      .eq("organization_id", organizationId)
      .single();

    if (fetchError || !execution) {
      return respond({ error: "Workflow execution was not found" }, 404);
    }

    const currentStatus = String(execution.status || "").toLowerCase();
    if (TERMINAL_STATUSES.has(currentStatus)) {
      if (currentStatus !== status) {
        return respond({
          error: `Execution is already ${currentStatus} and cannot be changed to ${status}`,
          execution_id: execution.id,
          status: currentStatus,
        }, 409);
      }

      return respond({
        execution_id: execution.id,
        organization_id: execution.organization_id,
        digital_specialist_id: execution.specialist_id,
        specialist_workflow_deployment_id: execution.specialist_workflow_deployment_id,
        status: currentStatus,
        completed_at: execution.completed_at,
        duplicate: true,
      });
    }

    if (!COMPLETABLE_STATUSES.has(currentStatus)) {
      return respond({
        error: `Execution status ${currentStatus || "unknown"} cannot be completed`,
        execution_id: execution.id,
        status: currentStatus,
      }, 409);
    }

    const completedAt = new Date().toISOString();
    const completionMetadata = {
      ...(isJsonObject(execution.trigger_metadata) ? execution.trigger_metadata : {}),
      completed_by: "n8n",
      completion_received_at: completedAt,
      n8n_execution_id: n8nExecutionId || null,
    };

    const { data: updated, error: updateError } = await admin
      .from("workflow_executions")
      .update({
        status,
        summary: summary || null,
        output_summary: outputSummary,
        error_message: status === "failed" ? errorMessage : null,
        n8n_execution_id: n8nExecutionId || null,
        completed_at: completedAt,
        trigger_metadata: completionMetadata,
      })
      .eq("id", executionId)
      .eq("organization_id", organizationId)
      .eq("status", execution.status)
      .select("id, organization_id, specialist_id, specialist_workflow_deployment_id, status, summary, output_summary, error_message, n8n_execution_id, completed_at")
      .maybeSingle();

    if (updateError) {
      return respond({ error: `Could not complete workflow execution: ${updateError.message}` }, 500);
    }

    if (!updated) {
      return respond({ error: "Execution changed while completion was being processed. Retry the request." }, 409);
    }

    const activityTitle = status === "successful"
      ? "Meeting Summary completed"
      : "Meeting Summary failed";
    const activityDescription = status === "successful"
      ? summary || "The workflow completed successfully."
      : errorMessage;

    const { error: activityError } = await admin.from("activity_logs").insert({
      organization_id: organizationId,
      digital_specialist_id: execution.specialist_id,
      activity_type: status === "successful" ? "workflow_completed" : "workflow_failed",
      title: activityTitle,
      description: activityDescription.slice(0, 2_000),
      severity: status === "successful" ? "success" : "critical",
      metadata: {
        execution_id: executionId,
        specialist_workflow_deployment_id: execution.specialist_workflow_deployment_id,
        n8n_execution_id: n8nExecutionId || null,
        workflow_name: "Meeting Summary",
      },
    });

    if (activityError) {
      console.error("[complete-workflow-execution] Activity log insert failed:", activityError);
    }

    return respond({
      execution_id: updated.id,
      organization_id: updated.organization_id,
      digital_specialist_id: updated.specialist_id,
      specialist_workflow_deployment_id: updated.specialist_workflow_deployment_id,
      status: updated.status,
      summary: updated.summary,
      output_summary: updated.output_summary,
      error_message: updated.error_message,
      n8n_execution_id: updated.n8n_execution_id,
      completed_at: updated.completed_at,
      duplicate: false,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("[complete-workflow-execution] Unexpected error:", error);
    return respond({ error: message }, 500);
  }
});
