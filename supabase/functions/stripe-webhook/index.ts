import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { getSupabaseAdmin } from "../_shared/supabase-admin.ts";

const encoder = new TextEncoder();

function respond(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let index = 0; index < a.length; index += 1) {
    result |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return result === 0;
}

async function hmacSha256Hex(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return Array.from(new Uint8Array(signature)).map(byte => byte.toString(16).padStart(2, "0")).join("");
}

async function verifyStripeSignature(payload: string, header: string, secret: string): Promise<boolean> {
  const parts = header.split(",").map(item => item.trim());
  const timestamp = parts.find(item => item.startsWith("t="))?.slice(2) || "";
  const signatures = parts.filter(item => item.startsWith("v1=")).map(item => item.slice(3));
  if (!timestamp || signatures.length === 0) return false;

  const ageSeconds = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(ageSeconds) || ageSeconds > 300) return false;

  const expected = await hmacSha256Hex(secret, `${timestamp}.${payload}`);
  return signatures.some(signature => constantTimeEqual(signature, expected));
}

function mapStripeStatus(status: string): "trialing" | "active" | "past_due" | "paused" | "canceled" {
  if (status === "trialing") return "trialing";
  if (status === "active") return "active";
  if (["past_due", "unpaid", "incomplete", "incomplete_expired"].includes(status)) return "past_due";
  if (status === "paused") return "paused";
  return "canceled";
}

function unixToIso(value: unknown): string | null {
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds > 0 ? new Date(seconds * 1000).toISOString() : null;
}

async function stripeGet(path: string) {
  const secretKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!secretKey) throw new Error("STRIPE_SECRET_KEY is not configured");
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error?.message || "Stripe request failed");
  return payload;
}

async function syncSubscription(subscription: any, organizationIdOverride?: string) {
  const admin = getSupabaseAdmin();
  const organizationId = organizationIdOverride || subscription?.metadata?.organization_id || "";
  if (!organizationId) throw new Error("Stripe subscription is missing organization_id metadata");

  const firstItem = subscription?.items?.data?.[0];
  const quantity = Math.max(1, Number(firstItem?.quantity) || Number(subscription?.metadata?.digital_specialist_count) || 1);
  const unitAmount = Number(firstItem?.price?.unit_amount);
  const monthlyPriceCents = Number.isFinite(unitAmount) ? unitAmount * quantity : 9900 * quantity;

  const update: Record<string, unknown> = {
    status: mapStripeStatus(String(subscription?.status || "canceled")),
    external_customer_id: typeof subscription?.customer === "string" ? subscription.customer : subscription?.customer?.id,
    external_subscription_id: subscription?.id,
    monthly_price_cents: monthlyPriceCents,
    updated_at: new Date().toISOString(),
  };

  const periodStart = unixToIso(firstItem?.current_period_start || subscription?.current_period_start);
  const periodEnd = unixToIso(firstItem?.current_period_end || subscription?.current_period_end);
  if (periodStart) update.current_period_start = periodStart;
  if (periodEnd) update.current_period_end = periodEnd;

  const { error } = await admin.from("organization_subscriptions").update(update).eq("organization_id", organizationId);
  if (error) throw new Error(`Could not update Upshot subscription: ${error.message}`);

  await admin.from("activity_logs").insert({
    organization_id: organizationId,
    activity_type: "stripe_subscription_updated",
    title: "Billing subscription updated",
    description: `Stripe subscription is now ${String(update.status).replaceAll("_", " ")}.`,
    severity: update.status === "active" || update.status === "trialing" ? "success" : "warning",
    metadata: {
      stripe_subscription_id: subscription?.id,
      stripe_customer_id: update.external_customer_id,
      digital_specialist_count: quantity,
      stripe_status: subscription?.status,
    },
  });

  return organizationId;
}

serve(async (req) => {
  if (req.method !== "POST") return respond({ error: "Method not allowed" }, 405);

  try {
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    if (!webhookSecret) throw new Error("STRIPE_WEBHOOK_SECRET is not configured");

    const signature = req.headers.get("stripe-signature") || "";
    const rawBody = await req.text();
    if (!(await verifyStripeSignature(rawBody, signature, webhookSecret))) {
      return respond({ error: "Invalid Stripe signature" }, 400);
    }

    const event = JSON.parse(rawBody);
    const admin = getSupabaseAdmin();
    const { data: existing } = await admin.from("stripe_webhook_events")
      .select("stripe_event_id").eq("stripe_event_id", event.id).maybeSingle();
    if (existing) return respond({ received: true, duplicate: true });

    let organizationId: string | null = null;
    const object = event?.data?.object;

    if (event.type === "checkout.session.completed") {
      organizationId = object?.metadata?.organization_id || null;
      const subscriptionId = typeof object?.subscription === "string" ? object.subscription : object?.subscription?.id;
      if (subscriptionId) {
        const subscription = await stripeGet(`subscriptions/${encodeURIComponent(subscriptionId)}?expand[]=items.data.price`);
        organizationId = await syncSubscription(subscription, organizationId || undefined);
      }
    } else if (["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"].includes(event.type)) {
      organizationId = await syncSubscription(object);
    } else if (["invoice.paid", "invoice.payment_failed"].includes(event.type)) {
      const subscriptionId = typeof object?.subscription === "string" ? object.subscription : object?.subscription?.id;
      if (subscriptionId) {
        const subscription = await stripeGet(`subscriptions/${encodeURIComponent(subscriptionId)}?expand[]=items.data.price`);
        organizationId = await syncSubscription(subscription);
      }
    }

    const { error: ledgerError } = await admin.from("stripe_webhook_events").insert({
      stripe_event_id: event.id,
      event_type: event.type,
      organization_id: organizationId,
      payload: { livemode: event.livemode, api_version: event.api_version },
    });
    if (ledgerError && !ledgerError.message.toLowerCase().includes("duplicate")) {
      throw new Error(`Could not record Stripe event: ${ledgerError.message}`);
    }

    return respond({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("[stripe-webhook]", message);
    return respond({ error: message }, 500);
  }
});
