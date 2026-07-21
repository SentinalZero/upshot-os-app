import { supabase } from "./supabase";

export type EmailPolicyMode = "draft_only" | "approval_required" | "auto_send_after_approval";
export type WorkspaceRole = "owner" | "admin" | "member";

export interface OrganizationApprovalPolicy {
  organization_id: string;
  email_mode: EmailPolicyMode;
  approver_roles: WorkspaceRole[];
  sender_roles: WorkspaceRole[];
  updated_at: string | null;
}

export interface OrganizationPolicySnapshot {
  policy: OrganizationApprovalPolicy;
  canManage: boolean;
  requesterRole: string;
}

async function invoke(body: Record<string, unknown>) {
  if (!supabase) return { data: null, error: "Supabase is not configured." };
  const { data, error } = await supabase.functions.invoke("manage-organization-policy", { body });
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
  return { data: null, error: error.message || "Organization policy could not be updated." };
}

export async function fetchOrganizationPolicy(organizationId: string): Promise<{ data: OrganizationPolicySnapshot | null; error: string | null }> {
  const result = await invoke({ action: "get", organization_id: organizationId });
  if (result.error || !result.data?.policy) return { data: null, error: result.error || "Organization policy could not be loaded." };
  return {
    data: {
      policy: result.data.policy as OrganizationApprovalPolicy,
      canManage: result.data.can_manage === true,
      requesterRole: String(result.data.requester_role || "member"),
    },
    error: null,
  };
}

export async function updateOrganizationPolicy(organizationId: string, policy: Pick<OrganizationApprovalPolicy, "email_mode" | "approver_roles" | "sender_roles">) {
  const result = await invoke({ action: "update", organization_id: organizationId, ...policy });
  return { success: !result.error && result.data?.success === true, policy: result.data?.policy as OrganizationApprovalPolicy | undefined, error: result.error };
}
