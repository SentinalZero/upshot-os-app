import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { getAuthenticatedUser, getSupabaseAdmin } from "../_shared/supabase-admin.ts";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MODES = ["draft_only", "approval_required", "auto_send_after_approval"];
const ROLES = ["owner", "admin", "member"];

function respond(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function normalizeRoles(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(String).map(role => role.toLowerCase()).filter(role => ROLES.includes(role)))];
}

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  if (req.method !== "POST") return respond({ error: "Method not allowed" }, 405);

  try {
    const user = await getAuthenticatedUser(req);
    const body = await req.json().catch(() => ({}));
    const organizationId = typeof body.organization_id === "string" ? body.organization_id : "";
    const action = typeof body.action === "string" ? body.action.toLowerCase() : "get";
    if (!UUID_PATTERN.test(organizationId)) return respond({ error: "Valid organization_id is required" }, 400);

    const admin = getSupabaseAdmin();
    const { data: membership } = await admin.from("organization_members").select("role")
      .eq("organization_id", organizationId).eq("user_id", user.id).single();
    if (!membership) return respond({ error: "You do not belong to this organization" }, 403);

    const requesterRole = String(membership.role || "member").toLowerCase();
    const canManage = requesterRole === "owner";

    if (action === "get") {
      const { data, error } = await admin.from("organization_approval_policies")
        .select("organization_id, email_mode, approver_roles, sender_roles, updated_at")
        .eq("organization_id", organizationId).maybeSingle();
      if (error) throw new Error(error.message);
      const policy = data || {
        organization_id: organizationId,
        email_mode: "draft_only",
        approver_roles: ["owner", "admin"],
        sender_roles: ["owner", "admin"],
        updated_at: null,
      };
      return respond({ success: true, policy, can_manage: canManage, requester_role: requesterRole });
    }

    if (!canManage) return respond({ error: "Only the organization owner can change approval policies" }, 403);
    if (action !== "update") return respond({ error: "action must be get or update" }, 400);

    const emailMode = typeof body.email_mode === "string" ? body.email_mode.toLowerCase() : "";
    const approverRoles = normalizeRoles(body.approver_roles);
    const senderRoles = normalizeRoles(body.sender_roles);
    if (!MODES.includes(emailMode)) return respond({ error: "Invalid email_mode" }, 400);
    if (!approverRoles.length || !senderRoles.length) return respond({ error: "At least one approver and sender role is required" }, 400);

    const now = new Date().toISOString();
    const { data: previous } = await admin.from("organization_approval_policies")
      .select("email_mode, approver_roles, sender_roles").eq("organization_id", organizationId).maybeSingle();

    const { data: policy, error: updateError } = await admin.from("organization_approval_policies").upsert({
      organization_id: organizationId,
      email_mode: emailMode,
      approver_roles: approverRoles,
      sender_roles: senderRoles,
      updated_by_user_id: user.id,
      updated_at: now,
    }, { onConflict: "organization_id" }).select("organization_id, email_mode, approver_roles, sender_roles, updated_at").single();
    if (updateError || !policy) return respond({ error: updateError?.message || "Policy could not be saved" }, 500);

    await admin.from("activity_logs").insert({
      organization_id: organizationId,
      digital_specialist_id: null,
      activity_type: "organization_approval_policy_updated",
      title: "Approval policy updated",
      description: `Email workflow mode changed to ${emailMode.replaceAll("_", " ")}.`,
      severity: emailMode === "auto_send_after_approval" ? "warning" : "success",
      metadata: { previous, policy, changed_by_user_id: user.id },
    });

    return respond({ success: true, policy });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("[manage-organization-policy]", message);
    return respond({ error: message }, 500);
  }
});
