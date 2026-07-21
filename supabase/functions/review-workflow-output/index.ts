import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { getAuthenticatedUser, getSupabaseAdmin } from "../_shared/supabase-admin.ts";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALLOWED_ACTIONS = ["approve", "request_changes", "dismiss"];

function respond(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  if (req.method !== "POST") return respond({ error: "Method not allowed" }, 405);

  try {
    const user = await getAuthenticatedUser(req);
    const body = await req.json().catch(() => ({}));
    const organizationId = typeof body.organization_id === "string" ? body.organization_id : "";
    const executionId = typeof body.execution_id === "string" ? body.execution_id : "";
    const action = typeof body.action === "string" ? body.action.toLowerCase() : "";
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 2000) : "";

    if (!UUID_PATTERN.test(organizationId) || !UUID_PATTERN.test(executionId)) {
      return respond({ error: "Valid organization_id and execution_id are required" }, 400);
    }
    if (!ALLOWED_ACTIONS.includes(action)) {
      return respond({ error: "action must be approve, request_changes, or dismiss" }, 400);
    }

    const admin = getSupabaseAdmin();
    const { data: membership } = await admin
      .from("organization_members")
      .select("id, role")
      .eq("organization_id", organizationId)
      .eq("user_id", user.id)
      .single();

    if (!membership) return respond({ error: "You do not belong to this organization" }, 403);

    const { data: execution } = await admin
      .from("workflow_executions")
      .select("id, digital_specialist_id, trigger_metadata, output_summary, status")
      .eq("id", executionId)
      .eq("organization_id", organizationId)
      .single();

    if (!execution) return respond({ error: "Workflow execution was not found" }, 404);

    const output = execution.output_summary && typeof execution.output_summary === "object"
      ? execution.output_summary as Record<string, unknown>
      : {};
    const gmailDraft = output.gmail_draft && typeof output.gmail_draft === "object";
    const followUpEmail = output.follow_up_email && typeof output.follow_up_email === "object";
    if (!gmailDraft && !followUpEmail) {
      return respond({ error: "This execution does not contain a reviewable email draft" }, 409);
    }

    const now = new Date().toISOString();
    const reviewStatus = action === "approve" ? "approved" : action === "request_changes" ? "changes_requested" : "dismissed";
    const existingMetadata = execution.trigger_metadata && typeof execution.trigger_metadata === "object"
      ? execution.trigger_metadata as Record<string, unknown>
      : {};
    const review = {
      status: reviewStatus,
      note: note || null,
      reviewed_at: now,
      reviewed_by_user_id: user.id,
      reviewed_by_role: membership.role || "member",
    };

    const { error: updateError } = await admin
      .from("workflow_executions")
      .update({
        trigger_metadata: {
          ...existingMetadata,
          human_review: review,
        },
        updated_at: now,
      })
      .eq("id", executionId)
      .eq("organization_id", organizationId);

    if (updateError) throw new Error(`Could not save review: ${updateError.message}`);

    await admin.from("activity_logs").insert({
      organization_id: organizationId,
      digital_specialist_id: execution.digital_specialist_id || null,
      activity_type: `workflow_output_${reviewStatus}`,
      title: reviewStatus === "approved" ? "Draft approved" : reviewStatus === "changes_requested" ? "Changes requested" : "Draft dismissed",
      description: note || (reviewStatus === "approved" ? "A team member approved the prepared follow up draft." : reviewStatus === "changes_requested" ? "A team member requested changes to the prepared follow up draft." : "A team member dismissed the prepared follow up draft."),
      severity: reviewStatus === "approved" ? "success" : "warning",
      metadata: {
        execution_id: executionId,
        review_status: reviewStatus,
        reviewed_by_user_id: user.id,
      },
    });

    return respond({ success: true, execution_id: executionId, review });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("[review-workflow-output]", message);
    return respond({ error: message }, 500);
  }
});
