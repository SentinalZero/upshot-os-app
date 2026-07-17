import { supabase } from "./supabase";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CatalogProvider {
  id: string;
  provider_key: string;
  provider_name: string;
  category: string;
  description: string | null;
  auth_type: string;
  is_active: boolean;
  icon_url: string | null;
  scopes: string[] | null;
  created_at: string;
}

export type IntegrationStatus = "selected" | "pending" | "connected" | "expired" | "disconnected" | "error";

export interface Integration {
  id: string;
  organization_id: string;
  digital_specialist_id: string | null;
  catalog_id: string;
  created_by: string;
  provider_key: string;
  provider_name: string;
  status: IntegrationStatus;
  external_account_name: string | null;
  external_account_email: string | null;
  connected_at: string | null;
  last_verified_at: string | null;
  granted_scopes: string[] | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string | null;
}

export interface ConnectionCounts {
  connected: number;
  selected: number;
  attentionRequired: number;
}

// ─── Fetch Integration Catalog ───────────────────────────────────────────────

export async function fetchIntegrationCatalog(): Promise<CatalogProvider[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("integration_catalog")
    .select("*")
    .eq("is_active", true)
    .order("provider_name", { ascending: true });

  if (error) {
    console.error("[ConnectionsService] fetchIntegrationCatalog error:", error);
    return [];
  }
  return data || [];
}

// ─── Fetch Organization Integrations ─────────────────────────────────────────

export async function fetchOrgIntegrations(organizationId: string): Promise<Integration[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("integrations")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[ConnectionsService] fetchOrgIntegrations error:", error);
    return [];
  }
  return data || [];
}

// ─── Fetch Connection Counts ─────────────────────────────────────────────────

export async function fetchConnectionCounts(organizationId: string): Promise<ConnectionCounts> {
  if (!supabase) return { connected: 0, selected: 0, attentionRequired: 0 };

  const { data, error } = await supabase
    .from("integrations")
    .select("status")
    .eq("organization_id", organizationId);

  if (error) {
    console.error("[ConnectionsService] fetchConnectionCounts error:", error);
    return { connected: 0, selected: 0, attentionRequired: 0 };
  }

  const rows = data || [];
  return {
    connected: rows.filter(r => r.status === "connected").length,
    selected: rows.filter(r => r.status === "selected").length,
    attentionRequired: rows.filter(r => r.status === "expired" || r.status === "error").length,
  };
}

// ─── Select Integration ──────────────────────────────────────────────────────

export async function selectIntegration(
  organizationId: string,
  userId: string,
  catalog: CatalogProvider
): Promise<{ success: boolean; integration?: Integration; error?: string }> {
  if (!supabase) return { success: false, error: "Supabase not configured" };

  try {
    // Check for existing record (avoid duplicates)
    const { data: existing, error: checkError } = await supabase
      .from("integrations")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("provider_key", catalog.provider_key)
      .limit(1);

    if (checkError) {
      console.error("[ConnectionsService] duplicate check error:", checkError);
      return { success: false, error: `Failed to check existing integrations: ${checkError.message}` };
    }

    // If a disconnected or error record exists, reuse it
    if (existing && existing.length > 0) {
      const record = existing[0];
      if (record.status === "disconnected" || record.status === "error") {
        const { data: updated, error: updateError } = await supabase
          .from("integrations")
          .update({ status: "selected", updated_at: new Date().toISOString() })
          .eq("id", record.id)
          .select("*")
          .single();

        if (updateError) {
          console.error("[ConnectionsService] reuse update error:", updateError);
          return { success: false, error: `Failed to update integration: ${updateError.message}` };
        }
        return { success: true, integration: updated };
      }
      // Already exists in another state — don't create duplicate
      return { success: true, integration: record };
    }

    // Create new record
    const { data: created, error: insertError } = await supabase
      .from("integrations")
      .insert({
        organization_id: organizationId,
        created_by: userId,
        catalog_id: catalog.id,
        provider_key: catalog.provider_key,
        provider_name: catalog.provider_name,
        status: "selected",
      })
      .select("*")
      .single();

    if (insertError) {
      console.error("[ConnectionsService] insert error:", insertError);
      return { success: false, error: `Failed to create integration: ${insertError.message}` };
    }

    return { success: true, integration: created };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[ConnectionsService] selectIntegration unexpected error:", err);
    return { success: false, error: message };
  }
}

// ─── Assign Integration to Digital Specialist ────────────────────────────────

export async function assignIntegrationToSpecialist(
  integrationId: string,
  specialistId: string | null
): Promise<{ success: boolean; error?: string }> {
  if (!supabase) return { success: false, error: "Supabase not configured" };

  const { error } = await supabase
    .from("integrations")
    .update({
      digital_specialist_id: specialistId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", integrationId);

  if (error) {
    console.error("[ConnectionsService] assignIntegrationToSpecialist error:", error);
    return { success: false, error: `Failed to update assignment: ${error.message}` };
  }

  return { success: true };
}

// ─── Create Integrations from Deployment Selected Systems ────────────────────

export async function createIntegrationsFromDeployment(
  organizationId: string,
  userId: string,
  specialistId: string,
  selectedSystems: string[]
): Promise<{ created: number; reused: number; errors: string[] }> {
  if (!supabase) return { created: 0, reused: 0, errors: ["Supabase not configured"] };

  const result = { created: 0, reused: 0, errors: [] as string[] };

  // Fetch catalog to match provider names
  const { data: catalog, error: catalogError } = await supabase
    .from("integration_catalog")
    .select("*")
    .eq("is_active", true);

  if (catalogError || !catalog) {
    console.error("[ConnectionsService] catalog fetch for deployment:", catalogError);
    result.errors.push("Failed to load integration catalog");
    return result;
  }

  // Fetch existing org integrations to avoid duplicates
  const { data: existingIntegrations, error: existingError } = await supabase
    .from("integrations")
    .select("provider_key, id, status")
    .eq("organization_id", organizationId);

  if (existingError) {
    console.error("[ConnectionsService] existing integrations fetch:", existingError);
    result.errors.push("Failed to check existing integrations");
    return result;
  }

  const existingMap = new Map((existingIntegrations || []).map(i => [i.provider_key, i]));

  for (const systemName of selectedSystems) {
    // Match system name to catalog provider_name (case-insensitive)
    const catalogEntry = catalog.find(
      c => c.provider_name.toLowerCase() === systemName.toLowerCase()
    );
    if (!catalogEntry) continue; // No matching catalog entry, skip

    const existing = existingMap.get(catalogEntry.provider_key);

    if (existing) {
      // Reuse existing record — update specialist assignment if not already set
      if (!existing.status || existing.status === "disconnected" || existing.status === "error") {
        await supabase
          .from("integrations")
          .update({
            status: "selected",
            digital_specialist_id: specialistId,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
      }
      result.reused++;
      continue;
    }

    // Create new integration record
    const { error: insertError } = await supabase
      .from("integrations")
      .insert({
        organization_id: organizationId,
        created_by: userId,
        catalog_id: catalogEntry.id,
        provider_key: catalogEntry.provider_key,
        provider_name: catalogEntry.provider_name,
        digital_specialist_id: specialistId,
        status: "selected",
      });

    if (insertError) {
      console.error("[ConnectionsService] deployment insert error:", insertError);
      result.errors.push(`Failed to create ${systemName}: ${insertError.message}`);
    } else {
      result.created++;
    }
  }

  return result;
}
