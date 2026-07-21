import { supabase } from "./supabase";

export interface StripeCheckoutResult {
  success: boolean;
  url: string | null;
  error: string | null;
}

export async function createStripeCheckoutSession(
  organizationId: string,
  quantity = 1,
): Promise<StripeCheckoutResult> {
  if (!supabase) return { success: false, url: null, error: "Supabase is not configured." };

  const { data, error } = await supabase.functions.invoke("create-stripe-checkout-session", {
    body: {
      organization_id: organizationId,
      quantity,
    },
  });

  if (error) {
    const context = (error as { context?: { json?: () => Promise<unknown> } }).context;
    if (context?.json) {
      try {
        const body = await context.json() as { error?: string };
        if (body?.error) return { success: false, url: null, error: body.error };
      } catch {
        // Fall through to the client error message.
      }
    }
    return { success: false, url: null, error: error.message || "Stripe Checkout could not be started." };
  }

  if (data?.error) return { success: false, url: null, error: String(data.error) };
  const url = typeof data?.url === "string" ? data.url : null;
  return {
    success: data?.success === true && Boolean(url),
    url,
    error: data?.success === true && url ? null : "Stripe Checkout could not be started.",
  };
}
