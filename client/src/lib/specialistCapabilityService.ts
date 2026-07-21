import { supabase } from "./supabase";

export interface SpecialistRoleProfile {
  mission: string;
  operatingInstructions: string;
  boundaries: string[];
  status: string;
}

export interface SpecialistCapabilityCommand {
  id: string;
  name: string;
  description: string;
  category: string;
  status: string;
  autonomyLevel: string;
  successDefinition: string;
  requiredIntegrations: string[];
  requiredKnowledge: string[];
  triggers: Array<{ id: string; triggerType: string; providerKey: string | null; eventKey: string | null; isActive: boolean }>;
  permissions: Array<{ id: string; actionKey: string; resourceKey: string; accessMode: string; approvalRequired: boolean }>;
  metrics: Array<{ id: string; name: string; unit: string; direction: string; measurementWindow: string }>;
}

export interface SpecialistCapabilitySnapshot {
  profile: SpecialistRoleProfile | null;
  capabilities: SpecialistCapabilityCommand[];
  escalations: Array<{ id: string; name: string; severity: string; route: string; instructions: string }>;
  knowledgeSources: Array<{ id: string; title: string; sourceType: string; status: string }>;
}

export async function fetchSpecialistCapabilitySnapshot(specialistId: string): Promise<{ data: SpecialistCapabilitySnapshot | null; error: string | null }> {
  if (!supabase) return { data: null, error: "Supabase is not configured." };

  const [profileResult, capabilitiesResult, triggersResult, permissionsResult, escalationsResult, knowledgeResult, metricsResult] = await Promise.all([
    supabase.from("specialist_role_profiles").select("mission, operating_instructions, boundaries, status").eq("specialist_id", specialistId).maybeSingle(),
    supabase.from("specialist_capabilities").select("id, name, description, category, status, autonomy_level, success_definition, required_integrations, required_knowledge, position").eq("specialist_id", specialistId).order("position", { ascending: true }),
    supabase.from("specialist_triggers").select("id, capability_id, trigger_type, provider_key, event_key, is_active").eq("specialist_id", specialistId),
    supabase.from("specialist_permissions").select("id, capability_id, action_key, resource_key, access_mode, approval_required").eq("specialist_id", specialistId),
    supabase.from("specialist_escalation_rules").select("id, name, severity, route, instructions").eq("specialist_id", specialistId).eq("is_active", true),
    supabase.from("specialist_knowledge_sources").select("id, title, source_type, status").eq("specialist_id", specialistId),
    supabase.from("specialist_outcome_metrics").select("id, capability_id, name, unit, direction, measurement_window").eq("specialist_id", specialistId).eq("is_active", true),
  ]);

  const firstError = [profileResult.error, capabilitiesResult.error, triggersResult.error, permissionsResult.error, escalationsResult.error, knowledgeResult.error, metricsResult.error].find(Boolean);
  if (firstError) return { data: null, error: firstError.message };

  const triggers = triggersResult.data || [];
  const permissions = permissionsResult.data || [];
  const metrics = metricsResult.data || [];

  return {
    data: {
      profile: profileResult.data ? {
        mission: profileResult.data.mission || "",
        operatingInstructions: profileResult.data.operating_instructions || "",
        boundaries: profileResult.data.boundaries || [],
        status: profileResult.data.status || "draft",
      } : null,
      capabilities: (capabilitiesResult.data || []).map(capability => ({
        id: capability.id,
        name: capability.name,
        description: capability.description || "",
        category: capability.category || "operations",
        status: capability.status || "draft",
        autonomyLevel: capability.autonomy_level || "recommend",
        successDefinition: capability.success_definition || "",
        requiredIntegrations: capability.required_integrations || [],
        requiredKnowledge: capability.required_knowledge || [],
        triggers: triggers.filter(item => item.capability_id === capability.id).map(item => ({ id: item.id, triggerType: item.trigger_type, providerKey: item.provider_key, eventKey: item.event_key, isActive: item.is_active })),
        permissions: permissions.filter(item => item.capability_id === capability.id).map(item => ({ id: item.id, actionKey: item.action_key, resourceKey: item.resource_key, accessMode: item.access_mode, approvalRequired: item.approval_required })),
        metrics: metrics.filter(item => item.capability_id === capability.id).map(item => ({ id: item.id, name: item.name, unit: item.unit, direction: item.direction, measurementWindow: item.measurement_window })),
      })),
      escalations: (escalationsResult.data || []).map(item => ({ id: item.id, name: item.name, severity: item.severity, route: item.route, instructions: item.instructions || "" })),
      knowledgeSources: (knowledgeResult.data || []).map(item => ({ id: item.id, title: item.title, sourceType: item.source_type, status: item.status })),
    },
    error: null,
  };
}
