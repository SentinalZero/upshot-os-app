import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { getAuthenticatedUser, getSupabaseAdmin } from "../_shared/supabase-admin.ts";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ACTIVE_EXECUTION_STATUSES = ["queued", "pending", "running", "in_progress", "processing"];

function respond(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  if (req.method !== "POST") return respond({ error: "Method not allowed" }, 405);

  try {
    const user = await getAuthenticatedUser(req);
    const body = await req.json().catch(() => ({}));
    const organizationId = typeof body.organization_id === "string" ? body.organization_id : "";
    const specialistId = typeof body.specialist_id === "string" ? body.specialist_id : "";
    const action = typeof body.action === "string" ? body.action.toLowerCase() : "";

    if (!UUID_PATTERN.test(organizationId) || !UUID_PATTERN.test(specialistId)) {
      return respond({ error: "Valid organization_id and specialist_id are required" }, 400);
    }
    if (!["deactivate", "reactivate", "delete"].includes(action)) {
      return respond({ error: "action must be deactivate, reactivate, or delete" }, 400);
    }

    const admin = getSupabaseAdmin();
    const { data: membership } = await admin.from("organization_members")
      .select("id, role").eq("organization_id", organizationId).eq("user_id", user.id).single();
    if (!membership) return respond({ error: "You do not belong to this organization" }, 403);
    if (!["owner", "admin"].includes(String(membership.role || "").toLowerCase())) {
      return respond({ error: "Only organization owners and admins can manage Digital Specialists" }, 403);
    }

    const { data: specialist } = await admin.from("digital_specialists")
      .select("id, name, status").eq("id", specialistId).eq("organization_id", organizationId).single();
    if (!specialist) return respond({ error: "Digital Specialist was not found" }, 404);

    const { count: activeJobs } = await admin.from("workflow_executions")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId).eq("specialist_id", specialistId)
      .in("status", ACTIVE_EXECUTION_STATUSES);
    if ((activeJobs || 0) > 0) {
      return respond({ error: "This Digital Specialist has active work and cannot be changed yet", active_jobs: activeJobs }, 409);
    }

    const now = new Date().toISOString();

    if (action === "deactivate") {
      await admin.from("specialist_workflow_deployments").update({ status: "inactive", updated_at: now })
        .eq("organization_id", organizationId).eq("specialist_id", specialistId);
      await admin.from("integrations").update({ status: "disconnected", updated_at: now })
        .eq("organization_id", organizationId).eq("digital_specialist_id", specialistId);
      const { error } = await admin.from("digital_specialists")
        .update({ status: "inactive", framework_lifecycle_status: "inactive", paused_at: now, updated_at: now })
        .eq("id", specialistId).eq("organization_id", organizationId);
      if (error) throw new Error(`Could not deactivate Digital Specialist: ${error.message}`);
    }

    if (action === "reactivate") {
      const { error } = await admin.from("digital_specialists")
        .update({ status: "active", framework_lifecycle_status: "active", paused_at: null, updated_at: now })
        .eq("id", specialistId).eq("organization_id", organizationId);
      if (error) throw new Error(`Could not reactivate Digital Specialist: ${error.message}`);
    }

    if (action === "delete") {
      const [{ count: historyCount }, { count: integrationCount }, { count: deploymentCount }] = await Promise.all([
        admin.from("workflow_executions").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("specialist_id", specialistId),
        admin.from("integrations").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("digital_specialist_id", specialistId),
        admin.from("specialist_workflow_deployments").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("specialist_id", specialistId),
      ]);
      if ((historyCount || 0) > 0 || (integrationCount || 0) > 0 || (deploymentCount || 0) > 0) {
        return respond({
          error: "This Digital Specialist has retained history or assigned systems. Deactivate it instead.",
          workflow_history: historyCount || 0,
          integrations: integrationCount || 0,
          capabilities: deploymentCount || 0,
        }, 409);
      }
      const { error } = await admin.from("digital_specialists").delete()
        .eq("id", specialistId).eq("organization_id", organizationId);
      if (error) throw new Error(`Could not delete Digital Specialist: ${error.message}`);
    }

    await admin.from("activity_logs").insert({
      organization_id: organizationId,
      digital_specialist_id: action === "delete" ? null : specialistId,
      activity_type: `digital_specialist_${action}`,
      title: action === "delete" ? "Digital Specialist removed" : `Digital Specialist ${action}d`,
      description: `${specialist.name || "Digital Specialist"} was ${action}d by an organization administrator.`,
      severity: action === "reactivate" ? "success" : "warning",
      metadata: { specialist_id: specialistId, managed_by_user_id: user.id, action },
    });

    return respond({ specialist_id: specialistId, organization_id: organizationId, action, success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("[manage-digital-specialist]", message);
    return respond({ error: message }, 500);
  }
});
