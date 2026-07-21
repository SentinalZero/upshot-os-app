/**
 * Authenticated entry point for manually starting a deployed capability.
 */
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { getAuthenticatedUser, getSupabaseAdmin } from "../_shared/supabase-admin.ts";
import { checkWorkflowRunAllowance, logBlockedWorkflowRun } from "../_shared/billing-guard.ts";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ACTIVE_STATUSES = new Set(["active", "deployed", "ready", "running"]);

function respond(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  if (req.method !== "POST") return respond({ error: "Method not allowed" }, 405);

  try {
    const user = await getAuthenticatedUser(req);
    const admin = getSupabaseAdmin();
    const body = await req.json().catch(() => ({}));

    const deploymentId = typeof body.specialist_workflow_deployment_id === "string"
      ? body.specialist_workflow_deployment_id
      : "";
    const requestId = typeof body.request_id === "string" && body.request_id
      ? body.request_id
      : crypto.randomUUID();
    const inputPayload = body.input_payload ?? {};

    if (!UUID_PATTERN.test(deploymentId)) return respond({ error: "A valid specialist_workflow_deployment_id is required" }, 400);
    if (!UUID_PATTERN.test(requestId)) return respond({ error: "request_id must be a valid UUID" }, 400);
    if (!isJsonObject(inputPayload)) return respond({ error: "input_payload must be a JSON object" }, 400);
    if (JSON.stringify(inputPayload).length > 100_000) return respond({ error: "input_payload is too large" }, 413);

    const n8nUrl = Deno.env.get("N8N_WORKFLOW_TRIGGER_URL");
    const n8nSecret = Deno.env.get("N8N_WORKFLOW_TRIGGER_SECRET");
    if (!n8nUrl || !n8nSecret) return respond({ error: "Workflow routing is not configured on this server" }, 500);

    const { data: profile } = await admin.from("profiles").select("active_organization_id").eq("id", user.id).single();
    const organizationId = profile?.active_organization_id;
    if (!organizationId) return respond({ error: "No active organization was found for this user" }, 403);

    const { data: membership } = await admin.from("organization_members").select("role")
      .eq("organization_id", organizationId).eq("user_id", user.id).single();
    if (!membership) return respond({ error: "You do not belong to the active organization" }, 403);

    const { data: deployment } = await admin.from("specialist_workflow_deployments")
      .select("id, organization_id, specialist_id, status")
      .eq("id", deploymentId).eq("organization_id", organizationId).single();
    if (!deployment) return respond({ error: "Capability deployment was not found in the active organization" }, 404);
    if (!ACTIVE_STATUSES.has(String(deployment.status || "").toLowerCase())) return respond({ error: "This capability is not active" }, 409);

    const { data: specialist } = await admin.from("digital_specialists")
      .select("id, status, framework_lifecycle_status")
      .eq("id", deployment.specialist_id).eq("organization_id", organizationId).single();
    if (!specialist) return respond({ error: "The assigned Digital Specialist was not found" }, 404);
    const specialistStatuses = [specialist.status, specialist.framework_lifecycle_status]
      .filter(Boolean).map((value) => String(value).toLowerCase());
    if (!specialistStatuses.some((status) => ACTIVE_STATUSES.has(status))) return respond({ error: "The assigned Digital Specialist is not active" }, 409);

    const { data: existingExecutions, error: existingError } = await admin.from("workflow_executions")
      .select("id, status, organization_id, specialist_id")
      .eq("organization_id", organizationId).eq("request_id", requestId).limit(1);
    if (existingError) return respond({ error: `Could not verify request idempotency: ${existingError.message}` }, 500);
    if (existingExecutions?.length) {
      const existing = existingExecutions[0];
      return respond({
        execution_id: existing.id,
        organization_id: existing.organization_id,
        digital_specialist_id: existing.specialist_id,
        specialist_workflow_deployment_id: deployment.id,
        request_id: requestId,
        status: existing.status,
        duplicate: true,
      });
    }

    const billing = await checkWorkflowRunAllowance(admin, organizationId);
    if (!billing.allowed) {
      await logBlockedWorkflowRun(admin, organizationId, billing, {
        trigger_source: "manual",
        requested_by_user_id: user.id,
        organization_role: membership.role,
        digital_specialist_id: specialist.id,
        specialist_workflow_deployment_id: deployment.id,
        request_id: requestId,
      });
      return respond({
        error: billing.message,
        code: "billing_restriction",
        billing_reason: billing.reason,
        billing_status: billing.status,
        workflow_runs_used: billing.workflowRunsUsed,
        workflow_run_limit: billing.workflowRunLimit,
      }, 402);
    }

    const now = new Date().toISOString();
    const baseMetadata = {
      initiated_at: now,
      initiated_by: "authenticated_user",
      organization_role: membership.role,
      billing_status: billing.status,
      workflow_runs_before_start: billing.workflowRunsUsed,
      workflow_run_limit: billing.workflowRunLimit,
    };

    const { data: execution, error: executionError } = await admin.from("workflow_executions").insert({
      organization_id: organizationId,
      specialist_id: specialist.id,
      specialist_workflow_deployment_id: deployment.id,
      triggered_by_user_id: user.id,
      trigger_source: "manual",
      request_id: requestId,
      input_payload: inputPayload,
      trigger_metadata: baseMetadata,
      status: "running",
      created_at: now,
    }).select("id, organization_id, specialist_id, status").single();
    if (executionError || !execution) return respond({ error: `Could not register workflow execution: ${executionError?.message || "Unknown error"}` }, 500);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    let routerResponse: Response;

    try {
      routerResponse = await fetch(n8nUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Upshot-Workflow-Secret": n8nSecret },
        body: JSON.stringify({
          execution_id: execution.id,
          organization_id: organizationId,
          digital_specialist_id: specialist.id,
          specialist_workflow_deployment_id: deployment.id,
          triggered_by_user_id: user.id,
          trigger_source: "manual",
          request_id: requestId,
          input_payload: inputPayload,
        }),
        signal: controller.signal,
      });
    } catch (error) {
      clearTimeout(timeout);
      const message = error instanceof Error ? error.message : "n8n request failed";
      await admin.from("workflow_executions").update({
        status: "failed",
        completed_at: new Date().toISOString(),
        trigger_metadata: { ...baseMetadata, delivery_error: message },
      }).eq("id", execution.id).eq("organization_id", organizationId);
      return respond({ execution_id: execution.id, error: "Workflow router could not be reached" }, 502);
    }

    clearTimeout(timeout);
    if (!routerResponse.ok) {
      const responseText = (await routerResponse.text()).slice(0, 2_000);
      await admin.from("workflow_executions").update({
        status: "failed",
        completed_at: new Date().toISOString(),
        trigger_metadata: { ...baseMetadata, delivery_status: routerResponse.status, delivery_error: responseText },
      }).eq("id", execution.id).eq("organization_id", organizationId);
      return respond({ execution_id: execution.id, error: "Workflow router rejected the request" }, 502);
    }

    await admin.from("workflow_executions").update({
      trigger_metadata: { ...baseMetadata, delivered_at: new Date().toISOString(), delivery_status: routerResponse.status },
    }).eq("id", execution.id).eq("organization_id", organizationId);

    return respond({
      execution_id: execution.id,
      organization_id: organizationId,
      digital_specialist_id: specialist.id,
      specialist_workflow_deployment_id: deployment.id,
      triggered_by_user_id: user.id,
      trigger_source: "manual",
      request_id: requestId,
      status: "running",
    }, 202);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    const status = message.includes("Unauthorized") || message.includes("Authorization") ? 401 : 500;
    return respond({ error: message }, status);
  }
});
