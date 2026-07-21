import { Link } from "wouter";
import { Activity, AlertTriangle, CheckCircle2, ChevronRight, Clock3, Plus, Radar, Rocket, ShieldCheck, Sparkles } from "lucide-react";
import type { ActivityLog, DashboardMetrics, DigitalSpecialist, SpecialistOperationalSummary, WorkforceState } from "@/lib/supabaseService";

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

export function CommandCenterWorkforce({ loading, specialists, workflowCounts, specialistSummaries, recentActivity, specialistNameById, metrics, onOpenActivity, onOpenSpecialist }: CommandCenterWorkforceProps) {
  if (loading) return <div className="flex items-center justify-center py-16"><div className="flex flex-col items-center gap-3"><div className="h-6 w-6 animate-spin rounded-full border-2 border-gold border-t-transparent" /><p className="text-xs font-mono text-muted-foreground">Bringing your workforce online...</p></div></div>;

  const reviewCount = specialists.reduce((total, specialist) => total + (specialistSummaries[specialist.id]?.needsReview || 0), 0);
  const capabilityCount = Object.values(workflowCounts).reduce((total, count) => total + count, 0);
  const workingCount = specialists.filter(specialist => specialistSummaries[specialist.id]?.state === "working").length;

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-2xl border border-gold/25 bg-gradient-to-br from-gold/12 via-surface to-background/70 shadow-[0_28px_90px_-60px_oklch(0.72_0.15_75)]">
        <div className="flex flex-wrap items-start justify-between gap-5 border-b border-gold/15 p-5 sm:p-6">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-gold"><Sparkles className="h-4 w-4" /><p className="text-[10px] font-mono uppercase tracking-[0.2em]">Command Center</p></div>
            <h2 className="mt-2 font-display text-2xl font-semibold sm:text-3xl">Your workforce, visible and under control</h2>
            <p className="mt-3 text-xs leading-5 text-muted-foreground">See what every Specialist is doing, what needs your judgment, and what has already been completed. Nothing executes outside the authority you configured.</p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-[oklch(0.75_0.18_155/30%)] bg-[oklch(0.75_0.18_155/10%)] px-3 py-1.5 text-[10px] font-mono font-semibold text-[oklch(0.75_0.18_155)]"><ShieldCheck className="h-3.5 w-3.5" />Oversight active</span>
        </div>
        <div className="grid grid-cols-2 gap-px bg-gold/10 sm:grid-cols-4">
          <CommandMetric label="Specialists online" value={metrics.activeSpecialists} detail={`${workingCount} working now`} />
          <CommandMetric label="Capabilities" value={capabilityCount} detail="Across your workforce" />
          <CommandMetric label="Needs your review" value={reviewCount} detail={reviewCount ? "Attention requested" : "Nothing waiting"} alert={reviewCount > 0} />
          <CommandMetric label="Recent activity" value={recentActivity.length} detail="Visible in the timeline" />
        </div>
      </section>

      <div className="grid grid-cols-1 items-start gap-8 xl:grid-cols-[1.35fr_0.85fr]">
        <section className="overflow-hidden rounded-2xl border border-subtle bg-surface">
          <div className="flex items-center justify-between border-b border-subtle p-5">
            <div><p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Workforce</p><strong className="font-display text-sm">Digital Specialists</strong></div>
            <span className="flex items-center gap-1.5 rounded-full bg-[oklch(0.75_0.18_155/15%)] px-2.5 py-1 text-[10px] font-mono font-semibold text-[oklch(0.75_0.18_155)]"><span className="h-1.5 w-1.5 rounded-full bg-[oklch(0.75_0.18_155)]" />{metrics.activeSpecialists} Online</span>
          </div>

          {specialists.length > 0 ? <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2">{specialists.map(specialist => <SpecialistCard key={specialist.id} specialist={specialist} summary={specialistSummaries[specialist.id]} capabilityCount={workflowCounts[specialist.id] || 0} onOpen={onOpenSpecialist} />)}</div> : <div className="p-8 text-center"><Rocket className="mx-auto mb-3 h-8 w-8 text-muted-foreground" /><p className="mb-1 text-sm font-medium">Your workforce is ready to be built</p><p className="mb-4 text-xs text-muted-foreground">Hire your first Digital Specialist to create operational capacity.</p><Link href="/app/deploy" className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold text-[#1a1000]" style={{ backgroundColor: "oklch(0.65 0.14 75)" }}><Plus className="h-3 w-3" /> Hire First Specialist</Link></div>}
        </section>

        <section className="overflow-hidden rounded-2xl border border-subtle bg-surface xl:sticky xl:top-24">
          <div className="flex items-center justify-between border-b border-subtle p-5"><div><p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Live Activity</p><strong className="font-display text-sm">Workforce Timeline</strong></div><Radar className="h-4 w-4 text-gold" /></div>
          {recentActivity.length > 0 ? <div className="max-h-[700px] divide-y divide-subtle overflow-y-auto">{recentActivity.map(item => <TimelineItem key={item.id} item={item} specialistName={item.digital_specialist_id ? specialistNameById[item.digital_specialist_id] : undefined} onOpen={onOpenActivity} />)}</div> : <div className="p-8 text-center"><Clock3 className="mx-auto mb-3 h-7 w-7 text-muted-foreground" /><p className="text-sm text-muted-foreground">No workforce activity yet</p><p className="mt-1 text-xs text-muted-foreground">Completed jobs and review requests will appear here live.</p></div>}
        </section>
      </div>
    </div>
  );
}

function SpecialistCard({ specialist, summary, capabilityCount, onOpen }: { specialist: DigitalSpecialist; summary?: SpecialistOperationalSummary; capabilityCount: number; onOpen: (specialist: DigitalSpecialist) => void }) {
  const lifecycleStatus = (specialist.framework_lifecycle_status || specialist.status || "").toLowerCase();
  const deactivated = ["inactive", "paused", "retired", "terminated"].includes(lifecycleStatus);
  const state = deactivated ? "offline" : (summary?.state || "offline");
  const status = deactivated ? { label: "Deactivated", badgeClass: "bg-muted/50 text-muted-foreground", dotClass: "bg-muted-foreground" } : workforceStateConfig[state];
  const reviewCount = summary?.needsReview || 0;

  return (
    <button type="button" onClick={() => onOpen(specialist)} className={`group w-full rounded-xl border p-5 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold ${deactivated ? "border-dashed border-subtle bg-background/20 opacity-75 hover:opacity-100" : reviewCount > 0 ? "border-[oklch(0.75_0.18_75/35%)] bg-[oklch(0.75_0.18_75/5%)] hover:bg-[oklch(0.75_0.18_75/8%)]" : "border-subtle bg-background/35 hover:-translate-y-0.5 hover:border-gold/25 hover:bg-background/55 hover:shadow-lg"}`}>
      <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-display text-lg font-semibold">{specialist.name}</p><p className="truncate text-xs text-muted-foreground">{specialist.role_name || "Digital Specialist"}</p></div><span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-mono font-semibold ${status.badgeClass}`}><span className={`h-1.5 w-1.5 rounded-full ${status.dotClass} ${state === "working" && !deactivated ? "animate-pulse" : ""}`} />{status.label}</span></div>
      <div className="mt-5 rounded-lg border border-subtle bg-surface/65 p-3"><div className="flex items-center justify-between gap-2"><p className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">Current Work</p>{reviewCount > 0 && <span className="text-[9px] font-mono font-semibold uppercase tracking-wider text-[oklch(0.78_0.16_75)]">Your review requested</span>}</div><p className="mt-1 line-clamp-2 text-xs font-medium">{deactivated ? "Deactivated. No new work will be assigned." : summary?.currentJob || "Ready and monitoring for work"}</p></div>
      <div className="mt-4 grid grid-cols-3 gap-3"><CardMetric label="Jobs Today" value={summary?.completedToday || 0} /><CardMetric label="Capabilities" value={capabilityCount} /><CardMetric label="Review" value={reviewCount} alert={reviewCount > 0} /></div>
      <div className="mt-4 flex items-center justify-between border-t border-subtle pt-4 text-[10px] text-muted-foreground"><span>{specialist.industry_name || "General Operations"}</span><span className="flex items-center gap-1.5 font-semibold text-foreground/70">{deactivated ? "Manage specialist" : "Open command profile"}<ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:text-gold" /></span></div>
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
  const content = <><div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${isWarning ? "bg-[oklch(0.62_0.22_25/12%)] text-[oklch(0.75_0.18_25)]" : isSuccess ? "bg-[oklch(0.75_0.18_155/12%)] text-[oklch(0.75_0.18_155)]" : "bg-gold/10 text-gold"}`}><Icon className="h-3.5 w-3.5" /></div><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><p className="text-xs font-semibold leading-5">{item.title || item.message || "Operational activity"}</p><span className="whitespace-nowrap text-[9px] font-mono text-muted-foreground">{formatActivityTime(item.created_at)}</span></div><p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">{item.description || item.message || item.activity_type || item.event_type || "Activity recorded"}</p><div className="mt-1.5 flex items-center justify-between gap-3">{specialistName ? <p className="text-[10px] text-gold">{specialistName}</p> : <span />}{canOpen && <span className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">View details</span>}</div></div>{canOpen && <ChevronRight className="mt-2 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-gold" />}</>;
  if (canOpen) return <button type="button" onClick={() => onOpen(item)} className="group flex w-full gap-3 px-5 py-4 text-left transition-colors hover:bg-background/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gold">{content}</button>;
  return <div className="flex gap-3 px-5 py-4">{content}</div>;
}

const workforceStateConfig: Record<WorkforceState, { label: string; badgeClass: string; dotClass: string }> = {
  working: { label: "Working", badgeClass: "bg-[oklch(0.75_0.18_155/15%)] text-[oklch(0.75_0.18_155)]", dotClass: "bg-[oklch(0.75_0.18_155)]" },
  idle: { label: "Ready", badgeClass: "bg-gold/10 text-gold", dotClass: "bg-gold" },
  needs_review: { label: "Needs Review", badgeClass: "bg-[oklch(0.75_0.18_75/15%)] text-[oklch(0.78_0.16_75)]", dotClass: "bg-[oklch(0.78_0.16_75)]" },
  failed: { label: "Failed", badgeClass: "bg-[oklch(0.62_0.22_25/15%)] text-[oklch(0.75_0.18_25)]", dotClass: "bg-[oklch(0.75_0.18_25)]" },
  offline: { label: "Offline", badgeClass: "bg-muted/50 text-muted-foreground", dotClass: "bg-muted-foreground" },
};

function CommandMetric({ label, value, detail, alert }: { label: string; value: number; detail: string; alert?: boolean }) { return <div className="bg-background/35 p-4 sm:p-5"><p className={`font-mono text-2xl font-bold ${alert ? "text-[oklch(0.78_0.16_75)]" : ""}`}>{value}</p><p className="mt-1 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-2 text-[10px] text-muted-foreground">{detail}</p></div>; }
function CardMetric({ label, value, alert }: { label: string; value: number; alert?: boolean }) { return <div><p className={`font-mono text-sm font-bold ${alert ? "text-[oklch(0.75_0.18_25)]" : ""}`}>{value}</p><p className="mt-0.5 text-[9px] text-muted-foreground">{label}</p></div>; }
function formatActivityTime(value?: string | null): string { if (!value) return "—"; const date = new Date(value); return Number.isNaN(date.getTime()) ? "—" : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
