/**
 * poll-all-google-calendar-events
 *
 * Shared multi-tenant scheduler entry point. Discovers every connected Google
 * Workspace integration, resolves its active Meeting Summary deployment, and
 * calls the existing per-integration calendar worker in isolation.
 */
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { getSupabaseAdmin } from "../_shared/supabase-admin.ts";

const ACTIVE_STATUSES = new Set(["active", "deployed", "ready", "running"]);
const DEFAULT_LOOKBACK_MINUTES = 30;
const MAX_LOOKBACK_MINUTES = 180;
const DEFAULT_BATCH_SIZE = 100;
const MAX_BATCH_SIZE = 500;
const CONCURRENCY = 5;

function respond(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
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

function clampInteger(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(parsed)));
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deploymentScore(row: Record<string, unknown>): number {
  const text = JSON.stringify(row).toLowerCase();
  let score = 0;
  if (text.includes("meeting summary")) score += 100;
  if (text.includes("meeting_summary")) score += 100;
  if (text.includes("meeting-summary")) score += 100;
  if (text.includes("google_calendar.meeting_ended")) score += 80;
  if (text.includes("calendar")) score += 20;
  if (text.includes("meeting")) score += 20;
  if (text.includes("summary")) score += 20;
  return score;
}

function chooseMeetingSummaryDeployment(rows: Record<string, unknown>[]) {
  const active = rows.filter((row) => ACTIVE_STATUSES.has(String(row.status || "").toLowerCase()));
  if (active.length === 0) return { deployment: null, reason: "no_active_deployment" };
  if (active.length === 1) return { deployment: active[0], reason: null };

  const ranked = active
    .map((row) => ({ row, score: deploymentScore(row) }))
    .sort((left, right) => right.score - left.score);

  if (ranked[0].score > 0 && ranked[0].score > ranked[1].score) {
    return { deployment: ranked[0].row, reason: null };
  }

  return { deployment: null, reason: "ambiguous_active_deployments" };
}

async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  async function consume() {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      results[index] = await worker(items[index]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => consume()));
  return results;
}

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  if (req.method !== "POST") return respond({ error: "Method not allowed" }, 405);

  try {
    const expectedSecret = Deno.env.get("UPSHOT_SYSTEM_TRIGGER_SECRET");
    const receivedSecret = req.headers.get("X-Upshot-System-Secret") || "";
    if (!expectedSecret || !receivedSecret || !secretsMatch(receivedSecret, expectedSecret)) {
      return respond({ error: "Unauthorized multi-tenant calendar intake" }, 401);
    }

    const body = await req.json().catch(() => ({}));
    if (!isObject(body)) return respond({ error: "Request body must be a JSON object" }, 400);

    const lookbackMinutes = clampInteger(
      body.lookback_minutes,
      DEFAULT_LOOKBACK_MINUTES,
      5,
      MAX_LOOKBACK_MINUTES,
    );
    const batchSize = clampInteger(body.batch_size, DEFAULT_BATCH_SIZE, 1, MAX_BATCH_SIZE);
    const includeSoloEvents = body.include_solo_events === true;
    const dryRun = body.dry_run === true;

    const admin = getSupabaseAdmin();
    const { data: integrations, error: integrationError } = await admin
      .from("integrations")
      .select("id, organization_id, digital_specialist_id, external_account_email, status, provider_key")
      .eq("provider_key", "google_workspace")
      .eq("status", "connected")
      .not("digital_specialist_id", "is", null)
      .order("created_at", { ascending: true })
      .limit(batchSize);

    if (integrationError) {
      return respond({ error: `Could not discover Google integrations: ${integrationError.message}` }, 500);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    if (!supabaseUrl) return respond({ error: "SUPABASE_URL is not configured" }, 500);

    const results = await runWithConcurrency(integrations || [], CONCURRENCY, async (integration) => {
      const baseResult = {
        integration_id: integration.id,
        organization_id: integration.organization_id,
        digital_specialist_id: integration.digital_specialist_id,
        account_email: integration.external_account_email,
      };

      try {
        const { data: deployments, error: deploymentError } = await admin
          .from("specialist_workflow_deployments")
          .select("*")
          .eq("organization_id", integration.organization_id)
          .eq("specialist_id", integration.digital_specialist_id);

        if (deploymentError) {
          return { ...baseResult, processed: false, reason: "deployment_lookup_failed", error: deploymentError.message };
        }

        const selection = chooseMeetingSummaryDeployment((deployments || []) as Record<string, unknown>[]);
        if (!selection.deployment) {
          return { ...baseResult, processed: false, reason: selection.reason };
        }

        const deploymentId = String(selection.deployment.id || "");
        const workerResponse = await fetch(`${supabaseUrl}/functions/v1/poll-google-calendar-events`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Upshot-System-Secret": expectedSecret,
          },
          body: JSON.stringify({
            integration_id: integration.id,
            specialist_workflow_deployment_id: deploymentId,
            lookback_minutes: lookbackMinutes,
            include_solo_events: includeSoloEvents,
            dry_run: dryRun,
          }),
        });

        const responseText = await workerResponse.text();
        let workerBody: Record<string, unknown> = {};
        try {
          workerBody = responseText ? JSON.parse(responseText) : {};
        } catch {
          workerBody = { raw_response: responseText.slice(0, 500) };
        }

        return {
          ...baseResult,
          specialist_workflow_deployment_id: deploymentId,
          processed: workerResponse.ok,
          http_status: workerResponse.status,
          executions_started: Number(workerBody.executions_started || 0),
          duplicates: Number(workerBody.duplicates || 0),
          failed_deliveries: Number(workerBody.failed_deliveries || 0),
          candidate_meetings: Number(workerBody.candidate_meetings || 0),
          error: typeof workerBody.error === "string" ? workerBody.error : null,
        };
      } catch (error) {
        return {
          ...baseResult,
          processed: false,
          reason: "unexpected_tenant_error",
          error: error instanceof Error ? error.message : String(error),
        };
      }
    });

    const processed = results.filter((result) => result.processed === true);
    const skipped = results.filter((result) => result.processed !== true);

    return respond({
      dry_run: dryRun,
      lookback_minutes: lookbackMinutes,
      integrations_discovered: (integrations || []).length,
      integrations_processed: processed.length,
      integrations_skipped: skipped.length,
      executions_started: processed.reduce((sum, result) => sum + Number(result.executions_started || 0), 0),
      duplicates: processed.reduce((sum, result) => sum + Number(result.duplicates || 0), 0),
      failed_deliveries: processed.reduce((sum, result) => sum + Number(result.failed_deliveries || 0), 0),
      results,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("[poll-all-google-calendar-events] Unexpected error:", message);
    return respond({ error: message }, 500);
  }
});
