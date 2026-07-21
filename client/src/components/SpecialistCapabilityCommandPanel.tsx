import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, BrainCircuit, CheckCircle2, ChevronDown, ChevronUp, Gauge, LockKeyhole, Radar, RefreshCw, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { fetchSpecialistCapabilitySnapshot, type SpecialistCapabilityCommand, type SpecialistCapabilitySnapshot } from "@/lib/specialistCapabilityService";

export function SpecialistCapabilityCommandPanel({ specialistId }: { specialistId: string }) {
  const [snapshot, setSnapshot] = useState<SpecialistCapabilitySnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    const result = await fetchSpecialistCapabilitySnapshot(specialistId);
    setSnapshot(result.data);
    setError(result.error);
    setLoading(false);
  };

  useEffect(() => { void load(); }, [specialistId]);

  const summary = useMemo(() => {
    const capabilities = snapshot?.capabilities || [];
    return {
      active: capabilities.filter(item => item.status === "active").length,
      approvals: capabilities.reduce((total, item) => total + item.permissions.filter(permission => permission.approvalRequired).length, 0),
      monitors: capabilities.reduce((total, item) => total + item.triggers.filter(trigger => trigger.triggerType === "monitor").length, 0),
      metrics: capabilities.reduce((total, item) => total + item.metrics.length, 0),
    };
  }, [snapshot]);

  if (loading) return <section className="rounded-2xl border border-gold/20 bg-gradient-to-br from-gold/8 via-surface to-background/70 p-6"><div className="flex min-h-40 items-center justify-center gap-3 text-xs text-muted-foreground"><RefreshCw className="h-4 w-4 animate-spin text-gold" />Loading specialist command profile...</div></section>;
  if (error) return <section className="rounded-2xl border border-[oklch(0.62_0.22_25/35%)] bg-[oklch(0.62_0.22_25/7%)] p-5 text-xs text-[oklch(0.75_0.18_25)]">{error}</section>;
  if (!snapshot || snapshot.capabilities.length === 0) return null;

  return (
    <section className="overflow-hidden rounded-2xl border border-gold/25 bg-gradient-to-br from-gold/10 via-surface to-background/75 shadow-[0_24px_80px_-50px_oklch(0.72_0.15_75)]">
      <div className="border-b border-gold/15 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-gold"><Sparkles className="h-4 w-4" /><p className="text-[10px] font-mono uppercase tracking-[0.18em]">Specialist Command Profile</p></div>
            <h3 className="mt-2 font-display text-xl font-semibold sm:text-2xl">Purpose, authority, and operating controls</h3>
            <p className="mt-3 text-xs leading-5 text-muted-foreground">{snapshot.profile?.mission || "This Specialist coordinates assigned capabilities under workspace policy and human oversight."}</p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-[oklch(0.75_0.18_155/30%)] bg-[oklch(0.75_0.18_155/10%)] px-3 py-1.5 text-[10px] font-mono font-semibold text-[oklch(0.75_0.18_155)]"><span className="h-1.5 w-1.5 rounded-full bg-[oklch(0.75_0.18_155)]" />Operating within policy</span>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <CommandMetric icon={Zap} label="Active capabilities" value={summary.active} />
          <CommandMetric icon={LockKeyhole} label="Approval gates" value={summary.approvals} />
          <CommandMetric icon={Radar} label="Continuous monitors" value={summary.monitors} />
          <CommandMetric icon={Gauge} label="Outcome measures" value={summary.metrics} />
        </div>
      </div>

      <div className="space-y-3 p-5 sm:p-6">
        {snapshot.capabilities.map((capability, index) => (
          <CapabilityCard key={capability.id} capability={capability} index={index + 1} expanded={expanded === capability.id} onToggle={() => setExpanded(expanded === capability.id ? null : capability.id)} />
        ))}
      </div>

      <div className="grid gap-4 border-t border-gold/15 bg-background/25 p-5 sm:grid-cols-2 sm:p-6">
        <ControlCard icon={ShieldCheck} title="Human control" description={snapshot.profile?.boundaries?.[0] || "Governed actions pause for approval before execution."} items={snapshot.profile?.boundaries || []} />
        <ControlCard icon={AlertTriangle} title="Escalation coverage" description={`${snapshot.escalations.length} active rule${snapshot.escalations.length === 1 ? "" : "s"} protect uncertain or high-risk work.`} items={snapshot.escalations.map(item => `${item.name} · ${formatLabel(item.severity)}`)} />
      </div>
    </section>
  );
}

function CapabilityCard({ capability, index, expanded, onToggle }: { capability: SpecialistCapabilityCommand; index: number; expanded: boolean; onToggle: () => void }) {
  const approvalCount = capability.permissions.filter(item => item.approvalRequired).length;
  const triggerLabel = capability.triggers.length ? capability.triggers.map(item => formatLabel(item.triggerType)).join(" · ") : "Manual";
  return (
    <article className={`rounded-xl border transition-all ${expanded ? "border-gold/35 bg-background/65 shadow-lg" : "border-subtle bg-background/35 hover:border-gold/20 hover:bg-background/50"}`}>
      <button type="button" onClick={onToggle} className="w-full p-4 text-left sm:p-5">
        <div className="flex items-start gap-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-gold/20 bg-gold/10 font-mono text-xs font-bold text-gold">{String(index).padStart(2, "0")}</span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><h4 className="text-sm font-semibold">{capability.name}</h4><p className="mt-1 text-xs leading-5 text-muted-foreground">{capability.description}</p></div>
              <div className="flex items-center gap-2"><AutonomyPill level={capability.autonomyLevel} />{expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}</div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2 text-[9px] font-mono uppercase tracking-wider text-muted-foreground"><span className="rounded-full border border-subtle px-2.5 py-1">{triggerLabel}</span><span className="rounded-full border border-subtle px-2.5 py-1">{approvalCount ? `${approvalCount} approval gate${approvalCount === 1 ? "" : "s"}` : "No approval gate"}</span><span className="rounded-full border border-subtle px-2.5 py-1">{capability.metrics.length} metric{capability.metrics.length === 1 ? "" : "s"}</span></div>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="grid gap-4 border-t border-subtle px-4 py-5 sm:grid-cols-2 sm:px-5">
          <DetailBlock icon={CheckCircle2} title="Success looks like" text={capability.successDefinition || "Successful completion under the configured controls."} />
          <DetailBlock icon={BrainCircuit} title="Knowledge required" text={capability.requiredKnowledge.length ? capability.requiredKnowledge.map(formatLabel).join(", ") : "No additional knowledge configured."} />
          <DetailBlock icon={Radar} title="Systems and triggers" text={`${capability.requiredIntegrations.length ? capability.requiredIntegrations.map(formatLabel).join(", ") : "No connected system required"}. ${capability.triggers.length} active trigger${capability.triggers.length === 1 ? "" : "s"}.`} />
          <DetailBlock icon={LockKeyhole} title="Authority" text={capability.permissions.map(item => `${formatLabel(item.actionKey)}: ${item.approvalRequired ? "approval required" : formatLabel(item.accessMode)}`).join(" · ") || "No actions configured."} />
        </div>
      )}
    </article>
  );
}

function CommandMetric({ icon: Icon, label, value }: { icon: typeof Zap; label: string; value: number }) { return <div className="rounded-xl border border-gold/15 bg-background/45 p-4"><Icon className="h-4 w-4 text-gold" /><p className="mt-3 font-mono text-xl font-bold">{value}</p><p className="mt-1 text-[9px] uppercase tracking-wider text-muted-foreground">{label}</p></div>; }
function ControlCard({ icon: Icon, title, description, items }: { icon: typeof ShieldCheck; title: string; description: string; items: string[] }) { return <div className="rounded-xl border border-subtle bg-surface/55 p-5"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold/10 text-gold"><Icon className="h-4 w-4" /></span><div><h4 className="text-sm font-semibold">{title}</h4><p className="mt-1 text-[10px] leading-4 text-muted-foreground">{description}</p></div></div>{items.length > 0 && <div className="mt-4 space-y-2">{items.slice(0, 4).map(item => <p key={item} className="flex gap-2 text-[10px] leading-4 text-muted-foreground"><span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />{item}</p>)}</div>}</div>; }
function DetailBlock({ icon: Icon, title, text }: { icon: typeof CheckCircle2; title: string; text: string }) { return <div className="rounded-lg border border-subtle bg-surface/50 p-4"><div className="flex items-center gap-2 text-gold"><Icon className="h-4 w-4" /><p className="text-[9px] font-mono uppercase tracking-wider">{title}</p></div><p className="mt-2 text-[11px] leading-5 text-muted-foreground">{text}</p></div>; }
function AutonomyPill({ level }: { level: string }) { const approval = level === "execute_with_approval"; return <span className={`rounded-full px-2.5 py-1 text-[9px] font-mono font-semibold ${approval ? "bg-[oklch(0.75_0.18_75/15%)] text-[oklch(0.78_0.16_75)]" : level === "execute" ? "bg-[oklch(0.75_0.18_155/15%)] text-[oklch(0.75_0.18_155)]" : "bg-gold/10 text-gold"}`}>{approval ? "Human approval" : formatLabel(level)}</span>; }
function formatLabel(value: string): string { return value.replaceAll("_", " ").replace(/\b\w/g, letter => letter.toUpperCase()); }
