/**
 * Trusted server-to-server entry point for automated connected-system events.
 * Deploy with JWT verification disabled; X-Upshot-System-Secret authenticates it.
 */
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { getSupabaseAdmin } from "../_shared/supabase-admin.ts";

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

function secretsMatch(received: string, expected: string): boolean {
  const encoder = new TextEncoder();
  const left = encoder.encode(received);
  const right = encoder.encode(expected);
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  if (req.method !== "POST") return respond({ error: "Method not allowed" }, 405);

  try {
    const expectedSystemSecret = Deno.env.get("UPSHOT_SYSTEM_TRIGGER_SECRET");
    const receivedSystemSecret = req.headers.get("X-Upshot-System-Secret") || "";
    if (!expectedSystemSecret || !receivedSystemSecret || !secretsMatch(receivedSystemSecret, expectedSystemSecret)) {
      return respond({ error: "Unauthorized system trigger" }, 401);
    }

    const n8nUrl = Deno.env.get("N8N_WORKFLOW_TRIGGER_URL");
    const n8nSecret = Deno.env.get("N8N_WORKFLOW_TRIGGER_SECRET");
    if (!n8nUrl || !n8nSecret) {
      return respond({ error: "Workflow routing is not configured on this server" }, 500);
    }

    const body = await req.json().catch(() => ({}));
    const integrationId = typeof body.integration_id === "string" ? body.integration_id : "";
    const deploymentId = typeof body.specialist_workflow_deployment_id === "string"
      ? body.specialist_workflow_deployment_id
      : "";
    const externalEventId = typeof body.external_event_id === "string"
      ? body.external_event_id.trim()
      : "";
    const eventType = typeof body.event_type === "string" && body.event_type.trim()
      ? body.event_type.trim().slice(0, 100)
      : "integration_event";
    const inputPayload = body.input_payload ?? {};

    if (!UUID_PATTERN.test(integrationId)) {
      return respond({ error: "A valid integration_id is required" }, 400);
    }
    if (!UUID_PATTERN.test(deploymentId)) {
      return respond({ error: "A valid specialist_workflow_deployment_id is required" }, 400);
    }
    if (!externalEventId || externalEventId.length > 512) {
      return respond({ error: "external_event_id must contain between 1 and 512 characters" }, 400);
    }
    if (!isJsonObject(inputPayload)) {
      return respond({ error: "input_payload must be a JSON object" }, 400);
    }
    if (JSON.stringify(inputPayload).length > 100_000) {
      return respond({ error: "input_payload is too large" }, 413);
    }

    const admin = getSupabaseAdmin();
    const { data: integration } = await admin
      .from("integrations")
      .select("id, organization_id, digital_specialist_id, status, provider_key, provider_name, external_account_email")
      .eq("id", integrationId)
      .single();
    if (!integration) {
      return respond({ error: "The source integration was not found" }, 404);
    }
    if (String(integration.status || "").toLowerCase() !== "connected") {
      return respond({ error: "The source integration is not connected" }, 409);
    }
    if (!integration.organization_id || !integration.digital_specialist_id) {
      return respond({ error: "The integration is not assigned to a Digital Specialist" }, 409);
    }

    const organizationId = integration.organization_id;
    const specialistId = integration.digital_specialist_id;

    const { data: deployment } = await admin
      .from("specialist_workflow_deployments")
      .select("id, organization_id, specialist_id, status")
      .eq("id", deploymentId)
      .eq("organization_id", organizationId)
      .eq("specialist_id", specialistId)
      .single();
    if (!deployment) {
      return respond({ error: "The capability deployment does not match the source integration" }, 404);
    }
    if (!ACTIVE_STATUSES.has(String(deployment.status || "").toLowerCase())) {
      return respond({ error: "This capability is not active" }, 409);
    }

    const { data: specialist } = await admin
      .from("digital_specialists")
      .select("id, status, framework_lifecycle_status")
      .eq("id", specialistId)
      .eq("organization_id", organizationId)
      .single();
    if (!specialist) {
      return respond({ error: "The assigned Digital Specialist was not found" }, 404);
    }
    const specialistStatuses = [specialist.status, specialist.framework_lifecycle_status]
      .filter(Boolean)
      .map((value) => String(value).toLowerCase());
    if (!specialistStatuses.some((status) => ACTIVE_STATUSES.has(status))) {
      return respond({ error: "The assigned Digital Specialist is not active" }, 409);
    }

    const duplicateQuery = () => admin
      .from("workflow_executions")
      .select("id, status, organization_id, specialist_id, specialist_workflow_deployment_id")
      .eq("source_integration_id", integrationId)
      .eq("specialist_workflow_deployment_id", deploymentId)
      .eq("external_event_id", externalEventId)
      .limit(1);

    const { data: existingExecutions, error: existingError } = await duplicateQuery();
    if (existingError) {
      return respond({ error: `Could not verify event idempotency: ${existingError.message}` }, 500);
    }
    if (existingExecutions?.length) {
      const existing = existingExecutions[0];
      return respond({
        execution_id: existing.id,
        organization_id: existing.organization_id,
        digital_specialist_id: existing.specialist_id,
        specialist_workflow_deployment_id: existing.specialist_workflow_deployment_id,
        status: existing.status,
        duplicate: true,
      });
    }

    const requestId = crypto.randomUUID();
    const now = new Date().toISOString();
    const baseMetadata = {
      initiated_at: now,
      initiated_by: "connected_system",
      event_type: eventType,
      provider_key: integration.provider_key,
      provider_name: integration.provider_name,
      external_account_email: integration.external_account_email,
    };

    const { data: execution, error: executionError } = await admin
      .from("workflow_executions")
      .insert({
        organization_id: organizationId,
        specialist_id: specialistId,
        specialist_workflow_deployment_id: deploymentId,
        triggered_by_user_id: null,
        source_integration_id: integrationId,
        external_event_id: externalEventId,
        trigger_source: "integration",
        request_id: requestId,
        input_payload: inputPayload,
        trigger_metadata: baseMetadata,
        status: "running",
        created_at: now,
      })
      .select("id, organization_id, specialist_id, status")
      .single();

    if (executionError || !execution) {
      if (executionError?.code === "23505") {
        const { data: duplicateExecutions } = await duplicateQuery();
        if (duplicateExecutions?.length) {
          const duplicate = duplicateExecutions[0];
          return respond({
            execution_id: duplicate.id,
            organization_id: duplicate.organization_id,
            digital_specialist_id: duplicate.specialist_id,
            specialist_workflow_deployment_id: duplicate.specialist_workflow_deployment_id,
            status: duplicate.status,
            duplicate: true,
          });
        }
      }
      return respond({ error: `Could not register system execution: ${executionError?.message || "Unknown error"}` }, 500);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    let routerResponse: Response;

    try {
      routerResponse = await fetch(n8nUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Upshot-Workflow-Secret": n8nSecret,
        },
        body: JSON.stringify({
          execution_id: execution.id,
          organization_id: organizationId,
          digital_specialist_id: specialistId,
          specialist_workflow_deployment_id: deploymentId,
          triggered_by_user_id: null,
          source_integration_id: integrationId,
          external_event_id: externalEventId,
          trigger_source: "integration",
          event_type: eventType,
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
        trigger_metadata: {
          ...baseMetadata,
          delivery_status: routerResponse.status,
          delivery_error: responseText,
        },
      }).eq("id", execution.id).eq("organization_id", organizationId);
      return respond({ execution_id: execution.id, error: "Workflow router rejected the request" }, 502);
    }

    await admin.from("workflow_executions").update({
      trigger_metadata: {
        ...baseMetadata,
        delivered_at: new Date().toISOString(),
        delivery_status: routerResponse.status,
      },
    }).eq("id", execution.id).eq("organization_id", organizationId);

    return respond({
      execution_id: execution.id,
      organization_id: organizationId,
      digital_specialist_id: specialistId,
      specialist_workflow_deployment_id: deploymentId,
      triggered_by_user_id: null,
      source_integration_id: integrationId,
      external_event_id: externalEventId,
      trigger_source: "integration",
      event_type: eventType,
      request_id: requestId,
      status: "running",
    }, 202);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return respond({ error: message }, 500);
  }
});
