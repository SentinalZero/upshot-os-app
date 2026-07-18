import { supabase } from "./supabase";

export interface DigitalSpecialist {
  id: string;
  organization_id: string | null;
  name: string;
  role_name: string | null;
  industry_name: string | null;
  status: string | null;
  framework_lifecycle_status: string;
  oversight_mode: string | null;
  selected_systems: string[] | null;
  deployed_at: string | null;
  created_at: string | null;
}

export interface ActivityLog {
  id: string;
  organization_id: string | null;
  digital_specialist_id: string | null;
  event_type: string | null;
  activity_type: string | null;
  title: string | null;
  description: string | null;
  message: string | null;
  severity: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string | null;
}

export interface WorkflowExecution {
  id: string;
  specialist_id: string | null;
  workflow_id: string | null;
  status: string | null;
  created_at: string | null;
  completed_at: string | null;
}

export type WorkforceState = "working" | "idle" | "needs_review" | "failed" | "offline";

export interface SpecialistOperationalSummary {
  specialistId: string;
  state: WorkforceState;
  completedToday: number;
  failedToday: number;
  needsReview: number;
  currentJob: string;
  lastActivityAt: string | null;
}

export interface DashboardMetrics {
  totalSpecialists: number;
  activeSpecialists: number;
  deployedWorkflows: number;
  executionsToday: number;
  successfulExecutionsToday: number;
  failedExecutionsToday: number;
  successRateToday: number;
  needsHumanReview: number;
}

export interface DashboardData {
  specialists: DigitalSpecialist[];
  workflowCounts: Record<string, number>;
  specialistSummaries: Record<string, SpecialistOperationalSummary>;
  recentActivity: ActivityLog[];
  metrics: DashboardMetrics;
  errors: string[];
}

const completedStatuses = new Set(["successful", "success", "completed"]);
const failedStatuses = new Set(["failed", "error"]);
const workingStatuses = new Set(["running", "processing", "in_progress", "queued"]);

function isActiveSpecialist(specialist: DigitalSpecialist): boolean {
  const statuses = [specialist.status, specialist.framework_lifecycle_status]
    .filter(Boolean)
    .map(value => String(value).toLowerCase());
  return statuses.some(value => ["active", "running", "deployed"].includes(value));
}

function requiresReview(activity: ActivityLog): boolean {
  const severity = activity.severity?.toLowerCase();
  const metadataValue = activity.metadata?.requires_human_attention;
  return severity === "warning" || severity === "critical" || metadataValue === true || metadataValue === "true";
}

function startOfLocalDayIso(): string {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return start.toISOString();
}

function getActivityLabel(activity?: ActivityLog): string {
  if (!activity) return "Ready for work";
  const workflowName = activity.metadata?.workflow_name;
  if (typeof workflowName === "string" && workflowName.trim()) return workflowName;
  return activity.title || activity.message || activity.description || activity.activity_type || activity.event_type || "Operational work";
}

function buildSpecialistSummaries(
  specialists: DigitalSpecialist[],
  executions: WorkflowExecution[],
  activity: ActivityLog[],
): Record<string, SpecialistOperationalSummary> {
  const summaries: Record<string, SpecialistOperationalSummary> = {};

  for (const specialist of specialists) {
    const specialistExecutions = executions.filter(item => item.specialist_id === specialist.id);
    const specialistActivity = activity.filter(item => item.digital_specialist_id === specialist.id);
    const completedToday = specialistExecutions.filter(item => completedStatuses.has(String(item.status).toLowerCase())).length;
    const failedToday = specialistExecutions.filter(item => failedStatuses.has(String(item.status).toLowerCase())).length;
    const reviewItems = specialistActivity.filter(requiresReview);
    const latestExecution = specialistExecutions[0];
    const latestActivity = specialistActivity[0];
    const latestStatus = String(latestExecution?.status || "").toLowerCase();

    let state: WorkforceState = "offline";
    if (reviewItems.length > 0) state = "needs_review";
    else if (workingStatuses.has(latestStatus)) state = "working";
    else if (failedStatuses.has(latestStatus)) state = "failed";
    else if (isActiveSpecialist(specialist)) state = "idle";

    summaries[specialist.id] = {
      specialistId: specialist.id,
      state,
      completedToday,
      failedToday,
      needsReview: reviewItems.length,
      currentJob: state === "working" ? getActivityLabel(latestActivity) : state === "needs_review" ? "Waiting for human review" : getActivityLabel(latestActivity),
      lastActivityAt: latestActivity?.created_at || latestExecution?.completed_at || latestExecution?.created_at || specialist.deployed_at,
    };
  }

  return summaries;
}

export async function fetchSpecialists(organizationId: string): Promise<DigitalSpecialist[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("digital_specialists")
    .select("id, organization_id, name, role_name, industry_name, status, framework_lifecycle_status, oversight_mode, selected_systems, deployed_at, created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[DashboardService] fetchSpecialists error:", error);
    return [];
  }
  return (data || []) as DigitalSpecialist[];
}

export async function fetchDashboardData(organizationId: string): Promise<DashboardData> {
  const empty: DashboardData = {
    specialists: [],
    workflowCounts: {},
    specialistSummaries: {},
    recentActivity: [],
    metrics: {
      totalSpecialists: 0,
      activeSpecialists: 0,
      deployedWorkflows: 0,
      executionsToday: 0,
      successfulExecutionsToday: 0,
      failedExecutionsToday: 0,
      successRateToday: 0,
      needsHumanReview: 0,
    },
    errors: [],
  };

  if (!supabase) {
    return { ...empty, errors: ["Supabase is not configured."] };
  }

  const today = startOfLocalDayIso();

  const [specialistsResult, deploymentsResult, executionsResult, activityResult] = await Promise.all([
    supabase
      .from("digital_specialists")
      .select("id, organization_id, name, role_name, industry_name, status, framework_lifecycle_status, oversight_mode, selected_systems, deployed_at, created_at")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false }),
    supabase
      .from("specialist_workflow_deployments")
      .select("id, specialist_id, status")
      .eq("organization_id", organizationId),
    supabase
      .from("workflow_executions")
      .select("id, specialist_id, workflow_id, status, created_at, completed_at")
      .eq("organization_id", organizationId)
      .gte("created_at", today)
      .order("created_at", { ascending: false }),
    supabase
      .from("activity_logs")
      .select("id, organization_id, digital_specialist_id, event_type, activity_type, title, description, message, severity, metadata, created_at")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const errors: string[] = [];
  if (specialistsResult.error) errors.push(`Specialists: ${specialistsResult.error.message}`);
  if (deploymentsResult.error) errors.push(`Workflow deployments: ${deploymentsResult.error.message}`);
  if (executionsResult.error) errors.push(`Executions: ${executionsResult.error.message}`);
  if (activityResult.error) errors.push(`Activity: ${activityResult.error.message}`);

  const specialists = (specialistsResult.data || []) as DigitalSpecialist[];
  const deployments = deploymentsResult.data || [];
  const executions = (executionsResult.data || []) as WorkflowExecution[];
  const recentActivity = (activityResult.data || []) as ActivityLog[];

  const workflowCounts: Record<string, number> = {};
  for (const deployment of deployments) {
    if (deployment.specialist_id) {
      workflowCounts[deployment.specialist_id] = (workflowCounts[deployment.specialist_id] || 0) + 1;
    }
  }

  const successfulExecutionsToday = executions.filter(item => completedStatuses.has(String(item.status).toLowerCase())).length;
  const failedExecutionsToday = executions.filter(item => failedStatuses.has(String(item.status).toLowerCase())).length;
  const executionsToday = executions.length;

  return {
    specialists,
    workflowCounts,
    specialistSummaries: buildSpecialistSummaries(specialists, executions, recentActivity),
    recentActivity,
    metrics: {
      totalSpecialists: specialists.length,
      activeSpecialists: specialists.filter(isActiveSpecialist).length,
      deployedWorkflows: deployments.length,
      executionsToday,
      successfulExecutionsToday,
      failedExecutionsToday,
      successRateToday: executionsToday > 0 ? Math.round((successfulExecutionsToday / executionsToday) * 1000) / 10 : 0,
      needsHumanReview: recentActivity.filter(requiresReview).length,
    },
    errors,
  };
}

export function subscribeToCommandCenter(organizationId: string, onChange: () => void): () => void {
  if (!supabase) return () => undefined;

  const channel = supabase
    .channel(`command-center:${organizationId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "digital_specialists", filter: `organization_id=eq.${organizationId}` }, () => onChange())
    .on("postgres_changes", { event: "*", schema: "public", table: "specialist_workflow_deployments", filter: `organization_id=eq.${organizationId}` }, () => onChange())
    .on("postgres_changes", { event: "*", schema: "public", table: "workflow_executions", filter: `organization_id=eq.${organizationId}` }, () => onChange())
    .on("postgres_changes", { event: "*", schema: "public", table: "activity_logs", filter: `organization_id=eq.${organizationId}` }, () => onChange())
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

export function toSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 64);
}

export function mapOversightMode(oversightRules: string[]): "autonomous" | "approval_required" | "escalation_only" {
  if (oversightRules.length === 0) return "autonomous";
  const escalationKeywords = ["escalat", "route", "handoff"];
  const allEscalation = oversightRules.every(rule =>
    escalationKeywords.some(keyword => rule.toLowerCase().includes(keyword)),
  );
  return allEscalation ? "escalation_only" : "approval_required";
}

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
  error?: string;
}

export async function deployDigitalSpecialist(config: DeployConfig): Promise<DeployResult> {
  if (!supabase) return { success: false, error: "Supabase not configured" };

  const { data: specialist, error } = await supabase
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

  if (error) return { success: false, error: error.message };
  return { success: true, specialistId: specialist.id };
}
