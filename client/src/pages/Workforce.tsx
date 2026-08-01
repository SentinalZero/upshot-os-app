import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { Activity, ArrowRight, Bot, CheckCircle2, Clock3, Plus, ShieldCheck, Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { fetchDashboardData, type DigitalSpecialist, type SpecialistOperationalSummary } from "@/lib/supabaseService";

export default function Workforce() {
  const { profile, organization } = useAuth();
  const [specialists, setSpecialists] = useState<DigitalSpecialist[]>([]);
  const [summaries, setSummaries] = useState<Record<string, SpecialistOperationalSummary>>({});
  const [capabilityCounts, setCapabilityCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const organizationId = profile?.active_organization_id;
    if (!organizationId) return;
    let cancelled = false;
    void fetchDashboardData(organizationId).then(data => {
      if (cancelled) return;
      setSpecialists(data.specialists);
      setSummaries(data.specialistSummaries);
      setCapabilityCounts(data.workflowCounts);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [profile?.active_organization_id]);

  const visibleSpecialists = useMemo(() => {
    const seenRoles = new Set<string>();
    return specialists.filter(specialist => {
      const lifecycle = String(specialist.framework_lifecycle_status || specialist.status || "").toLowerCase();
      if (["inactive", "retired", "terminated"].includes(lifecycle)) return false;
      const roleKey = normalizeRole(specialist.role_name || specialist.name);
      if (seenRoles.has(roleKey)) return false;
      seenRoles.add(roleKey);
      return true;
    });
  }, [specialists]);

  const totals = useMemo(() => visibleSpecialists.reduce((result, specialist) => {
    const summary = summaries[specialist.id];
    result.jobs += summary?.completedToday || 0;
    result.reviews += summary?.needsReview || 0;
    result.capabilities += effectiveCapabilityCount(specialist, capabilityCounts[specialist.id] || 0);
    return result;
  }, { jobs: 0, reviews: 0, capabilities: 0 }), [visibleSpecialists, summaries, capabilityCounts]);

  return (
    <div className="min-h-screen bg-background">
      <main className="container py-8 lg:py-12">
        <section className="mb-8 overflow-hidden rounded-3xl border border-gold/25 bg-gradient-to-br from-gold/12 via-surface to-background/70 p-6 shadow-[0_28px_90px_-60px_oklch(0.72_0.15_75)] lg:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="flex items-center gap-2 text-gold"><Sparkles className="h-4 w-4" /><p className="text-[10px] font-mono uppercase tracking-[0.2em]">Digital Workforce</p></div>
              <h1 className="mt-3 font-display text-3xl font-semibold lg:text-4xl">The roles creating capacity for {organization?.name || "your organization"}</h1>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">See each Specialist's mission, responsibilities, authority, and current workload without exposing the automation machinery underneath.</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <SummaryMetric label="Specialists" value={visibleSpecialists.length} />
              <SummaryMetric label="Capabilities" value={totals.capabilities} />
              <SummaryMetric label="Needs review" value={totals.reviews} alert={totals.reviews > 0} />
            </div>
          </div>
        </section>

        {loading ? (
          <div className="grid min-h-72 place-items-center"><div className="h-7 w-7 animate-spin rounded-full border-2 border-gold border-t-transparent" /></div>
        ) : visibleSpecialists.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            {visibleSpecialists.map(specialist => <RoleCard key={specialist.id} specialist={specialist} summary={summaries[specialist.id]} capabilityCount={effectiveCapabilityCount(specialist, capabilityCounts[specialist.id] || 0)} />)}
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-subtle bg-surface p-10 text-center"><Bot className="mx-auto h-9 w-9 text-muted-foreground" /><h2 className="mt-4 font-display text-xl font-semibold">Build your first Digital Specialist</h2><p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">Start with one role, assign the recurring work, and choose where human approval is required.</p><Link href="/app/deploy" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gold px-4 py-2.5 text-xs font-semibold text-[#1a1000]"><Plus className="h-4 w-4" /> Hire Specialist</Link></div>
        )}
      </main>
    </div>
  );
}

function RoleCard({ specialist, summary, capabilityCount }: { specialist: DigitalSpecialist; summary?: SpecialistOperationalSummary; capabilityCount: number }) {
  const status = summary?.state || specialist.status || "ready";
  const needsReview = summary?.needsReview || 0;
  const mission = roleMission(specialist.role_name || specialist.name);
  const capabilities = roleCapabilities(specialist.role_name || specialist.name);
  const statusLabel = needsReview > 0 ? "Needs review" : status === "working" ? "Working" : "Ready";
  const statusClass = needsReview > 0 ? "bg-gold/15 text-gold" : status === "working" ? "bg-emerald-400/15 text-emerald-400" : "bg-emerald-400/10 text-emerald-400";

  return (
    <article className={`overflow-hidden rounded-3xl border bg-surface ${needsReview > 0 ? "border-gold/35" : "border-subtle"}`}>
      <div className="p-6 lg:p-7">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gold/10 text-gold"><Bot className="h-6 w-6" /></div>
            <div><p className="font-display text-2xl font-semibold">{specialist.name}</p><p className="mt-1 text-sm text-muted-foreground">{specialist.role_name || "Digital Specialist"}</p></div>
          </div>
          <span className={`rounded-full px-3 py-1.5 text-[10px] font-mono font-semibold uppercase ${statusClass}`}>{statusLabel}</span>
        </div>

        <div className="mt-6 rounded-2xl border border-subtle bg-background/35 p-5"><p className="text-[9px] font-mono uppercase tracking-[0.16em] text-muted-foreground">Mission</p><p className="mt-2 text-sm leading-6">{mission}</p></div>

        <div className="mt-6"><p className="text-[9px] font-mono uppercase tracking-[0.16em] text-muted-foreground">Core capabilities</p><div className="mt-3 flex flex-wrap gap-2">{capabilities.map(item => <span key={item} className="rounded-full border border-subtle bg-background/30 px-3 py-1.5 text-[10px]">{item}</span>)}</div></div>

        <div className="mt-6 grid grid-cols-3 gap-3"><CardMetric icon={CheckCircle2} label="Completed today" value={summary?.completedToday || 0} /><CardMetric icon={Activity} label="Capabilities" value={capabilityCount} /><CardMetric icon={Clock3} label="Needs review" value={needsReview} alert={needsReview > 0} /></div>
      </div>
      <div className="grid grid-cols-1 border-t border-subtle bg-background/20 sm:grid-cols-2">
        <div className="border-b border-subtle p-5 sm:border-b-0 sm:border-r"><div className="flex items-center gap-2 text-gold"><ShieldCheck className="h-4 w-4" /><span className="text-[9px] font-mono uppercase tracking-wider">Human oversight</span></div><p className="mt-2 text-xs leading-5 text-muted-foreground">Works independently within configured read, draft, recommend, approval, and execution boundaries.</p></div>
        <Link href="/app" className="group flex items-center justify-between p-5 text-sm font-semibold"><span>View Specialist</span><ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1 group-hover:text-gold" /></Link>
      </div>
    </article>
  );
}

function SummaryMetric({ label, value, alert }: { label: string; value: number; alert?: boolean }) { return <div className="min-w-24 rounded-2xl border border-subtle bg-background/35 p-4"><p className={`font-mono text-xl font-bold ${alert ? "text-gold" : ""}`}>{value}</p><p className="mt-1 text-[9px] uppercase tracking-wider text-muted-foreground">{label}</p></div>; }
function CardMetric({ icon: Icon, label, value, alert }: { icon: typeof Activity; label: string; value: number; alert?: boolean }) { return <div className="rounded-2xl border border-subtle bg-background/30 p-4"><Icon className={`h-4 w-4 ${alert ? "text-gold" : "text-gold"}`} /><p className="mt-3 font-mono text-lg font-bold">{value}</p><p className="mt-1 text-[9px] text-muted-foreground">{label}</p></div>; }
function normalizeRole(value: string): string { return value.toLowerCase().replace(/digital specialist/g, "").replace(/specialist/g, "").replace(/[^a-z0-9]/g, ""); }
function effectiveCapabilityCount(specialist: DigitalSpecialist, storedCount: number): number { return storedCount > 0 ? storedCount : roleCapabilities(specialist.role_name || specialist.name).length; }
function roleMission(value: string): string { const role = value.toLowerCase(); if (role.includes("sales")) return "Keep opportunities moving through meeting preparation, verified follow up, CRM coordination, and proactive pipeline monitoring."; if (role.includes("customer") || role.includes("cs")) return "Protect customer outcomes by coordinating meeting follow up, CRM updates, risk detection, and renewal readiness."; if (role.includes("dispatch")) return "Keep field operations coordinated through scheduling, document management, status updates, and exception handling."; return "Own assigned operational responsibilities, coordinate connected systems, surface exceptions, and return capacity to the team."; }
function roleCapabilities(value: string): string[] { const role = value.toLowerCase(); if (role.includes("sales")) return ["Meeting Preparation", "Meeting Intelligence", "Customer Follow Up", "CRM Coordination", "Pipeline Monitoring"]; if (role.includes("customer") || role.includes("cs")) return ["Meeting Summaries", "Customer Follow Up", "CRM Coordination", "Risk Escalation", "Outcome Reporting"]; if (role.includes("dispatch")) return ["Scheduling", "Driver Updates", "Document Coordination", "Notifications", "Exception Monitoring"]; return ["Assigned Work", "System Coordination", "Human Review", "Exception Escalation"]; }
