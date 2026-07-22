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

  const totals = useMemo(() => specialists.reduce((result, specialist) => {
    const summary = summaries[specialist.id];
    result.jobs += summary?.completedToday || 0;
    result.reviews += summary?.needsReview || 0;
    result.capabilities += capabilityCounts[specialist.id] || 0;
    return result;
  }, { jobs: 0, reviews: 0, capabilities: 0 }), [specialists, summaries, capabilityCounts]);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-subtle bg-background/95 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/app"><img src="/assets/upshot-theory-logo.png" alt="Upshot Theory" className="h-10 w-auto" /></Link>
            <nav className="hidden items-center gap-5 md:flex">
              <Link href="/app" className="text-xs text-muted-foreground hover:text-foreground">Command Center</Link>
              <Link href="/app/workforce" className="text-xs font-semibold text-foreground">Workforce</Link>
              <Link href="/app/connections" className="text-xs text-muted-foreground hover:text-foreground">Business Systems</Link>
            </nav>
          </div>
          <Link href="/app/deploy" className="inline-flex items-center gap-2 rounded-lg bg-gold px-4 py-2 text-xs font-semibold text-[#1a1000]"><Plus className="h-4 w-4" /> Hire Specialist</Link>
        </div>
      </header>

      <main className="container py-8 lg:py-12">
        <section className="mb-8 overflow-hidden rounded-2xl border border-gold/25 bg-gradient-to-br from-gold/12 via-surface to-background/70 p-6 shadow-[0_28px_90px_-60px_oklch(0.72_0.15_75)]">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="flex items-center gap-2 text-gold"><Sparkles className="h-4 w-4" /><p className="text-[10px] font-mono uppercase tracking-[0.2em]">Digital Workforce</p></div>
              <h1 className="mt-2 font-display text-3xl font-semibold">The roles creating capacity for {organization?.name || "your organization"}</h1>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">Understand each Specialist's mission, capabilities, authority, current workload, and operational outcomes without exposing the workflow machinery underneath.</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <SummaryMetric label="Specialists" value={specialists.length} />
              <SummaryMetric label="Capabilities" value={totals.capabilities} />
              <SummaryMetric label="Needs Review" value={totals.reviews} alert={totals.reviews > 0} />
            </div>
          </div>
        </section>

        {loading ? <div className="flex min-h-72 items-center justify-center"><div className="h-7 w-7 animate-spin rounded-full border-2 border-gold border-t-transparent" /></div> : specialists.length > 0 ? (
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            {specialists.map(specialist => <RoleCard key={specialist.id} specialist={specialist} summary={summaries[specialist.id]} capabilityCount={capabilityCounts[specialist.id] || 0} />)}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-subtle bg-surface p-10 text-center"><Bot className="mx-auto h-9 w-9 text-muted-foreground" /><h2 className="mt-4 font-display text-xl font-semibold">Build your first operational role</h2><p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">Deploy a Digital Specialist with a mission, capability package, authority boundaries, and measurable outcomes.</p></div>
        )}
      </main>
    </div>
  );
}

function RoleCard({ specialist, summary, capabilityCount }: { specialist: DigitalSpecialist; summary?: SpecialistOperationalSummary; capabilityCount: number }) {
  const status = summary?.state || specialist.status || "offline";
  const deactivated = ["inactive", "paused", "retired", "terminated"].includes((specialist.framework_lifecycle_status || specialist.status || "").toLowerCase());
  const mission = roleMission(specialist.role_name || specialist.name);
  const capabilities = roleCapabilities(specialist.role_name || specialist.name, capabilityCount);
  return (
    <article className={`overflow-hidden rounded-2xl border bg-surface ${summary?.needsReview ? "border-[oklch(0.75_0.18_75/35%)]" : "border-subtle"}`}>
      <div className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-4"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gold/10 text-gold"><Bot className="h-6 w-6" /></div><div><p className="font-display text-xl font-semibold">{specialist.name}</p><p className="mt-1 text-xs text-muted-foreground">{specialist.role_name || "Digital Specialist"}</p></div></div>
          <span className={`rounded-full px-3 py-1 text-[10px] font-mono font-semibold ${deactivated ? "bg-muted/50 text-muted-foreground" : status === "needs_review" ? "bg-[oklch(0.75_0.18_75/15%)] text-[oklch(0.78_0.16_75)]" : "bg-[oklch(0.75_0.18_155/15%)] text-[oklch(0.75_0.18_155)]"}`}>{deactivated ? "Deactivated" : status.replaceAll("_", " ")}</span>
        </div>

        <div className="mt-5 rounded-xl border border-subtle bg-background/35 p-4"><p className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">Mission</p><p className="mt-2 text-sm leading-6">{mission}</p></div>

        <div className="mt-5"><p className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">Core Capabilities</p><div className="mt-3 flex flex-wrap gap-2">{capabilities.map(item => <span key={item} className="rounded-full border border-subtle bg-background/30 px-3 py-1.5 text-[10px]">{item}</span>)}</div></div>

        <div className="mt-5 grid grid-cols-3 gap-3"><CardMetric icon={CheckCircle2} label="Jobs Today" value={summary?.completedToday || 0} /><CardMetric icon={Activity} label="Capabilities" value={capabilityCount} /><CardMetric icon={Clock3} label="Review" value={summary?.needsReview || 0} alert={(summary?.needsReview || 0) > 0} /></div>
      </div>
      <div className="grid grid-cols-2 border-t border-subtle bg-background/20">
        <div className="border-r border-subtle p-4"><div className="flex items-center gap-2 text-gold"><ShieldCheck className="h-4 w-4" /><span className="text-[9px] font-mono uppercase tracking-wider">Authority</span></div><p className="mt-2 text-xs text-muted-foreground">Operates within configured read, draft, recommend, approval, and execution boundaries.</p></div>
        <Link href="/app" className="group flex items-center justify-between p-4 text-sm font-semibold"><span>Open command profile</span><ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1 group-hover:text-gold" /></Link>
      </div>
    </article>
  );
}

function SummaryMetric({ label, value, alert }: { label: string; value: number; alert?: boolean }) { return <div className="min-w-24 rounded-xl border border-subtle bg-background/35 p-4"><p className={`font-mono text-xl font-bold ${alert ? "text-[oklch(0.78_0.16_75)]" : ""}`}>{value}</p><p className="mt-1 text-[9px] uppercase tracking-wider text-muted-foreground">{label}</p></div>; }
function CardMetric({ icon: Icon, label, value, alert }: { icon: typeof Activity; label: string; value: number; alert?: boolean }) { return <div className="rounded-xl border border-subtle bg-background/30 p-3"><Icon className={`h-4 w-4 ${alert ? "text-[oklch(0.78_0.16_75)]" : "text-gold"}`} /><p className="mt-3 font-mono text-lg font-bold">{value}</p><p className="mt-1 text-[9px] text-muted-foreground">{label}</p></div>; }
function roleMission(value: string): string { const role = value.toLowerCase(); if (role.includes("sales")) return "Keep opportunities moving through meeting preparation, verified follow up, CRM coordination, and proactive pipeline monitoring."; if (role.includes("customer") || role.includes("cs")) return "Protect customer outcomes by coordinating onboarding, adoption, follow up, risk detection, and renewal readiness."; if (role.includes("dispatch")) return "Keep field operations coordinated through scheduling, document management, status updates, and exception handling."; return "Own assigned operational responsibilities, coordinate connected systems, surface exceptions, and return capacity to the team."; }
function roleCapabilities(value: string, count: number): string[] { const role = value.toLowerCase(); if (role.includes("sales")) return ["Meeting Preparation", "Meeting Intelligence", "Customer Follow Up", "CRM Coordination", "Pipeline Monitoring"]; if (role.includes("customer") || role.includes("cs")) return ["Customer Follow Up", "Health Monitoring", "CRM Coordination", "Risk Escalation", "Outcome Reporting"]; if (role.includes("dispatch")) return ["Scheduling", "Driver Updates", "Document Coordination", "Notifications", "Exception Monitoring"]; return count > 0 ? ["Assigned Work", "System Coordination", "Human Review", "Exception Escalation"] : ["Capability package not configured"]; }
