import { useEffect, useState } from "react";
import { AlertTriangle, CreditCard, Loader2, RefreshCw, Workflow } from "lucide-react";
import { fetchBillingUsage, type BillingUsageSnapshot } from "@/lib/billingUsageService";
import { createStripeCheckoutSession } from "@/lib/stripeBillingService";

export function BillingUsagePanel({ organizationId }: { organizationId: string }) {
  const [snapshot, setSnapshot] = useState<BillingUsageSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    const result = await fetchBillingUsage(organizationId);
    setSnapshot(result.data);
    setError(result.error);
    setLoading(false);
  };

  useEffect(() => { void load(); }, [organizationId]);

  const startCheckout = async () => {
    setCheckoutLoading(true);
    setCheckoutError(null);
    const result = await createStripeCheckoutSession(organizationId, 1);
    setCheckoutLoading(false);
    if (!result.success || !result.url) {
      setCheckoutError(result.error || "Stripe Checkout could not be started.");
      return;
    }
    window.location.assign(result.url);
  };

  if (loading) return <div className="mt-6 flex min-h-40 items-center justify-center rounded-xl border border-subtle bg-background/35"><RefreshCw className="h-5 w-5 animate-spin text-gold" /></div>;
  if (error) return <div className="mt-6 rounded-xl border border-[oklch(0.62_0.22_25/35%)] bg-[oklch(0.62_0.22_25/8%)] p-4 text-xs text-[oklch(0.75_0.18_25)]">{error}</div>;
  if (!snapshot) return null;

  const price = new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(snapshot.subscription.monthlyPriceCents / 100);
  const trialing = snapshot.subscription.status === "trialing";
  const active = snapshot.subscription.status === "active";
  const trialExpired = trialing && Date.parse(snapshot.subscription.trialEndsAt) <= Date.now();
  const inactive = ["past_due", "paused", "canceled"].includes(snapshot.subscription.status);
  const limitReached = snapshot.usage.workflowRunsRemaining <= 0;
  const restricted = trialExpired || inactive || limitReached;
  const nearLimit = !limitReached && snapshot.usage.percentUsed >= 80;

  return (
    <div className="mt-6 space-y-6">
      {(restricted || nearLimit) && (
        <section className={`rounded-xl border p-5 ${restricted ? "border-[oklch(0.62_0.22_25/35%)] bg-[oklch(0.62_0.22_25/8%)]" : "border-gold/35 bg-gold/5"}`}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex max-w-2xl items-start gap-3">
              <AlertTriangle className={`mt-0.5 h-5 w-5 ${restricted ? "text-[oklch(0.75_0.18_25)]" : "text-gold"}`} />
              <div>
                <h3 className="text-sm font-semibold">{restricted ? "Workflow runs are restricted" : "Workflow allowance is running low"}</h3>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{billingMessage(snapshot, trialExpired, inactive, limitReached)}</p>
              </div>
            </div>
            {!active && (
              <button type="button" onClick={() => void startCheckout()} disabled={checkoutLoading} className="inline-flex items-center gap-2 rounded-lg bg-gold px-4 py-2.5 text-xs font-semibold text-black disabled:cursor-not-allowed disabled:opacity-60">
                {checkoutLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                {checkoutLoading ? "Opening Checkout..." : "Activate Starter Plan"}
              </button>
            )}
          </div>
          {checkoutError && <p className="mt-3 text-xs text-[oklch(0.75_0.18_25)]">{checkoutError}</p>}
        </section>
      )}

      <section className="rounded-xl border border-subtle bg-background/35 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3"><CreditCard className="mt-0.5 h-5 w-5 text-gold" /><div><p className="text-[10px] font-mono uppercase tracking-wider text-gold">Upshot Starter</p><h3 className="mt-1 text-lg font-semibold">{price} per month</h3><p className="mt-1 text-xs text-muted-foreground">One Digital Specialist subscription with guided deployment and measurable workflow usage.</p></div></div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-subtle px-3 py-1.5 text-[10px] font-mono font-semibold capitalize text-gold">{snapshot.subscription.status.replaceAll("_", " ")}</span>
            {!active && (
              <button type="button" onClick={() => void startCheckout()} disabled={checkoutLoading} className="inline-flex items-center gap-2 rounded-lg bg-gold px-4 py-2 text-xs font-semibold text-black disabled:cursor-not-allowed disabled:opacity-60">
                {checkoutLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                {checkoutLoading ? "Opening..." : "Subscribe for $99/month"}
              </button>
            )}
          </div>
        </div>
        {checkoutError && <p className="mt-4 text-xs text-[oklch(0.75_0.18_25)]">{checkoutError}</p>}
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Metric label="Monthly workflow runs" value={snapshot.subscription.workflowRunLimit.toLocaleString()} />
          <Metric label="Data retention" value={`${snapshot.subscription.retentionDays} days`} />
          <Metric label={trialing ? "Trial ends" : "Period renews"} value={formatDate(trialing ? snapshot.subscription.trialEndsAt : snapshot.subscription.currentPeriodEnd)} />
        </div>
      </section>

      <section className="rounded-xl border border-subtle bg-background/35 p-5">
        <div className="flex items-center justify-between gap-3"><div className="flex items-start gap-3"><Workflow className="mt-0.5 h-5 w-5 text-gold" /><div><h3 className="text-sm font-semibold">Workflow usage</h3><p className="mt-1 text-xs text-muted-foreground">Current billing period · {formatDate(snapshot.subscription.currentPeriodStart)} to {formatDate(snapshot.subscription.currentPeriodEnd)}</p></div></div><button type="button" onClick={() => void load()} className="rounded-lg border border-subtle p-2 text-muted-foreground hover:text-foreground" aria-label="Refresh usage"><RefreshCw className="h-4 w-4" /></button></div>
        <div className="mt-6 flex items-end justify-between gap-4"><div><p className="font-display text-3xl font-bold">{snapshot.usage.workflowRunsUsed.toLocaleString()}</p><p className="mt-1 text-xs text-muted-foreground">of {snapshot.usage.workflowRunsLimit.toLocaleString()} runs used</p></div><p className={`text-xs font-semibold ${limitReached ? "text-[oklch(0.75_0.18_25)]" : "text-gold"}`}>{snapshot.usage.workflowRunsRemaining.toLocaleString()} remaining</p></div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-gold transition-all" style={{ width: `${snapshot.usage.percentUsed}%` }} /></div>
        <p className="mt-3 text-[10px] text-muted-foreground">New manual and automated executions are blocked when the subscription is inactive, the trial has expired, or the monthly allowance has been reached.</p>
      </section>
    </div>
  );
}

function billingMessage(snapshot: BillingUsageSnapshot, trialExpired: boolean, inactive: boolean, limitReached: boolean): string {
  if (trialExpired) return "The workspace trial has ended. Activate the Starter plan to continue running Digital Specialist workflows.";
  if (inactive) return `The subscription is ${snapshot.subscription.status.replaceAll("_", " ")}. Workflow execution remains paused until billing is restored.`;
  if (limitReached) return `All ${snapshot.usage.workflowRunsLimit.toLocaleString()} workflow runs for this billing period have been used.`;
  return `${snapshot.usage.workflowRunsRemaining.toLocaleString()} workflow runs remain in the current billing period.`;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-subtle bg-surface/50 p-4"><p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-2 text-sm font-semibold">{value}</p></div>;
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not available" : date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
