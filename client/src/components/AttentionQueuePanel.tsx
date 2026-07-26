import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, CircleHelp, Lightbulb, Loader2, ShieldAlert } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchActiveCommandDecisions,
  subscribeToCommandDecisions,
  updateCommandDecision,
  type CommandDecision,
  type CommandDecisionCategory,
  type CommandDecisionStatus,
} from "@/lib/commandDecisionService";

interface AttentionQueuePanelProps {
  specialistNameById: Record<string, string>;
  onOpenExecution: (executionId: string, title: string, specialistName?: string) => void;
}

export function AttentionQueuePanel({ specialistNameById, onOpenExecution }: AttentionQueuePanelProps) {
  const { profile } = useAuth();
  const organizationId = profile?.active_organization_id;
  const [items, setItems] = useState<CommandDecision[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    if (!organizationId) return;
    const activeOrganizationId = organizationId;
    let cancelled = false;

    async function load() {
      const result = await fetchActiveCommandDecisions(activeOrganizationId);
      if (cancelled) return;
      setItems(result.data);
      setError(result.error);
      setLoading(false);
    }

    void load();
    const unsubscribe = subscribeToCommandDecisions(activeOrganizationId, () => void load());
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [organizationId]);

  const counts = useMemo(
    () => items.reduce<Record<CommandDecisionCategory, number>>(
      (result, item) => ({ ...result, [item.category]: result[item.category] + 1 }),
      { approval: 0, exception: 0, recommendation: 0, risk: 0 },
    ),
    [items],
  );

  const applyStatus = async (decision: CommandDecision, status: CommandDecisionStatus) => {
    if (!organizationId) return;
    setUpdatingId(decision.id);
    setError(null);
    const result = await updateCommandDecision(organizationId, decision.id, status);
    setUpdatingId(null);
    if (!result.success) {
      setError(result.error || "The decision could not be updated.");
      return;
    }
    setItems(current => current.filter(item => item.id !== decision.id));
  };

  return (
    <section className={`overflow-hidden rounded-3xl border bg-surface ${items.length ? "border-[oklch(0.75_0.18_75/35%)]" : "border-subtle"}`}>
      <div className="flex flex-wrap items-start justify-between gap-5 border-b border-subtle p-6">
        <div className="max-w-2xl">
          <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-gold">Needs your judgment</p>
          <h3 className="mt-1 font-display text-xl font-semibold">Your Specialists paused here for a reason</h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Review the context, see the recommended action, and decide how work should continue. Everything that does not require you keeps moving.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <QueueCount label="Approvals" value={counts.approval} />
          <QueueCount label="Exceptions" value={counts.exception} />
          <QueueCount label="Recommendations" value={counts.recommendation} />
          <QueueCount label="Risks" value={counts.risk} />
        </div>
      </div>

      {error && <div className="border-b border-subtle bg-[oklch(0.62_0.22_25/8%)] px-6 py-3 text-xs text-[oklch(0.75_0.18_25)]">{error}</div>}

      {loading ? (
        <div className="flex items-center gap-3 p-6 text-xs text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin text-gold" />Checking for decisions that need you...</div>
      ) : items.length ? (
        <div className="grid grid-cols-1 divide-y divide-subtle xl:grid-cols-2 xl:divide-x xl:divide-y-0">
          {items.slice(0, 6).map(item => (
            <DecisionItem
              key={item.id}
              item={item}
              specialistName={item.specialist_id ? specialistNameById[item.specialist_id] : "Workspace"}
              updating={updatingId === item.id}
              onStatus={status => void applyStatus(item, status)}
              onOpenExecution={onOpenExecution}
            />
          ))}
        </div>
      ) : (
        <div className="flex items-start gap-4 p-6">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-emerald-400/10 text-emerald-400"><CheckCircle2 className="h-5 w-5" /></div>
          <div><p className="text-sm font-semibold">Nothing needs your attention.</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Your Specialists can continue operating within their configured authority and approval boundaries.</p></div>
        </div>
      )}
    </section>
  );
}

function DecisionItem({ item, specialistName, updating, onStatus, onOpenExecution }: {
  item: CommandDecision;
  specialistName: string;
  updating: boolean;
  onStatus: (status: CommandDecisionStatus) => void;
  onOpenExecution: AttentionQueuePanelProps["onOpenExecution"];
}) {
  const config = categoryConfig[item.category];
  const Icon = config.icon;
  const primaryStatus: CommandDecisionStatus = item.category === "approval" || item.category === "recommendation" ? "approved" : "resolved";
  const primaryLabel = item.category === "approval" ? "Approve and continue" : item.category === "recommendation" ? "Accept recommendation" : "Resolve and continue";
  const nextStep = nextStepCopy(item.category, primaryLabel);

  return (
    <article className="flex h-full flex-col p-6">
      <div className="flex gap-4">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${config.iconClass}`}><Icon className="h-5 w-5" /></div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2.5 py-1 text-[9px] font-mono font-semibold uppercase tracking-wider ${config.badgeClass}`}>{config.label}</span>
            <span className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">{item.urgency} urgency</span>
          </div>
          <p className="mt-3 text-[10px] font-mono uppercase tracking-[0.14em] text-muted-foreground">Decision needed</p>
          <h4 className="mt-1 font-display text-lg font-semibold leading-6">{item.title}</h4>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.summary || "Human judgment is required before this work can continue."}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <DecisionBlock label="Why it matters" value={item.business_impact || "This decision affects whether the Specialist can safely complete the assigned work."} />
        <DecisionBlock label="Specialist recommends" value={item.recommended_action || "Review the available context and choose the safest next action."} emphasized />
      </div>

      <div className="mt-3 rounded-2xl border border-gold/20 bg-gold/5 p-4">
        <p className="text-[9px] font-mono uppercase tracking-[0.14em] text-gold">Your decision</p>
        <p className="mt-2 text-sm font-semibold leading-6">{item.requested_decision || "Choose how the Specialist should proceed."}</p>
      </div>

      <div className="mt-3 flex items-start gap-3 rounded-2xl border border-subtle bg-background/30 p-4">
        <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
        <div><p className="text-[9px] font-mono uppercase tracking-[0.14em] text-muted-foreground">What happens next</p><p className="mt-1 text-xs leading-5 text-foreground/80">{nextStep}</p></div>
      </div>

      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-5">
        <div><p className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">Waiting Specialist</p><p className="mt-1 text-xs font-semibold text-gold">{specialistName}</p></div>
        <div className="flex flex-wrap gap-2">
          {item.workflow_execution_id && <button type="button" onClick={() => onOpenExecution(item.workflow_execution_id!, item.title, specialistName)} className="rounded-xl border border-subtle px-3 py-2 text-[10px] font-semibold text-muted-foreground hover:text-foreground">View full context</button>}
          {(item.category === "approval" || item.category === "recommendation") && <button type="button" disabled={updating} onClick={() => onStatus("rejected")} className="rounded-xl border border-[oklch(0.62_0.22_25/30%)] px-3 py-2 text-[10px] font-semibold text-[oklch(0.75_0.18_25)] disabled:opacity-60">Reject</button>}
          <button type="button" disabled={updating} onClick={() => onStatus(primaryStatus)} className="rounded-xl bg-gold px-4 py-2 text-[10px] font-semibold text-[#1a1000] disabled:opacity-60">{updating ? "Saving decision..." : primaryLabel}</button>
        </div>
      </div>
    </article>
  );
}

function QueueCount({ label, value }: { label: string; value: number }) {
  return <span className={`rounded-full border px-3 py-1.5 text-[9px] font-mono ${value > 0 ? "border-gold/25 bg-gold/5 text-gold" : "border-subtle bg-background/30 text-muted-foreground"}`}>{label} {value}</span>;
}

function DecisionBlock({ label, value, emphasized = false }: { label: string; value: string; emphasized?: boolean }) {
  return <div className={`rounded-2xl border p-4 ${emphasized ? "border-gold/20 bg-gold/5" : "border-subtle bg-background/30"}`}><p className={`text-[9px] font-mono uppercase tracking-[0.14em] ${emphasized ? "text-gold" : "text-muted-foreground"}`}>{label}</p><p className="mt-2 text-xs leading-5 text-foreground/80">{value}</p></div>;
}

function nextStepCopy(category: CommandDecisionCategory, primaryLabel: string): string {
  if (category === "approval") return `Selecting “${primaryLabel}” releases the Specialist to complete the pending action and record the outcome.`;
  if (category === "recommendation") return `Selecting “${primaryLabel}” turns the recommendation into an authorized next action for the Specialist.`;
  if (category === "risk") return `Resolving this item records your judgment and allows the Specialist to continue within the updated risk boundary.`;
  return `Resolving this exception records your decision and lets the Specialist resume the paused workflow.`;
}

const categoryConfig: Record<CommandDecisionCategory, { label: string; icon: typeof AlertTriangle; iconClass: string; badgeClass: string }> = {
  approval: { label: "Approval", icon: CircleHelp, iconClass: "bg-gold/10 text-gold", badgeClass: "bg-gold/10 text-gold" },
  exception: { label: "Exception", icon: AlertTriangle, iconClass: "bg-[oklch(0.75_0.18_75/12%)] text-[oklch(0.78_0.16_75)]", badgeClass: "bg-[oklch(0.75_0.18_75/12%)] text-[oklch(0.78_0.16_75)]" },
  recommendation: { label: "Recommendation", icon: Lightbulb, iconClass: "bg-[oklch(0.7_0.14_230/12%)] text-[oklch(0.78_0.12_230)]", badgeClass: "bg-[oklch(0.7_0.14_230/12%)] text-[oklch(0.78_0.12_230)]" },
  risk: { label: "Risk", icon: ShieldAlert, iconClass: "bg-[oklch(0.62_0.22_25/12%)] text-[oklch(0.75_0.18_25)]", badgeClass: "bg-[oklch(0.62_0.22_25/12%)] text-[oklch(0.75_0.18_25)]" },
};