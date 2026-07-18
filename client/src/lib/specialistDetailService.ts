import { supabase } from "./supabase";

export interface SpecialistCapabilityDetail {
  id: string;
  status: string;
  name: string;
  lastActivityAt: string | null;
}

export interface SpecialistJobDetail {
  id: string;
  status: string;
  summary: string | null;
  errorMessage: string | null;
  triggerSource: string | null;
  deploymentId: string | null;
  createdAt: string | null;
  completedAt: string | null;
}

export interface SpecialistIntegrationDetail {
  id: string;
  providerName: string;
  status: string;
  externalAccountEmail: string | null;
  connectedAt: string | null;
  lastVerifiedAt: string | null;
}

export interface SpecialistReviewDetail {
  id: string;
  title: string;
  description: string;
  severity: string;
  createdAt: string | null;
}

export interface SpecialistDetailData {
  capabilities: SpecialistCapabilityDetail[];
  jobs: SpecialistJobDetail[];
  integrations: SpecialistIntegrationDetail[];
  reviews: SpecialistReviewDetail[];
  errors: string[];
}

interface ActivityRow {
  id: string;
  title: string | null;
  description: string | null;
  severity: string | null;
  created_at: string | null;
  metadata: Record<string, unknown> | null;
}

export async function fetchSpecialistDetail(
  organizationId: string,
  specialistId: string,
): Promise<SpecialistDetailData> {
  const empty: SpecialistDetailData = {
    capabilities: [],
    jobs: [],
    integrations: [],
    reviews: [],
    errors: [],
  };

  if (!supabase) {
    return { ...empty, errors: ["Supabase is not configured."] };
  }

  const [deploymentsResult, jobsResult, integrationsResult, activityResult] = await Promise.all([
    supabase
      .from("specialist_workflow_deployments")
      .select("id, status")
      .eq("organization_id", organizationId)
      .eq("specialist_id", specialistId),
    supabase
      .from("workflow_executions")
      .select("id, status, summary, error_message, trigger_source, specialist_workflow_deployment_id, created_at, completed_at")
      .eq("organization_id", organizationId)
      .eq("specialist_id", specialistId)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("integrations")
      .select("id, provider_name, status, external_account_email, connected_at, last_verified_at")
      .eq("organization_id", organizationId)
      .eq("digital_specialist_id", specialistId)
      .order("created_at", { ascending: false }),
    supabase
      .from("activity_logs")
      .select("id, title, description, severity, created_at, metadata")
      .eq("organization_id", organizationId)
      .eq("digital_specialist_id", specialistId)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const errors: string[] = [];
  if (deploymentsResult.error) errors.push(`Capabilities: ${deploymentsResult.error.message}`);
  if (jobsResult.error) errors.push(`Recent jobs: ${jobsResult.error.message}`);
  if (integrationsResult.error) errors.push(`Connected systems: ${integrationsResult.error.message}`);
  if (activityResult.error) errors.push(`Review queue: ${activityResult.error.message}`);

  const activity = (activityResult.data || []) as ActivityRow[];
  const deploymentActivity = new Map<string, ActivityRow>();

  for (const item of activity) {
    const deploymentId = typeof item.metadata?.specialist_workflow_deployment_id === "string"
      ? item.metadata.specialist_workflow_deployment_id
      : "";
    if (deploymentId && !deploymentActivity.has(deploymentId)) deploymentActivity.set(deploymentId, item);
  }

  const capabilities = (deploymentsResult.data || []).map((deployment, index) => {
    const latestActivity = deploymentActivity.get(deployment.id);
    const workflowName = typeof latestActivity?.metadata?.workflow_name === "string"
      ? latestActivity.metadata.workflow_name.trim()
      : "";

    return {
      id: deployment.id,
      status: deployment.status || "unknown",
      name: workflowName || `Capability ${index + 1}`,
      lastActivityAt: latestActivity?.created_at || null,
    };
  });

  const jobs = (jobsResult.data || []).map(job => ({
    id: job.id,
    status: job.status || "unknown",
    summary: job.summary || null,
    errorMessage: job.error_message || null,
    triggerSource: job.trigger_source || null,
    deploymentId: job.specialist_workflow_deployment_id || null,
    createdAt: job.created_at || null,
    completedAt: job.completed_at || null,
  }));

  const integrations = (integrationsResult.data || []).map(integration => ({
    id: integration.id,
    providerName: integration.provider_name || "Business system",
    status: integration.status || "unknown",
    externalAccountEmail: integration.external_account_email || null,
    connectedAt: integration.connected_at || null,
    lastVerifiedAt: integration.last_verified_at || null,
  }));

  const reviews = activity
    .filter(item => {
      const severity = item.severity?.toLowerCase();
      return severity === "warning"
        || severity === "critical"
        || item.metadata?.requires_human_attention === true
        || item.metadata?.requires_human_attention === "true";
    })
    .map(item => ({
      id: item.id,
      title: item.title || "Human review requested",
      description: item.description || "This activity needs attention.",
      severity: item.severity || "warning",
      createdAt: item.created_at,
    }));

  return { capabilities, jobs, integrations, reviews, errors };
}
