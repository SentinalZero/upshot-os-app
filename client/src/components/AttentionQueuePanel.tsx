import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, CircleHelp, Lightbulb, Loader2, ShieldAlert } from "lucide-react";
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
    let cancelled = false;

    async function load() {
      const result = await fetchActiveCommandDecisions(organizationId);
      if (cancelled) return;
      setItems(result.data);
      setError(result.error);
      setLoading(false);
    }

    void load();
    const unsubscribe = subscribeToCommandDecisions(organizationId, () => void load());
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
    <section className={`overflow-hidden rounded-2xl border bg-surface ${items.length ? "border-[oklch(0.75_0.18_75/35%)]" : "border-subtle"}`}>
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-subtle p-5">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-wider text-[oklch(0.78_0.16_75)]">Attention Queue</p>
          <h3 className="mt-1 font-display text-lg font-semibold">Decisions that need you</h3>
          <p className="mt-1 text-xs text-muted-foreground">Only unresolved judgments appear here. Completed events remain in Live Operations.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <QueueCount label="Approvals" value={counts.approval} />
          <QueueCount label="Exceptions" value={counts.exception} />
          <QueueCount label="Recommendations" value={counts.recommendation} />
          <QueueCount label="Risks" value={counts.risk} />
        </div>
      </div>

      {error && <div className="border-b border-subtle bg-[oklch(0.62_0.22_25/8%)] px-5 py-3 text-xs text-[oklch(0.75_0.18_25)]">{error}</div>}

      {loading ? (
        <div className="flex items-center gap-3 p-5 text-xs text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin text-gold" />Loading active decisions...</div>
      ) : items.length ? (
        <div className="grid grid-cols-1 divide-y divide-subtle lg:grid-cols-2 lg:divide-x lg:divide-y-0">
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
        <div className="flex items-center gap-3 p-5 text-xs text-muted-foreground">
          <CheckCircle2 className="h-5 w-5 text-[oklch(0.75_0.18_155)]" />
          No unresolved approvals, exceptions, recommendations, or risks are assigned to you.
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
  const primaryStatus: CommandDecisionStatus = item.category === "approval" ? "approved" : item.category === "recommendation" ? "approved" : "resolved";
  const primaryLabel = item.category === "approval" ? "Approve" : item.category === "recommendation" ? "Accept" : "Resolve";

  return (
    <article className="flex h-full flex-col gap-4 p-5">
      <div className="flex gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${config.iconClass}`}><Icon className="h-4 w-4" /></div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2 py-1 text-[9px] font-mono font-semibold uppercase tracking-wider ${config.badgeClass}`}>{config.label}</span>
            <span className="rounded-full border border-subtle px-2 py-1 text-[9px] font-mono uppercase tracking-wider text-muted-foreground">{item.status.replace("_", " ")}</span>
            <span className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">{item.urgency} urgency</span>
          </div>
          <h4 className="mt-2 text-sm font-semibold">{item.title}</h4>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.summary || "Human judgment is required before work can continue."}</p>
        </div>
      </div>

      <div className="space-y-3 rounded-lg border border-subtle bg-background/30 p-3">
        <QueueDetail label="Business impact" value={item.business_impact || "This decision may affect the Specialist's ability to complete assigned work."} />
        <QueueDetail label="Upshot recommends" value={item.recommended_action || "Review the available context and choose the safest next action."} />
        <QueueDetail label="Your decision" value={item.requested_decision || "Choose how the Specialist should proceed."} strong />
      </div>

      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-subtle pt-4">
        <span className="text-[10px] text-gold">{specialistName}</span>
        <div className="flex flex-wrap gap-2">
          {item.workflow_execution_id && <button type="button" onClick={() => onOpenExecution(item.workflow_execution_id!, item.title, specialistName)} className="rounded-lg border border-subtle px-3 py-1.5 text-[10px] font-semibold text-muted-foreground hover:text-foreground">View context</button>}
          {item.status === "open" && <button type="button" disabled={updating} onClick={() => onStatus("in_review")} className="rounded-lg border border-subtle px-3 py-1.5 text-[10px] font-semibold text-muted-foreground hover:text-foreground">Start review</button>}
          {(item.category === "approval" || item.category === "recommendation") && <button type="button" disabled={updating} onClick={() => onStatus("rejected")} className="rounded-lg border border-[oklch(0.62_0.22_25/30%)] px-3 py-1.5 text-[10px] font-semibold text-[oklch(0.75_0.18_25)]">Reject</button>}
          <button type="button" disabled={updating} onClick={() => onStatus(primaryStatus)} className="rounded-lg bg-gold px-3 py-1.5 text-[10px] font-semibold text-[#1a1000] disabled:opacity-60">{updating ? "Saving..." : primaryLabel}</button>
        </div>
      </div>
    </article>
  );
}

function QueueCount({ label, value }: { label: string; value: number }) {
  return <span className="rounded-full border border-subtle bg-background/30 px-2.5 py-1 text-[9px] font-mono text-muted-foreground">{label} {value}</span>;
}

function QueueDetail({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return <div><p className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">{label}</p><p className={`mt-1 text-[11px] leading-4 ${strong ? "font-semibold text-foreground" : "text-foreground/75"}`}>{value}</p></div>;
}

const categoryConfig: Record<CommandDecisionCategory, { label: string; icon: typeof AlertTriangle; iconClass: string; badgeClass: string }> = {
  approval: { label: "Approval", icon: CircleHelp, iconClass: "bg-gold/10 text-gold", badgeClass: "bg-gold/10 text-gold" },
  exception: { label: "Exception", icon: AlertTriangle, iconClass: "bg-[oklch(0.75_0.18_75/12%)] text-[oklch(0.78_0.16_75)]", badgeClass: "bg-[oklch(0.75_0.18_75/12%)] text-[oklch(0.78_0.16_75)]" },
  recommendation: { label: "Recommendation", icon: Lightbulb, iconClass: "bg-[oklch(0.7_0.14_230/12%)] text-[oklch(0.78_0.12_230)]", badgeClass: "bg-[oklch(0.7_0.14_230/12%)] text-[oklch(0.78_0.12_230)]" },
  risk: { label: "Risk", icon: ShieldAlert, iconClass: "bg-[oklch(0.62_0.22_25/12%)] text-[oklch(0.75_0.18_25)]", badgeClass: "bg-[oklch(0.62_0.22_25/12%)] text-[oklch(0.75_0.18_25)]" },
};
