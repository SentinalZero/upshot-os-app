import { supabase } from "./supabase";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface DigitalSpecialist {
  id: string;
  organization_id: string;
  created_by: string;
  name: string;
  role_key: string;
  role_name: string;
  industry_key: string;
  industry_name: string;
  description: string | null;
  status: string;
  oversight_mode: string;
  selected_systems: string[];
  configuration: Record<string, unknown>;
  deployed_at: string | null;
  created_at: string;
}

export interface Workflow {
  id: string;
  organization_id: string;
  digital_specialist_id: string;
  created_by: string;
  name: string;
  workflow_key: string;
  description: string | null;
  status: string;
  trigger_type: string;
  trigger_configuration: Record<string, unknown>;
  workflow_configuration: Record<string, unknown>;
  baseline_minutes: number | null;
  requires_approval: boolean;
  created_at: string;
}

export interface ActivityLog {
  id: string;
  organization_id: string;
  digital_specialist_id: string | null;
  actor_user_id: string | null;
  activity_type: string;
  title: string;
  description: string | null;
  severity: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function toSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 64);
}

export function mapOversightMode(oversightRules: string[]): "autonomous" | "approval_required" | "escalation_only" {
  // If the user selected approval-type rules, use approval_required
  // If they selected escalation-type rules only, use escalation_only
  // If no rules or minimal rules, default to approval_required for safety
  if (oversightRules.length === 0) return "autonomous";
  
  const escalationKeywords = ["escalat", "route", "handoff"];
  const allEscalation = oversightRules.every(rule =>
    escalationKeywords.some(kw => rule.toLowerCase().includes(kw))
  );
  
  if (allEscalation) return "escalation_only";
  return "approval_required";
}

// ─── Deploy Digital Specialist ───────────────────────────────────────────────

export interface DeployConfig {
  organizationId: string;
  userId: string;
  name: string;
  roleName: string;
  roleKey: string;
  industryName: string;
  industryKey: string;
  description: string;
  oversightMode: "autonomous" | "approval_required" | "escalation_only";
  selectedSystems: string[];
  configuration: Record<string, unknown>;
  tasks: Array<{ name: string; workflowKey: string; description: string }>;
}

export interface DeployResult {
  success: boolean;
  specialistId?: string;
  workflowIds?: string[];
  error?: string;
}

export async function deployDigitalSpecialist(config: DeployConfig): Promise<DeployResult> {
  if (!supabase) return { success: false, error: "Supabase not configured" };

  try {
    // 1. Insert the Digital Specialist
    const { data: specialist, error: specialistError } = await supabase
      .from("digital_specialists")
      .insert({
        organization_id: config.organizationId,
        created_by: config.userId,
        name: config.name,
        role_key: config.roleKey,
        role_name: config.roleName,
        industry_key: config.industryKey,
        industry_name: config.industryName,
        description: config.description || null,
        status: "active",
        oversight_mode: config.oversightMode,
        selected_systems: config.selectedSystems,
        configuration: config.configuration,
        deployed_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (specialistError) {
      console.error("[DeployService] Specialist insert failed:", specialistError);
      return { success: false, error: `Failed to create Digital Specialist: ${specialistError.message}` };
    }

    const specialistId = specialist.id;

    // 2. Insert workflows
    const workflowRecords = config.tasks.map(task => ({
      organization_id: config.organizationId,
      digital_specialist_id: specialistId,
      created_by: config.userId,
      name: task.name,
      workflow_key: task.workflowKey,
      description: task.description || null,
      status: "draft",
      trigger_type: "manual",
      trigger_configuration: {},
      workflow_configuration: {},
      baseline_minutes: null,
      requires_approval: config.oversightMode === "approval_required",
    }));

    const { data: workflows, error: workflowError } = await supabase
      .from("workflows")
      .insert(workflowRecords)
      .select("id");

    if (workflowError) {
      console.error("[DeployService] Workflow insert failed:", workflowError);
      // Specialist was created but workflows failed — report partial failure
      return { success: false, specialistId, error: `Specialist created but workflow creation failed: ${workflowError.message}` };
    }

    const workflowIds = workflows?.map(w => w.id) || [];

    // 3. Insert activity log
    const { error: logError } = await supabase
      .from("activity_logs")
      .insert({
        organization_id: config.organizationId,
        digital_specialist_id: specialistId,
        actor_user_id: config.userId,
        activity_type: "specialist_deployed",
        title: "Digital Specialist deployed",
        description: `${config.name} was successfully deployed.`,
        severity: "success",
        metadata: {
          role: config.roleName,
          industry: config.industryName,
          workflow_count: workflowIds.length,
          selected_systems: config.selectedSystems,
          oversight_mode: config.oversightMode,
        },
      });

    if (logError) {
      console.error("[DeployService] Activity log insert failed:", logError);
      // Non-critical — specialist and workflows are created
    }

    return { success: true, specialistId, workflowIds };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error during deployment";
    console.error("[DeployService] Unexpected error:", err);
    return { success: false, error: message };
  }
}

// ─── Fetch Dashboard Data ────────────────────────────────────────────────────

export async function fetchSpecialists(organizationId: string): Promise<DigitalSpecialist[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("digital_specialists")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[DashboardService] fetchSpecialists error:", error);
    return [];
  }
  return data || [];
}

export async function fetchWorkflowCounts(organizationId: string): Promise<Record<string, number>> {
  if (!supabase) return {};
  const { data, error } = await supabase
    .from("workflows")
    .select("digital_specialist_id")
    .eq("organization_id", organizationId);

  if (error) {
    console.error("[DashboardService] fetchWorkflowCounts error:", error);
    return {};
  }

  const counts: Record<string, number> = {};
  (data || []).forEach(row => {
    const id = row.digital_specialist_id;
    if (id) counts[id] = (counts[id] || 0) + 1;
  });
  return counts;
}

export async function fetchRecentActivity(organizationId: string, limit = 20): Promise<ActivityLog[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("activity_logs")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[DashboardService] fetchRecentActivity error:", error);
    return [];
  }
  return data || [];
}

export async function fetchTotalWorkflows(organizationId: string): Promise<number> {
  if (!supabase) return 0;
  const { count, error } = await supabase
    .from("workflows")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", organizationId);

  if (error) {
    console.error("[DashboardService] fetchTotalWorkflows error:", error);
    return 0;
  }
  return count || 0;
}
