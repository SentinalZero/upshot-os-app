import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { getAuthenticatedUser, getSupabaseAdmin } from "../_shared/supabase-admin.ts";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const APP_URL = Deno.env.get("APP_URL") || "https://app.upshottheory.com";

function respond(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function stripeRequest(path: string, body: URLSearchParams) {
  const secretKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!secretKey) throw new Error("STRIPE_SECRET_KEY is not configured");

  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const payload = await response.json();
  if (!response.ok) {
    const message = payload?.error?.message || "Stripe request failed";
    throw new Error(message);
  }
  return payload;
}

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  if (req.method !== "POST") return respond({ error: "Method not allowed" }, 405);

  try {
    const user = await getAuthenticatedUser(req);
    const body = await req.json().catch(() => ({}));
    const organizationId = typeof body.organization_id === "string" ? body.organization_id : "";
    const quantity = Math.min(100, Math.max(1, Number(body.quantity) || 1));

    if (!UUID_PATTERN.test(organizationId)) {
      return respond({ error: "A valid organization_id is required" }, 400);
    }

    const priceId = Deno.env.get("STRIPE_DIGITAL_SPECIALIST_PRICE_ID");
    if (!priceId?.startsWith("price_")) {
      throw new Error("STRIPE_DIGITAL_SPECIALIST_PRICE_ID is not configured with a Stripe price ID");
    }

    const admin = getSupabaseAdmin();
    const { data: membership } = await admin
      .from("organization_members")
      .select("role")
      .eq("organization_id", organizationId)
      .eq("user_id", user.id)
      .single();

    if (!membership) return respond({ error: "You do not belong to this organization" }, 403);
    if (!["owner", "admin"].includes(String(membership.role || "").toLowerCase())) {
      return respond({ error: "Only organization owners and admins can manage billing" }, 403);
    }

    const [{ data: organization }, { data: subscription }] = await Promise.all([
      admin.from("organizations").select("id, name").eq("id", organizationId).single(),
      admin.from("organization_subscriptions")
        .select("external_customer_id, external_subscription_id")
        .eq("organization_id", organizationId)
        .single(),
    ]);

    if (!organization) return respond({ error: "Organization not found" }, 404);
    if (subscription?.external_subscription_id) {
      return respond({ error: "This workspace already has a Stripe subscription. Use Manage Billing instead." }, 409);
    }

    let customerId = subscription?.external_customer_id || "";
    if (!customerId) {
      const customerBody = new URLSearchParams();
      customerBody.set("email", user.email || "");
      customerBody.set("name", organization.name || "Upshot workspace");
      customerBody.set("metadata[organization_id]", organizationId);
      customerBody.set("metadata[source]", "upshot_os");
      const customer = await stripeRequest("customers", customerBody);
      customerId = customer.id;

      const { error: customerUpdateError } = await admin
        .from("organization_subscriptions")
        .update({ external_customer_id: customerId, updated_at: new Date().toISOString() })
        .eq("organization_id", organizationId);
      if (customerUpdateError) throw new Error(`Could not save Stripe customer: ${customerUpdateError.message}`);
    }

    const checkoutBody = new URLSearchParams();
    checkoutBody.set("mode", "subscription");
    checkoutBody.set("customer", customerId);
    checkoutBody.set("payment_method_types[0]", "card");
    checkoutBody.set("line_items[0][price]", priceId);
    checkoutBody.set("line_items[0][quantity]", String(quantity));
    checkoutBody.set("success_url", `${APP_URL}/app/settings/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`);
    checkoutBody.set("cancel_url", `${APP_URL}/app/settings/billing?checkout=canceled`);
    checkoutBody.set("allow_promotion_codes", "true");
    checkoutBody.set("billing_address_collection", "required");
    checkoutBody.set("customer_update[address]", "auto");
    checkoutBody.set("customer_update[name]", "auto");
    checkoutBody.set("tax_id_collection[enabled]", "true");
    checkoutBody.set("automatic_tax[enabled]", "true");
    checkoutBody.set("subscription_data[metadata][organization_id]", organizationId);
    checkoutBody.set("subscription_data[metadata][subscription_tier]", "starter");
    checkoutBody.set("subscription_data[metadata][digital_specialist_count]", String(quantity));
    checkoutBody.set("metadata[organization_id]", organizationId);
    checkoutBody.set("metadata[customer_email]", user.email || "");
    checkoutBody.set("metadata[subscription_tier]", "starter");
    checkoutBody.set("metadata[digital_specialist_count]", String(quantity));
    checkoutBody.set("metadata[source]", "upshot_os");

    const session = await stripeRequest("checkout/sessions", checkoutBody);

    await admin.from("activity_logs").insert({
      organization_id: organizationId,
      activity_type: "stripe_checkout_started",
      title: "Stripe checkout started",
      description: `A billing administrator started checkout for ${quantity} Digital Specialist${quantity === 1 ? "" : "s"}.`,
      severity: "info",
      metadata: {
        stripe_checkout_session_id: session.id,
        quantity,
        initiated_by_user_id: user.id,
      },
    });

    return respond({ success: true, url: session.url, session_id: session.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("[create-stripe-checkout-session]", message);
    return respond({ error: message }, 500);
  }
});