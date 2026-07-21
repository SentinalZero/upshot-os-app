import { useEffect, useState } from "react";
import { CreditCard, RefreshCw, Workflow } from "lucide-react";
import { fetchBillingUsage, type BillingUsageSnapshot } from "@/lib/billingUsageService";

export function BillingUsagePanel({ organizationId }: { organizationId: string }) {
  const [snapshot, setSnapshot] = useState<BillingUsageSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    const result = await fetchBillingUsage(organizationId);
    setSnapshot(result.data);
    setError(result.error);
    setLoading(false);
  };

  useEffect(() => { void load(); }, [organizationId]);

  if (loading) return <div className="mt-6 flex min-h-40 items-center justify-center rounded-xl border border-subtle bg-background/35"><RefreshCw className="h-5 w-5 animate-spin text-gold" /></div>;
  if (error) return <div className="mt-6 rounded-xl border border-[oklch(0.62_0.22_25/35%)] bg-[oklch(0.62_0.22_25/8%)] p-4 text-xs text-[oklch(0.75_0.18_25)]">{error}</div>;
  if (!snapshot) return null;

  const price = new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(snapshot.subscription.monthlyPriceCents / 100);
  const trialing = snapshot.subscription.status === "trialing";

  return (
    <div className="mt-6 space-y-6">
      <section className="rounded-xl border border-subtle bg-background/35 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3"><CreditCard className="mt-0.5 h-5 w-5 text-gold" /><div><p className="text-[10px] font-mono uppercase tracking-wider text-gold">Upshot Starter</p><h3 className="mt-1 text-lg font-semibold">{price} per month</h3><p className="mt-1 text-xs text-muted-foreground">Built for one operational workspace with guided deployment and measurable usage.</p></div></div>
          <span className="rounded-full border border-subtle px-3 py-1.5 text-[10px] font-mono font-semibold capitalize text-gold">{snapshot.subscription.status.replaceAll("_", " ")}</span>
        </div>
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Metric label="Monthly workflow runs" value={snapshot.subscription.workflowRunLimit.toLocaleString()} />
          <Metric label="Data retention" value={`${snapshot.subscription.retentionDays} days`} />
          <Metric label={trialing ? "Trial ends" : "Period renews"} value={formatDate(trialing ? snapshot.subscription.trialEndsAt : snapshot.subscription.currentPeriodEnd)} />
        </div>
      </section>

      <section className="rounded-xl border border-subtle bg-background/35 p-5">
        <div className="flex items-center justify-between gap-3"><div className="flex items-start gap-3"><Workflow className="mt-0.5 h-5 w-5 text-gold" /><div><h3 className="text-sm font-semibold">Workflow usage</h3><p className="mt-1 text-xs text-muted-foreground">Current billing period · {formatDate(snapshot.subscription.currentPeriodStart)} to {formatDate(snapshot.subscription.currentPeriodEnd)}</p></div></div><button type="button" onClick={() => void load()} className="rounded-lg border border-subtle p-2 text-muted-foreground hover:text-foreground" aria-label="Refresh usage"><RefreshCw className="h-4 w-4" /></button></div>
        <div className="mt-6 flex items-end justify-between gap-4"><div><p className="font-display text-3xl font-bold">{snapshot.usage.workflowRunsUsed.toLocaleString()}</p><p className="mt-1 text-xs text-muted-foreground">of {snapshot.usage.workflowRunsLimit.toLocaleString()} runs used</p></div><p className="text-xs font-semibold text-gold">{snapshot.usage.workflowRunsRemaining.toLocaleString()} remaining</p></div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-gold transition-all" style={{ width: `${snapshot.usage.percentUsed}%` }} /></div>
        <p className="mt-3 text-[10px] text-muted-foreground">Usage is measured when a workflow execution is registered. Limit enforcement and Stripe billing are the next activation steps.</p>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-subtle bg-surface/50 p-4"><p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-2 text-sm font-semibold">{value}</p></div>;
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not available" : date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
