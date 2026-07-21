import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { getAuthenticatedUser, getSupabaseAdmin } from "../_shared/supabase-admin.ts";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
    const action = typeof body.action === "string" ? body.action.toLowerCase() : "list";
    if (!UUID_PATTERN.test(organizationId)) return respond({ error: "Valid organization_id is required" }, 400);

    const admin = getSupabaseAdmin();
    const { data: membership } = await admin.from("organization_members").select("id, role")
      .eq("organization_id", organizationId).eq("user_id", user.id).single();
    if (!membership) return respond({ error: "You do not belong to this organization" }, 403);

    const requesterRole = String(membership.role || "member").toLowerCase();
    const canManage = requesterRole === "owner";

    if (action === "list") {
      const { data: members, error: membersError } = await admin.from("organization_members")
        .select("organization_id, user_id, role").eq("organization_id", organizationId);
      if (membersError) throw new Error(membersError.message);

      const memberRows = [];
      for (const item of members || []) {
        const { data: authUser } = await admin.auth.admin.getUserById(item.user_id);
        const metadata = authUser.user?.user_metadata || {};
        memberRows.push({
          user_id: item.user_id,
          email: authUser.user?.email || "",
          first_name: metadata.first_name || null,
          last_name: metadata.last_name || null,
          role: item.role,
          status: "active",
        });
      }

      const { data: invitations, error: invitationsError } = await admin.from("organization_invitations")
        .select("id, email, role, status, invited_at, expires_at")
        .eq("organization_id", organizationId)
        .in("status", ["pending", "accepted", "revoked"])
        .order("invited_at", { ascending: false });
      if (invitationsError) throw new Error(invitationsError.message);

      return respond({ success: true, members: memberRows, invitations: invitations || [], can_manage: canManage, requester_role: requesterRole, requester_user_id: user.id });
    }

    if (!canManage) return respond({ error: "Only the organization owner can manage team access" }, 403);

    if (action === "invite") {
      const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
      const role = typeof body.role === "string" ? body.role.toLowerCase() : "member";
      if (!EMAIL_PATTERN.test(email)) return respond({ error: "A valid email address is required" }, 400);
      if (!["admin", "member"].includes(role)) return respond({ error: "role must be admin or member" }, 400);

      const { data: existingMembers } = await admin.from("organization_members").select("user_id").eq("organization_id", organizationId);
      for (const existing of existingMembers || []) {
        const { data: authUser } = await admin.auth.admin.getUserById(existing.user_id);
        if (String(authUser.user?.email || "").toLowerCase() === email) return respond({ error: "This person is already a workspace member" }, 409);
      }

      const { data: invitation, error: invitationError } = await admin.from("organization_invitations").insert({
        organization_id: organizationId,
        email,
        role,
        invited_by_user_id: user.id,
      }).select("id, email, role, status, invited_at, expires_at").single();
      if (invitationError || !invitation) return respond({ error: invitationError?.message || "Invitation could not be created" }, 409);

      const appUrl = Deno.env.get("APP_URL") || "https://app.upshottheory.com";
      const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${appUrl}/login`,
        data: { upshot_invitation_id: invitation.id, upshot_organization_id: organizationId, upshot_role: role },
      });
      if (inviteError) {
        await admin.from("organization_invitations").update({ status: "revoked", revoked_at: new Date().toISOString() }).eq("id", invitation.id);
        return respond({ error: inviteError.message }, 502);
      }

      await admin.from("activity_logs").insert({
        organization_id: organizationId,
        digital_specialist_id: null,
        activity_type: "organization_invitation_created",
        title: "Workspace invitation sent",
        description: `${email} was invited as ${role}.`,
        severity: "success",
        metadata: { invitation_id: invitation.id, email, role, invited_by_user_id: user.id },
      });

      return respond({ success: true, invitation }, 201);
    }

    if (action === "revoke") {
      const invitationId = typeof body.invitation_id === "string" ? body.invitation_id : "";
      if (!UUID_PATTERN.test(invitationId)) return respond({ error: "Valid invitation_id is required" }, 400);
      const now = new Date().toISOString();
      const { data: invitation, error } = await admin.from("organization_invitations")
        .update({ status: "revoked", revoked_at: now })
        .eq("id", invitationId).eq("organization_id", organizationId).eq("status", "pending")
        .select("id, email, role, status, invited_at, expires_at").single();
      if (error || !invitation) return respond({ error: "Pending invitation was not found" }, 404);
      return respond({ success: true, invitation });
    }

    if (action === "update_role") {
      const memberUserId = typeof body.member_user_id === "string" ? body.member_user_id : "";
      const role = typeof body.role === "string" ? body.role.toLowerCase() : "";
      if (!UUID_PATTERN.test(memberUserId)) return respond({ error: "Valid member_user_id is required" }, 400);
      if (!["admin", "member"].includes(role)) return respond({ error: "role must be admin or member" }, 400);
      if (memberUserId === user.id) return respond({ error: "The Owner role cannot be changed here" }, 409);

      const { data: target, error: targetError } = await admin.from("organization_members")
        .select("user_id, role").eq("organization_id", organizationId).eq("user_id", memberUserId).single();
      if (targetError || !target) return respond({ error: "Workspace member was not found" }, 404);
      if (String(target.role).toLowerCase() === "owner") return respond({ error: "Owner transfer is not available" }, 409);

      const { error: updateError } = await admin.from("organization_members")
        .update({ role }).eq("organization_id", organizationId).eq("user_id", memberUserId);
      if (updateError) return respond({ error: updateError.message }, 500);

      const { data: authUser } = await admin.auth.admin.getUserById(memberUserId);
      const email = authUser.user?.email || "Workspace member";
      await admin.from("activity_logs").insert({
        organization_id: organizationId,
        digital_specialist_id: null,
        activity_type: "organization_member_role_updated",
        title: "Workspace role updated",
        description: `${email} was changed to ${role}.`,
        severity: "warning",
        metadata: { member_user_id: memberUserId, previous_role: target.role, role, changed_by_user_id: user.id },
      });

      return respond({ success: true, member_user_id: memberUserId, role });
    }

    if (action === "remove_member") {
      const memberUserId = typeof body.member_user_id === "string" ? body.member_user_id : "";
      if (!UUID_PATTERN.test(memberUserId)) return respond({ error: "Valid member_user_id is required" }, 400);
      if (memberUserId === user.id) return respond({ error: "The Owner cannot remove their own access" }, 409);

      const { data: target, error: targetError } = await admin.from("organization_members")
        .select("user_id, role").eq("organization_id", organizationId).eq("user_id", memberUserId).single();
      if (targetError || !target) return respond({ error: "Workspace member was not found" }, 404);
      if (String(target.role).toLowerCase() === "owner") return respond({ error: "The Owner cannot be removed" }, 409);

      const { data: authUser } = await admin.auth.admin.getUserById(memberUserId);
      const email = authUser.user?.email || "Workspace member";

      const { error: deleteError } = await admin.from("organization_members")
        .delete().eq("organization_id", organizationId).eq("user_id", memberUserId);
      if (deleteError) return respond({ error: deleteError.message }, 500);

      const { data: profile } = await admin.from("profiles").select("active_organization_id").eq("id", memberUserId).maybeSingle();
      if (profile?.active_organization_id === organizationId) {
        const { data: fallbackMembership } = await admin.from("organization_members")
          .select("organization_id").eq("user_id", memberUserId).limit(1).maybeSingle();
        await admin.from("profiles").update({ active_organization_id: fallbackMembership?.organization_id || null }).eq("id", memberUserId);
      }

      await admin.from("activity_logs").insert({
        organization_id: organizationId,
        digital_specialist_id: null,
        activity_type: "organization_member_removed",
        title: "Workspace access removed",
        description: `${email} was removed from the workspace.`,
        severity: "warning",
        metadata: { member_user_id: memberUserId, previous_role: target.role, removed_by_user_id: user.id, email },
      });

      return respond({ success: true, member_user_id: memberUserId, removed_role: target.role });
    }

    return respond({ error: "action must be list, invite, revoke, update_role, or remove_member" }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("[manage-team-access]", message);
    return respond({ error: message }, 500);
  }
});
