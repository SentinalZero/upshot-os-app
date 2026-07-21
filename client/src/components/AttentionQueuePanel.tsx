import { AlertTriangle, CheckCircle2, ChevronRight, CircleHelp, Lightbulb, ShieldAlert } from "lucide-react";
import type { AttentionQueueItem, AttentionCategory } from "@/lib/attentionQueueService";

interface AttentionQueuePanelProps {
  items: AttentionQueueItem[];
  specialistNameById: Record<string, string>;
  onOpen: (item: AttentionQueueItem["activity"]) => void;
}

export function AttentionQueuePanel({ items, specialistNameById, onOpen }: AttentionQueuePanelProps) {
  const counts = items.reduce<Record<AttentionCategory, number>>(
    (result, item) => ({ ...result, [item.category]: result[item.category] + 1 }),
    { approval: 0, exception: 0, recommendation: 0, risk: 0 },
  );

  return (
    <section className={`overflow-hidden rounded-2xl border bg-surface ${items.length ? "border-[oklch(0.75_0.18_75/35%)]" : "border-subtle"}`}>
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-subtle p-5">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-wider text-[oklch(0.78_0.16_75)]">Attention Queue</p>
          <h3 className="mt-1 font-display text-lg font-semibold">Decisions that need you</h3>
          <p className="mt-1 text-xs text-muted-foreground">Every item explains the impact, Upshot&apos;s recommendation, and the judgment required from you.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <QueueCount label="Approvals" value={counts.approval} />
          <QueueCount label="Exceptions" value={counts.exception} />
          <QueueCount label="Recommendations" value={counts.recommendation} />
          <QueueCount label="Risks" value={counts.risk} />
        </div>
      </div>

      {items.length ? (
        <div className="grid grid-cols-1 divide-y divide-subtle lg:grid-cols-2 lg:divide-x lg:divide-y-0">
          {items.slice(0, 4).map(item => (
            <QueueItem
              key={item.activity.id}
              item={item}
              specialistName={item.activity.digital_specialist_id ? specialistNameById[item.activity.digital_specialist_id] : "Workspace"}
              onOpen={onOpen}
            />
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-3 p-5 text-xs text-muted-foreground">
          <CheckCircle2 className="h-5 w-5 text-[oklch(0.75_0.18_155)]" />
          No approvals, exceptions, recommendations, or risks are waiting for you.
        </div>
      )}
    </section>
  );
}

function QueueItem({ item, specialistName, onOpen }: { item: AttentionQueueItem; specialistName: string; onOpen: AttentionQueuePanelProps["onOpen"] }) {
  const executionId = typeof item.activity.metadata?.execution_id === "string" ? item.activity.metadata.execution_id : "";
  const config = categoryConfig[item.category];
  const Icon = config.icon;
  const body = (
    <>
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${config.iconClass}`}><Icon className="h-4 w-4" /></div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2 py-1 text-[9px] font-mono font-semibold uppercase tracking-wider ${config.badgeClass}`}>{config.label}</span>
              <span className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">{item.urgency} urgency</span>
            </div>
            <h4 className="mt-2 text-sm font-semibold">{item.activity.title || config.fallbackTitle}</h4>
          </div>
        </div>
        <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{item.activity.description || item.activity.message || "Human judgment is required before work can continue."}</p>
        <div className="mt-4 space-y-3 rounded-lg border border-subtle bg-background/30 p-3">
          <QueueDetail label="Business impact" value={item.businessImpact} />
          <QueueDetail label="Upshot recommends" value={item.recommendedAction} />
          <QueueDetail label="Your decision" value={item.requestedDecision} strong />
        </div>
        <div className="mt-3 flex items-center justify-between gap-3"><span className="text-[10px] text-gold">{specialistName}</span>{executionId && <span className="text-[9px] font-mono uppercase tracking-wider text-foreground/60">Open decision</span>}</div>
      </div>
      {executionId && <ChevronRight className="mt-2 h-4 w-4 shrink-0 text-muted-foreground" />}
    </>
  );

  return executionId
    ? <button type="button" onClick={() => onOpen(item.activity)} className="group flex w-full gap-3 p-5 text-left transition-colors hover:bg-background/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gold">{body}</button>
    : <div className="flex gap-3 p-5">{body}</div>;
}

function QueueCount({ label, value }: { label: string; value: number }) {
  return <span className="rounded-full border border-subtle bg-background/30 px-2.5 py-1 text-[9px] font-mono text-muted-foreground">{label} {value}</span>;
}

function QueueDetail({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return <div><p className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">{label}</p><p className={`mt-1 text-[11px] leading-4 ${strong ? "font-semibold text-foreground" : "text-foreground/75"}`}>{value}</p></div>;
}

const categoryConfig: Record<AttentionCategory, { label: string; fallbackTitle: string; icon: typeof AlertTriangle; iconClass: string; badgeClass: string }> = {
  approval: { label: "Approval", fallbackTitle: "Approval requested", icon: CircleHelp, iconClass: "bg-gold/10 text-gold", badgeClass: "bg-gold/10 text-gold" },
  exception: { label: "Exception", fallbackTitle: "Exception needs resolution", icon: AlertTriangle, iconClass: "bg-[oklch(0.75_0.18_75/12%)] text-[oklch(0.78_0.16_75)]", badgeClass: "bg-[oklch(0.75_0.18_75/12%)] text-[oklch(0.78_0.16_75)]" },
  recommendation: { label: "Recommendation", fallbackTitle: "Recommendation ready", icon: Lightbulb, iconClass: "bg-[oklch(0.7_0.14_230/12%)] text-[oklch(0.78_0.12_230)]", badgeClass: "bg-[oklch(0.7_0.14_230/12%)] text-[oklch(0.78_0.12_230)]" },
  risk: { label: "Risk", fallbackTitle: "Risk requires attention", icon: ShieldAlert, iconClass: "bg-[oklch(0.62_0.22_25/12%)] text-[oklch(0.75_0.18_25)]", badgeClass: "bg-[oklch(0.62_0.22_25/12%)] text-[oklch(0.75_0.18_25)]" },
};
