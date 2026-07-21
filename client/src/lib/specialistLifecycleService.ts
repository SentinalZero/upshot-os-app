import { supabase } from "./supabase";

export type SpecialistLifecycleAction = "deactivate" | "reactivate" | "delete";

export interface SpecialistLifecycleResult {
  success: boolean;
  error: string | null;
}

export async function manageDigitalSpecialist(
  organizationId: string,
  specialistId: string,
  action: SpecialistLifecycleAction,
): Promise<SpecialistLifecycleResult> {
  if (!supabase) return { success: false, error: "Supabase is not configured." };

  const { data, error } = await supabase.functions.invoke("manage-digital-specialist", {
    body: {
      organization_id: organizationId,
      specialist_id: specialistId,
      action,
    },
  });

  if (error) {
    const context = (error as { context?: { json?: () => Promise<unknown> } }).context;
    if (context?.json) {
      try {
        const body = await context.json() as { error?: string };
        if (body?.error) return { success: false, error: body.error };
      } catch {
        // Fall back to the function client error below.
      }
    }
    return { success: false, error: error.message || "The specialist could not be updated." };
  }

  if (data?.error) return { success: false, error: String(data.error) };
  return { success: data?.success === true, error: data?.success === true ? null : "The specialist could not be updated." };
}
