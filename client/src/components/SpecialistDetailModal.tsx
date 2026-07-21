import { useEffect } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Cpu,
  Link2,
  ListChecks,
  X,
} from "lucide-react";
import type { DigitalSpecialist, SpecialistOperationalSummary } from "@/lib/supabaseService";
import type { SpecialistDetailData } from "@/lib/specialistDetailService";
import type { SpecialistLifecycleAction } from "@/lib/specialistLifecycleService";
import { SpecialistLifecyclePanel } from "@/components/SpecialistLifecyclePanel";
import { SpecialistCapabilityCommandPanel } from "@/components/SpecialistCapabilityCommandPanel";

interface SpecialistDetailModalProps {
  specialist: DigitalSpecialist;
  operationalSummary?: SpecialistOperationalSummary;
  detail: SpecialistDetailData | null;
  loading: boolean;
  canManageLifecycle: boolean;
  lifecycleLoading: boolean;
  lifecycleError: string | null;
  onClose: () => void;
  onOpenJob: (executionId: string, specialistName: string) => void;
  onLifecycleAction: (action: SpecialistLifecycleAction) => Promise<void>;
}

export function SpecialistDetailModal({ specialist, operationalSummary, detail, loading, canManageLifecycle, lifecycleLoading, lifecycleError, onClose, onOpenJob, onLifecycleAction }: SpecialistDetailModalProps) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape" && !lifecycleLoading) onClose(); };
    window.addEventListener("keydown", handleKeyDown);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener("keydown", handleKeyDown); };
  }, [lifecycleLoading, onClose]);

  const state = operationalSummary?.state || specialist.status || "offline";

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-6" onMouseDown={onClose}>
      <section role="dialog" aria-modal="true" aria-label={`${specialist.name} profile`} className="max-h-[94vh] w-full overflow-y-auto rounded-t-2xl border border-subtle bg-background shadow-2xl sm:max-w-6xl sm:rounded-2xl" onMouseDown={event => event.stopPropagation()}>
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-subtle bg-background/95 p-5 backdrop-blur-xl sm:p-6">
          <div className="min-w-0">
            <p className="text-[10px] font-mono uppercase tracking-wider text-gold">Digital Specialist Command Profile</p>
            <div className="mt-1 flex flex-wrap items-center gap-3"><h2 className="font-display text-2xl font-semibold sm:text-3xl">{specialist.name}</h2><StateBadge state={state} /></div>
            <p className="mt-1 text-sm text-muted-foreground">{specialist.role_name || "Digital Specialist"} · {specialist.industry_name || "General Operations"}</p>
          </div>
          <button type="button" onClick={onClose} disabled={lifecycleLoading} className="rounded-lg border border-subtle p-2 text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground disabled:opacity-50" aria-label="Close specialist profile"><X className="h-4 w-4" /></button>
        </header>

        <div className="space-y-6 p-5 sm:p-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <ProfileMetric label="Jobs Today" value={operationalSummary?.completedToday || 0} />
            <ProfileMetric label="Capabilities" value={detail?.capabilities.length || 0} />
            <ProfileMetric label="Connected Systems" value={detail?.integrations.filter(item => item.status === "connected").length || 0} />
            <ProfileMetric label="Needs Review" value={detail?.reviews.length || 0} alert={(detail?.reviews.length || 0) > 0} />
          </div>

          <section className="rounded-xl border border-gold/20 bg-gradient-to-r from-gold/8 via-surface to-background/60 p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div><p className="text-[10px] font-mono uppercase tracking-wider text-gold">Current Work</p><p className="mt-2 text-sm font-medium">{operationalSummary?.currentJob || "Ready and monitoring for the next eligible action"}</p></div>
              <span className="rounded-full border border-subtle bg-background/50 px-3 py-1.5 text-[10px] font-mono text-muted-foreground">You remain in control</span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2"><InfoPill label={`Oversight: ${formatLabel(specialist.oversight_mode || "not set")}`} /><InfoPill label={`Deployed: ${formatDate(specialist.deployed_at)}`} /><InfoPill label={`Last activity: ${formatRelativeTime(operationalSummary?.lastActivityAt)}`} /></div>
          </section>

          <SpecialistCapabilityCommandPanel specialistId={specialist.id} />

          {loading && <div className="flex min-h-48 flex-col items-center justify-center gap-3"><div className="h-7 w-7 animate-spin rounded-full border-2 border-gold border-t-transparent" /><p className="text-xs font-mono text-muted-foreground">Loading specialist operations...</p></div>}

          {!loading && detail && (
            <>
              {detail.errors.length > 0 && <div className="rounded-xl border border-[oklch(0.75_0.18_75/35%)] bg-[oklch(0.75_0.18_75/8%)] p-4"><div className="flex items-center gap-2 text-[oklch(0.78_0.16_75)]"><AlertTriangle className="h-4 w-4" /><p className="text-sm font-semibold">Some specialist data could not be loaded</p></div>{detail.errors.map(error => <p key={error} className="mt-1 text-xs text-muted-foreground">{error}</p>)}</div>}

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <DetailSection icon={Cpu} eyebrow="Executable Layer" title="Deployed Workflows">
                  {detail.capabilities.length > 0 ? detail.capabilities.map(capability => <div key={capability.id} className="flex items-center justify-between gap-4 rounded-lg border border-subtle bg-background/35 p-4"><div className="min-w-0"><p className="truncate text-sm font-semibold">{capability.name}</p><p className="mt-1 text-[10px] font-mono text-muted-foreground">{shortId(capability.id)}</p></div><div className="text-right"><StatusPill status={capability.status} /><p className="mt-1 text-[10px] text-muted-foreground">{formatRelativeTime(capability.lastActivityAt)}</p></div></div>) : <EmptyState text="No executable workflows deployed yet." />}
                </DetailSection>

                <DetailSection icon={Link2} eyebrow="Connections" title="Business Systems">
                  {detail.integrations.length > 0 ? detail.integrations.map(integration => <div key={integration.id} className="flex items-center justify-between gap-4 rounded-lg border border-subtle bg-background/35 p-4"><div className="min-w-0"><p className="truncate text-sm font-semibold">{integration.providerName}</p><p className="mt-1 truncate text-[11px] text-muted-foreground">{integration.externalAccountEmail || "Account not connected"}</p></div><StatusPill status={integration.status} /></div>) : <EmptyState text="No business systems assigned." />}
                </DetailSection>
              </div>

              <DetailSection icon={Clock3} eyebrow="Execution History" title="Recent Jobs">
                {detail.jobs.length > 0 ? <div className="divide-y divide-subtle overflow-hidden rounded-xl border border-subtle">{detail.jobs.slice(0, 10).map(job => <button key={job.id} type="button" onClick={() => onOpenJob(job.id, specialist.name)} className="group flex w-full items-center gap-4 bg-background/25 px-4 py-4 text-left transition-colors hover:bg-background/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gold"><JobIcon status={job.status} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold">{job.summary || job.errorMessage || "Workflow execution"}</p><StatusPill status={job.status} /></div><p className="mt-1 text-[10px] font-mono text-muted-foreground">{formatLabel(job.triggerSource || "system")} · {formatDateTime(job.completedAt || job.createdAt)}</p></div><ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-gold" /></button>)}</div> : <EmptyState text="No jobs have run for this specialist yet." />}
              </DetailSection>

              <DetailSection icon={ListChecks} eyebrow="Human Oversight" title="Review Queue">
                {detail.reviews.length > 0 ? detail.reviews.map(review => <div key={review.id} className="rounded-lg border border-[oklch(0.75_0.18_75/30%)] bg-[oklch(0.75_0.18_75/6%)] p-4"><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-semibold">{review.title}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{review.description}</p></div><StatusPill status={review.severity} /></div><p className="mt-3 text-[10px] font-mono text-muted-foreground">{formatDateTime(review.createdAt)}</p></div>) : <EmptyState text="Nothing is waiting for human review." success />}
              </DetailSection>

              <SpecialistLifecyclePanel specialistName={specialist.name} specialistStatus={specialist.status} canManage={canManageLifecycle} capabilities={detail.capabilities.length} integrations={detail.integrations.length} jobs={detail.jobs.length} actionLoading={lifecycleLoading} actionError={lifecycleError} onAction={onLifecycleAction} />
            </>
          )}
        </div>
      </section>
    </div>
  );
}

function DetailSection({ icon: Icon, eyebrow, title, children }: { icon: typeof Cpu; eyebrow: string; title: string; children: React.ReactNode }) { return <section className="rounded-xl border border-subtle bg-surface p-5"><div className="mb-4 flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold/10 text-gold"><Icon className="h-4 w-4" /></div><div><p className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">{eyebrow}</p><h3 className="font-display text-base font-semibold">{title}</h3></div></div><div className="space-y-3">{children}</div></section>; }
function ProfileMetric({ label, value, alert }: { label: string; value: number; alert?: boolean }) { return <div className={`rounded-xl border bg-surface p-4 ${alert ? "border-[oklch(0.75_0.18_75/40%)]" : "border-subtle"}`}><p className={`font-mono text-xl font-bold ${alert ? "text-[oklch(0.78_0.16_75)]" : ""}`}>{value}</p><p className="mt-1 text-[9px] uppercase tracking-wider text-muted-foreground">{label}</p></div>; }
function StateBadge({ state }: { state: string }) { return <StatusPill status={state === "idle" ? "Ready" : formatLabel(state)} />; }
function StatusPill({ status }: { status: string }) { const normalized = status.toLowerCase(); const className = ["connected", "successful", "success", "active", "ready", "deployed"].includes(normalized) ? "bg-[oklch(0.75_0.18_155/15%)] text-[oklch(0.75_0.18_155)]" : ["failed", "error", "critical", "expired"].includes(normalized) ? "bg-[oklch(0.62_0.22_25/15%)] text-[oklch(0.75_0.18_25)]" : ["warning", "needs review", "needs_review", "pending", "selected"].includes(normalized) ? "bg-[oklch(0.75_0.18_75/15%)] text-[oklch(0.78_0.16_75)]" : "bg-gold/10 text-gold"; return <span className={`inline-flex rounded-full px-2.5 py-1 text-[9px] font-mono font-semibold capitalize ${className}`}>{formatLabel(status)}</span>; }
function JobIcon({ status }: { status: string }) { const normalized = status.toLowerCase(); if (["successful", "success", "completed"].includes(normalized)) return <CheckCircle2 className="h-5 w-5 shrink-0 text-[oklch(0.75_0.18_155)]" />; if (["failed", "error"].includes(normalized)) return <AlertTriangle className="h-5 w-5 shrink-0 text-[oklch(0.75_0.18_25)]" />; return <Clock3 className="h-5 w-5 shrink-0 text-gold" />; }
function EmptyState({ text, success }: { text: string; success?: boolean }) { return <div className="flex items-center gap-3 rounded-lg border border-dashed border-subtle bg-background/25 p-4 text-xs text-muted-foreground">{success ? <CheckCircle2 className="h-4 w-4 text-[oklch(0.75_0.18_155)]" /> : <Clock3 className="h-4 w-4" />}{text}</div>; }
function InfoPill({ label }: { label: string }) { return <span className="rounded-full border border-subtle bg-background/40 px-3 py-1 text-[10px] font-mono text-muted-foreground">{label}</span>; }
function shortId(value: string): string { return value.length > 12 ? `${value.slice(0, 8)}…${value.slice(-4)}` : value; }
function formatLabel(value: string): string { return value.replaceAll("_", " ").replace(/\b\w/g, letter => letter.toUpperCase()); }
function formatDate(value?: string | null): string { if (!value) return "Not recorded"; const date = new Date(value); return Number.isNaN(date.getTime()) ? "Not recorded" : date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }); }
function formatDateTime(value?: string | null): string { if (!value) return "Not recorded"; const date = new Date(value); return Number.isNaN(date.getTime()) ? "Not recorded" : date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }); }
function formatRelativeTime(value?: string | null): string { if (!value) return "No activity yet"; const date = new Date(value); if (Number.isNaN(date.getTime())) return "Activity recorded"; const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000)); if (seconds < 60) return "Just now"; const minutes = Math.floor(seconds / 60); if (minutes < 60) return `${minutes}m ago`; const hours = Math.floor(minutes / 60); if (hours < 24) return `${hours}h ago`; return formatDate(value); }
