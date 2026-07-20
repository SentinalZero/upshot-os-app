/**
 * provision-default-workspace
 *
 * Authenticated, idempotent provisioning for a new Upshot organization.
 * Creates the default Digital Specialist, Meeting Summary deployment, and a
 * disconnected Google Workspace integration by cloning centrally managed seed
 * records. Tokens and customer account data are never copied.
 */
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { getAuthenticatedUser, getSupabaseAdmin } from "../_shared/supabase-admin.ts";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DEFAULT_SPECIALIST_TEMPLATE_ID = "971c7a20-6dec-4e33-8e62-ccc0fbd8c87e";
const DEFAULT_DEPLOYMENT_TEMPLATE_ID = "754a7dcd-fa29-46e7-82cf-636216487bfb";
const DEFAULT_GOOGLE_TEMPLATE_ID = "7268fdd8-6f03-4dea-bb1b-15bea0bb9111";

function respond(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function stripFields(source: Record<string, unknown>, fields: string[]) {
  const copy = { ...source };
  for (const field of fields) delete copy[field];
  return copy;
}

function templateId(name: string, fallback: string) {
  const value = Deno.env.get(name) || fallback;
  if (!UUID_PATTERN.test(value)) throw new Error(`${name} must be a valid UUID`);
  return value;
}

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  if (req.method !== "POST") return respond({ error: "Method not allowed" }, 405);

  try {
    const user = await getAuthenticatedUser(req);
    const body = await req.json().catch(() => ({}));
    const requestedOrganizationId = typeof body.organization_id === "string" ? body.organization_id : "";
    const admin = getSupabaseAdmin();

    let organizationId = requestedOrganizationId;
    if (!organizationId) {
      const { data: profile } = await admin
        .from("profiles")
        .select("active_organization_id")
        .eq("id", user.id)
        .single();
      organizationId = profile?.active_organization_id || "";
    }

    if (!UUID_PATTERN.test(organizationId)) {
      return respond({ error: "A valid organization_id is required" }, 400);
    }

    const { data: membership } = await admin
      .from("organization_members")
      .select("id, role")
      .eq("organization_id", organizationId)
      .eq("user_id", user.id)
      .single();

    if (!membership) return respond({ error: "You do not belong to this organization" }, 403);
    if (!["owner", "admin"].includes(String(membership.role || "").toLowerCase())) {
      return respond({ error: "Only organization owners and admins can provision a workspace" }, 403);
    }

    const specialistTemplateId = templateId("DEFAULT_SPECIALIST_TEMPLATE_ID", DEFAULT_SPECIALIST_TEMPLATE_ID);
    const deploymentTemplateId = templateId("DEFAULT_MEETING_SUMMARY_DEPLOYMENT_ID", DEFAULT_DEPLOYMENT_TEMPLATE_ID);
    const googleTemplateId = templateId("DEFAULT_GOOGLE_INTEGRATION_ID", DEFAULT_GOOGLE_TEMPLATE_ID);

    let specialist: Record<string, unknown> | null = null;
    const { data: existingSpecialists, error: existingSpecialistError } = await admin
      .from("digital_specialists")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: true })
      .limit(1);

    if (existingSpecialistError) throw new Error(`Could not inspect Digital Specialists: ${existingSpecialistError.message}`);
    specialist = existingSpecialists?.[0] || null;

    if (!specialist) {
      const { data: specialistTemplate, error: templateError } = await admin
        .from("digital_specialists")
        .select("*")
        .eq("id", specialistTemplateId)
        .single();
      if (templateError || !specialistTemplate) throw new Error("Default Digital Specialist template was not found");

      const specialistInsert = stripFields(specialistTemplate, [
        "id",
        "organization_id",
        "created_at",
        "updated_at",
        "activated_at",
        "deployed_at",
        "paused_at",
        "retired_at",
        "terminated_at",
        "last_activity_at",
      ]);

      const now = new Date().toISOString();
      const { data: createdSpecialist, error: createError } = await admin
        .from("digital_specialists")
        .insert({
          ...specialistInsert,
          organization_id: organizationId,
          status: "active",
          framework_lifecycle_status: "active",
          created_at: now,
          updated_at: now,
        })
        .select("*")
        .single();

      if (createError || !createdSpecialist) {
        throw new Error(`Could not create the default Digital Specialist: ${createError?.message || "Unknown error"}`);
      }
      specialist = createdSpecialist;
    }

    const specialistId = String(specialist.id);
    let deployment: Record<string, unknown> | null = null;
    const { data: existingDeployments, error: existingDeploymentError } = await admin
      .from("specialist_workflow_deployments")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("specialist_id", specialistId)
      .order("created_at", { ascending: true })
      .limit(1);

    if (existingDeploymentError) throw new Error(`Could not inspect workflow deployments: ${existingDeploymentError.message}`);
    deployment = existingDeployments?.[0] || null;

    if (!deployment) {
      const { data: deploymentTemplate, error: templateError } = await admin
        .from("specialist_workflow_deployments")
        .select("*")
        .eq("id", deploymentTemplateId)
        .single();
      if (templateError || !deploymentTemplate) throw new Error("Meeting Summary deployment template was not found");

      const deploymentInsert = stripFields(deploymentTemplate, [
        "id",
        "organization_id",
        "specialist_id",
        "created_at",
        "updated_at",
        "activated_at",
        "deployed_at",
        "paused_at",
        "retired_at",
        "last_run_at",
      ]);

      const now = new Date().toISOString();
      const { data: createdDeployment, error: createError } = await admin
        .from("specialist_workflow_deployments")
        .insert({
          ...deploymentInsert,
          organization_id: organizationId,
          specialist_id: specialistId,
          status: "active",
          created_at: now,
          updated_at: now,
        })
        .select("*")
        .single();

      if (createError || !createdDeployment) {
        throw new Error(`Could not deploy Meeting Summary: ${createError?.message || "Unknown error"}`);
      }
      deployment = createdDeployment;
    }

    let integration: Record<string, unknown> | null = null;
    const { data: existingIntegrations, error: existingIntegrationError } = await admin
      .from("integrations")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("provider_key", "google_workspace")
      .limit(1);

    if (existingIntegrationError) throw new Error(`Could not inspect Google integrations: ${existingIntegrationError.message}`);
    integration = existingIntegrations?.[0] || null;

    if (!integration) {
      const { data: googleTemplate, error: templateError } = await admin
        .from("integrations")
        .select("*")
        .eq("id", googleTemplateId)
        .single();
      if (templateError || !googleTemplate) throw new Error("Google Workspace integration template was not found");

      const integrationInsert = stripFields(googleTemplate, [
        "id",
        "organization_id",
        "digital_specialist_id",
        "created_at",
        "updated_at",
        "connected_at",
        "disconnected_at",
        "expires_at",
        "last_verified_at",
        "last_sync_at",
      ]);

      const now = new Date().toISOString();
      const { data: createdIntegration, error: createError } = await admin
        .from("integrations")
        .insert({
          ...integrationInsert,
          organization_id: organizationId,
          digital_specialist_id: specialistId,
          status: "disconnected",
          external_account_id: null,
          external_account_email: null,
          external_account_name: null,
          secret_reference: null,
          granted_scopes: [],
          connection_metadata: {},
          last_error: null,
          created_at: now,
          updated_at: now,
        })
        .select("*")
        .single();

      if (createError || !createdIntegration) {
        throw new Error(`Could not create Google Workspace connection: ${createError?.message || "Unknown error"}`);
      }
      integration = createdIntegration;
    } else if (!integration.digital_specialist_id) {
      const { data: assignedIntegration, error: assignmentError } = await admin
        .from("integrations")
        .update({ digital_specialist_id: specialistId, updated_at: new Date().toISOString() })
        .eq("id", integration.id)
        .eq("organization_id", organizationId)
        .select("*")
        .single();
      if (assignmentError || !assignedIntegration) throw new Error("Could not assign Google Workspace to the default specialist");
      integration = assignedIntegration;
    }

    await admin.from("activity_logs").insert({
      organization_id: organizationId,
      user_id: user.id,
      digital_specialist_id: specialistId,
      activity_type: "workspace_provisioned",
      title: "Workspace automation prepared",
      description: "Default Digital Specialist, Meeting Summary, and Google Workspace connection are ready.",
      severity: "success",
      metadata: {
        specialist_id: specialistId,
        specialist_workflow_deployment_id: deployment.id,
        integration_id: integration.id,
        requires_google_connection: integration.status !== "connected",
      },
    });

    return respond({
      organization_id: organizationId,
      digital_specialist_id: specialistId,
      specialist_workflow_deployment_id: deployment.id,
      integration_id: integration.id,
      google_status: integration.status,
      automation_ready: integration.status === "connected",
      next_step: integration.status === "connected" ? "ready" : "connect_google",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    const status = message.includes("Unauthorized") ? 401 : 500;
    console.error("[provision-default-workspace]", message);
    return respond({ error: message }, status);
  }
});
