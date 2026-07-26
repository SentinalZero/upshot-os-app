import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface ContinueRequest {
  organizationId?: string;
  executionId?: string;
  decisionId?: string;
  decisionStatus?: string;
}

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isSafeContinuationUrl(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim()) return false;

  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;

    const host = url.hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1" || host === "::1") return false;
    if (host.startsWith("10.") || host.startsWith("192.168.")) return false;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return false;
    if (host.endsWith(".local") || host.endsWith(".internal")) return false;

    return true;
  } catch {
    return false;
  }
}

function getContinuationUrl(execution: Record<string, unknown>): string | null {
  const metadata = (execution.metadata || {}) as Record<string, unknown>;
  const candidates = [
    execution.continuation_url,
    execution.callback_url,
    metadata.continuation_url,
    metadata.resume_url,
    metadata.callback_url,
    metadata.webhook_url,
  ];

  return candidates.find(isSafeContinuationUrl) || null;
}

function getContinuationPayload(execution: Record<string, unknown>): Record<string, unknown> {
  const metadata = (execution.metadata || {}) as Record<string, unknown>;
  const configuredPayload = metadata.continuation_payload || metadata.payload || metadata.input;

  return configuredPayload && typeof configuredPayload === "object" && !Array.isArray(configuredPayload)
    ? configuredPayload as Record<string, unknown>
    : {};
}

Deno.serve(async request => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authorization = request.headers.get("Authorization");

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ error: "Supabase function environment is incomplete." }, 500);
  }
  if (!authorization) return json({ error: "Authorization is required." }, 401);

  let body: ContinueRequest;
  try {
    body = await request.json();
  } catch {
    return json({ error: "A valid JSON body is required." }, 400);
  }

  const { organizationId, executionId, decisionId, decisionStatus } = body;
  if (!organizationId || !executionId) {
    return json({ error: "organizationId and executionId are required." }, 400);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return json({ error: "The current session is not valid." }, 401);

  // Read through the user's client first so existing RLS remains the authorization boundary.
  const { data: visibleExecution, error: executionError } = await userClient
    .from("workflow_executions")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", executionId)
    .single();

  if (executionError || !visibleExecution) {
    return json({ error: "The workflow execution was not found or is not accessible." }, 404);
  }

  if (String(visibleExecution.status || "").toLowerCase() !== "queued") {
    return json({
      dispatched: false,
      reason: "Execution is no longer queued.",
      status: visibleExecution.status,
    });
  }

  const execution = visibleExecution as Record<string, unknown>;
  const continuationUrl = getContinuationUrl(execution);

  if (!continuationUrl) {
    await adminClient.from("activity_logs").insert({
      organization_id: organizationId,
      digital_specialist_id: execution.specialist_id || null,
      event_type: "workflow_continuation_waiting",
      activity_type: "workflow_dispatch",
      title: "Approved workflow is waiting for a continuation endpoint",
      description: "The decision was approved and the execution remains queued. Add metadata.continuation_url to dispatch the next action without n8n.",
      message: "Workflow continuation configuration required",
      severity: "warning",
      metadata: {
        workflow_execution_id: executionId,
        command_decision_id: decisionId || null,
        requires_human_attention: false,
      },
    });

    return json({
      dispatched: false,
      queued: true,
      reason: "No safe continuation URL is configured on this execution.",
    }, 202);
  }

  // Claim the queued item. The status predicate prevents duplicate dispatches.
  const { data: claimed, error: claimError } = await adminClient
    .from("workflow_executions")
    .update({ status: "running", completed_at: null })
    .eq("organization_id", organizationId)
    .eq("id", executionId)
    .eq("status", "queued")
    .select("id")
    .maybeSingle();

  if (claimError) return json({ error: `The execution could not be claimed: ${claimError.message}` }, 500);
  if (!claimed) return json({ dispatched: false, reason: "Another dispatcher already claimed this execution." });

  const continuationSecret = Deno.env.get("WORKFLOW_CONTINUATION_SECRET");
  const payload = {
    ...getContinuationPayload(execution),
    upshot: {
      organization_id: organizationId,
      workflow_execution_id: executionId,
      specialist_id: execution.specialist_id || null,
      command_decision_id: decisionId || null,
      decision_status: decisionStatus || null,
      authorized_by: userData.user.id,
      authorized_at: new Date().toISOString(),
    },
  };

  try {
    const downstream = await fetch(continuationUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(continuationSecret ? { "X-Upshot-Continuation-Secret": continuationSecret } : {}),
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(20_000),
    });

    const responseText = await downstream.text();
    if (!downstream.ok) throw new Error(`Continuation endpoint returned ${downstream.status}: ${responseText.slice(0, 300)}`);

    const completedAt = new Date().toISOString();
    await adminClient
      .from("workflow_executions")
      .update({ status: "successful", completed_at: completedAt })
      .eq("organization_id", organizationId)
      .eq("id", executionId);

    await adminClient.from("activity_logs").insert({
      organization_id: organizationId,
      digital_specialist_id: execution.specialist_id || null,
      event_type: "workflow_continuation_completed",
      activity_type: "workflow_dispatch",
      title: "Approved workflow continued",
      description: "The approved downstream action completed through the Supabase continuation dispatcher.",
      message: "Workflow continuation successful",
      severity: "info",
      metadata: {
        workflow_execution_id: executionId,
        command_decision_id: decisionId || null,
        downstream_status: downstream.status,
        requires_human_attention: false,
      },
    });

    return json({ dispatched: true, completed: true, status: "successful" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown continuation failure.";
    const completedAt = new Date().toISOString();

    await adminClient
      .from("workflow_executions")
      .update({ status: "failed", completed_at: completedAt })
      .eq("organization_id", organizationId)
      .eq("id", executionId);

    await adminClient.from("activity_logs").insert({
      organization_id: organizationId,
      digital_specialist_id: execution.specialist_id || null,
      event_type: "workflow_continuation_failed",
      activity_type: "workflow_dispatch",
      title: "Approved workflow could not continue",
      description: message,
      message: "Workflow continuation failed",
      severity: "warning",
      metadata: {
        workflow_execution_id: executionId,
        command_decision_id: decisionId || null,
        requires_human_attention: true,
      },
    });

    return json({ dispatched: true, completed: false, status: "failed", error: message }, 502);
  }
});
