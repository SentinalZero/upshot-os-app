import { Link } from "wouter";
import { Activity, AlertTriangle, CheckCircle2, ChevronRight, Clock3, Plus, Rocket } from "lucide-react";
import type {
  ActivityLog,
  DashboardMetrics,
  DigitalSpecialist,
  SpecialistOperationalSummary,
  WorkforceState,
} from "@/lib/supabaseService";

interface CommandCenterWorkforceProps {
  loading: boolean;
  specialists: DigitalSpecialist[];
  workflowCounts: Record<string, number>;
  specialistSummaries: Record<string, SpecialistOperationalSummary>;
  recentActivity: ActivityLog[];
  specialistNameById: Record<string, string>;
  metrics: DashboardMetrics;
  onOpenActivity: (item: ActivityLog) => void;
  onOpenSpecialist: (specialist: DigitalSpecialist) => void;
}

export function CommandCenterWorkforce({
  loading,
  specialists,
  workflowCounts,
  specialistSummaries,
  recentActivity,
  specialistNameById,
  metrics,
  onOpenActivity,
  onOpenSpecialist,
}: CommandCenterWorkforceProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-gold border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-muted-foreground font-mono">Bringing your workforce online...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1.35fr_0.85fr] gap-8 items-start">
      <section className="rounded-2xl border border-subtle bg-surface overflow-hidden">
        <div className="p-5 border-b border-subtle flex items-center justify-between">
          <div>
            <p className="text-[10px] font-mono text-muted-foreground tracking-wider uppercase">Workforce</p>
            <strong className="text-sm font-display">Digital Specialists</strong>
          </div>
          <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-semibold flex items-center gap-1.5 bg-[oklch(0.75_0.18_155/15%)] text-[oklch(0.75_0.18_155)]">
            <span className="w-1.5 h-1.5 rounded-full bg-[oklch(0.75_0.18_155)]" />
            {metrics.activeSpecialists} Online
          </span>
        </div>

        {specialists.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-5">
            {specialists.map(specialist => (
              <SpecialistCard
                key={specialist.id}
                specialist={specialist}
                summary={specialistSummaries[specialist.id]}
                capabilityCount={workflowCounts[specialist.id] || 0}
                onOpen={onOpenSpecialist}
              />
            ))}
          </div>
        ) : (
          <div className="p-8 text-center">
            <Rocket className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-medium mb-1">Your workforce is ready to be built</p>
            <p className="text-xs text-muted-foreground mb-4">Hire your first Digital Specialist to create operational capacity.</p>
            <Link
              href="/app/deploy"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-xs text-[#1a1000]"
              style={{ backgroundColor: "oklch(0.65 0.14 75)" }}
            >
              <Plus className="w-3 h-3" /> Hire First Specialist
            </Link>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-subtle bg-surface overflow-hidden xl:sticky xl:top-24">
        <div className="p-5 border-b border-subtle flex items-center justify-between">
          <div>
            <p className="text-[10px] font-mono text-muted-foreground tracking-wider uppercase">Live Activity</p>
            <strong className="text-sm font-display">Workforce Timeline</strong>
          </div>
          <Activity className="w-4 h-4 text-gold" />
        </div>

        {recentActivity.length > 0 ? (
          <div className="divide-y divide-subtle max-h-[700px] overflow-y-auto">
            {recentActivity.map(item => (
              <TimelineItem
                key={item.id}
                item={item}
                specialistName={item.digital_specialist_id ? specialistNameById[item.digital_specialist_id] : undefined}
                onOpen={onOpenActivity}
              />
            ))}
          </div>
        ) : (
          <div className="p-8 text-center">
            <Clock3 className="w-7 h-7 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No workforce activity yet</p>
            <p className="text-xs text-muted-foreground mt-1">Completed jobs and review requests will appear here live.</p>
          </div>
        )}
      </section>
    </div>
  );
}

function SpecialistCard({
  specialist,
  summary,
  capabilityCount,
  onOpen,
}: {
  specialist: DigitalSpecialist;
  summary?: SpecialistOperationalSummary;
  capabilityCount: number;
  onOpen: (specialist: DigitalSpecialist) => void;
}) {
  const lifecycleStatus = (specialist.framework_lifecycle_status || specialist.status || "").toLowerCase();
  const deactivated = ["inactive", "paused", "retired", "terminated"].includes(lifecycleStatus);
  const state = deactivated ? "offline" : (summary?.state || "offline");
  const status = deactivated
    ? {
        label: "Deactivated",
        badgeClass: "bg-muted/50 text-muted-foreground",
        dotClass: "bg-muted-foreground",
      }
    : workforceStateConfig[state];

  return (
    <button
      type="button"
      onClick={() => onOpen(specialist)}
      className={`group w-full rounded-xl border p-5 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold ${
        deactivated
          ? "border-dashed border-subtle bg-background/20 opacity-75 hover:opacity-100"
          : "border-subtle bg-background/35 hover:border-foreground/20 hover:bg-background/55"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-lg font-semibold truncate">{specialist.name}</p>
          <p className="text-xs text-muted-foreground truncate">{specialist.role_name || "Digital Specialist"}</p>
        </div>
        <span className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-mono font-semibold ${status.badgeClass}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${status.dotClass} ${state === "working" && !deactivated ? "animate-pulse" : ""}`} />
          {status.label}
        </span>
      </div>

      <div className="mt-5 rounded-lg border border-subtle bg-surface/60 p-3">
        <p className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground mb-1">Current Work</p>
        <p className="text-xs font-medium line-clamp-2">
          {deactivated ? "Deactivated. No new work will be assigned." : summary?.currentJob || "Ready for work"}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3 mt-4">
        <CardMetric label="Jobs Today" value={summary?.completedToday || 0} />
        <CardMetric label="Capabilities" value={capabilityCount} />
        <CardMetric label="Review" value={summary?.needsReview || 0} alert={(summary?.needsReview || 0) > 0} />
      </div>

      <div className="flex items-center justify-between mt-4 pt-4 border-t border-subtle text-[10px] text-muted-foreground">
        <span>{specialist.industry_name || "General Operations"}</span>
        <span className="flex items-center gap-1.5">
          {deactivated ? "Manage specialist" : "View profile"}
          <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:text-gold" />
        </span>
      </div>
    </button>
  );
}

function TimelineItem({ item, specialistName, onOpen }: { item: ActivityLog; specialistName?: string; onOpen: (item: ActivityLog) => void }) {
  const severity = item.severity?.toLowerCase();
  const isWarning = severity === "warning" || severity === "critical";
  const isSuccess = severity === "success";
  const Icon = isWarning ? AlertTriangle : isSuccess ? CheckCircle2 : Activity;
  const executionId = typeof item.metadata?.execution_id === "string" ? item.metadata.execution_id : "";
  const canOpen = !!executionId;

  const content = (
    <>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
        isWarning
          ? "bg-[oklch(0.62_0.22_25/12%)] text-[oklch(0.75_0.18_25)]"
          : isSuccess
            ? "bg-[oklch(0.75_0.18_155/12%)] text-[oklch(0.75_0.18_155)]"
            : "bg-gold/10 text-gold"
      }`}>
        <Icon className="w-3.5 h-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs font-semibold leading-5">{item.title || item.message || "Operational activity"}</p>
          <span className="text-[9px] font-mono text-muted-foreground whitespace-nowrap">{formatActivityTime(item.created_at)}</span>
        </div>
        <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
          {item.description || item.message || item.activity_type || item.event_type || "Activity recorded"}
        </p>
        <div className="mt-1.5 flex items-center justify-between gap-3">
          {specialistName ? <p className="text-[10px] text-gold">{specialistName}</p> : <span />}
          {canOpen && <span className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">View details</span>}
        </div>
      </div>
      {canOpen && <ChevronRight className="mt-2 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-gold" />}
    </>
  );

  if (canOpen) {
    return (
      <button
        type="button"
        onClick={() => onOpen(item)}
        className="group flex w-full gap-3 px-5 py-4 text-left transition-colors hover:bg-background/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gold"
      >
        {content}
      </button>
    );
  }

  return <div className="flex gap-3 px-5 py-4">{content}</div>;
}

const workforceStateConfig: Record<WorkforceState, { label: string; badgeClass: string; dotClass: string }> = {
  working: { label: "Working", badgeClass: "bg-[oklch(0.75_0.18_155/15%)] text-[oklch(0.75_0.18_155)]", dotClass: "bg-[oklch(0.75_0.18_155)]" },
  idle: { label: "Ready", badgeClass: "bg-gold/10 text-gold", dotClass: "bg-gold" },
  needs_review: { label: "Needs Review", badgeClass: "bg-[oklch(0.75_0.18_75/15%)] text-[oklch(0.78_0.16_75)]", dotClass: "bg-[oklch(0.78_0.16_75)]" },
  failed: { label: "Failed", badgeClass: "bg-[oklch(0.62_0.22_25/15%)] text-[oklch(0.75_0.18_25)]", dotClass: "bg-[oklch(0.75_0.18_25)]" },
  offline: { label: "Offline", badgeClass: "bg-muted/50 text-muted-foreground", dotClass: "bg-muted-foreground" },
};

function CardMetric({ label, value, alert }: { label: string; value: number; alert?: boolean }) {
  return (
    <div>
      <p className={`text-sm font-mono font-bold ${alert ? "text-[oklch(0.75_0.18_25)]" : ""}`}>{value}</p>
      <p className="text-[9px] text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}

function formatActivityTime(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
