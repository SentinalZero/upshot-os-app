import { supabase } from "./supabase";

export interface TeamMember {
  user_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: string;
  status: "active";
}

export interface TeamInvitation {
  id: string;
  email: string;
  role: string;
  status: "pending" | "accepted" | "revoked" | "expired";
  invited_at: string;
  expires_at: string;
}

export interface TeamAccessSnapshot {
  members: TeamMember[];
  invitations: TeamInvitation[];
  canManage: boolean;
  requesterRole: string;
  requesterUserId: string;
}

async function invoke(body: Record<string, unknown>) {
  if (!supabase) return { data: null, error: "Supabase is not configured." };
  const { data, error } = await supabase.functions.invoke("manage-team-access", { body });
  if (!error) return { data, error: data?.error ? String(data.error) : null };
  const context = (error as { context?: { json?: () => Promise<unknown> } }).context;
  if (context?.json) {
    try {
      const response = await context.json() as { error?: string };
      if (response.error) return { data: null, error: response.error };
    } catch {
      // Fall through.
    }
  }
  return { data: null, error: error.message || "Team access could not be updated." };
}

export async function fetchTeamAccess(organizationId: string): Promise<{ data: TeamAccessSnapshot | null; error: string | null }> {
  const result = await invoke({ action: "list", organization_id: organizationId });
  if (result.error || !result.data) return { data: null, error: result.error || "Team access could not be loaded." };
  return {
    data: {
      members: Array.isArray(result.data.members) ? result.data.members : [],
      invitations: Array.isArray(result.data.invitations) ? result.data.invitations : [],
      canManage: result.data.can_manage === true,
      requesterRole: String(result.data.requester_role || "member"),
      requesterUserId: String(result.data.requester_user_id || ""),
    },
    error: null,
  };
}

export async function inviteTeamMember(organizationId: string, email: string, role: "admin" | "member") {
  const result = await invoke({ action: "invite", organization_id: organizationId, email, role });
  return { success: !result.error && result.data?.success === true, error: result.error };
}

export async function revokeTeamInvitation(organizationId: string, invitationId: string) {
  const result = await invoke({ action: "revoke", organization_id: organizationId, invitation_id: invitationId });
  return { success: !result.error && result.data?.success === true, error: result.error };
}

export async function updateTeamMemberRole(organizationId: string, userId: string, role: "admin" | "member") {
  const result = await invoke({ action: "update_role", organization_id: organizationId, member_user_id: userId, role });
  return { success: !result.error && result.data?.success === true, error: result.error };
}
