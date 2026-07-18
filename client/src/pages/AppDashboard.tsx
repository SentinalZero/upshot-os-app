import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import {
  fetchDashboardData,
  subscribeToCommandCenter,
  type ActivityLog,
  type DashboardMetrics,
  type DigitalSpecialist,
  type SpecialistOperationalSummary,
  type WorkforceState,
} from "@/lib/supabaseService";
import { fetchConnectionCounts, type ConnectionCounts } from "@/lib/connectionsService";
import { Activity, AlertTriangle, CheckCircle2, Clock3, Link2, Plus, Rocket, Wifi } from "lucide-react";

const emptyMetrics: DashboardMetrics = {
  totalSpecialists: 0,
  activeSpecialists: 0,
  deployedWorkflows: 0,
  executionsToday: 0,
  successfulExecutionsToday: 0,
  failedExecutionsToday: 0,
  successRateToday: 0,
  needsHumanReview: 0,
};

export default function AppDashboard() {
  const { user, profile, organization, orgRole, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const [specialists, setSpecialists] = useState<DigitalSpecialist[]>([]);
  const [workflowCounts, setWorkflowCounts] = useState<Record<string, number>>({});
  const [specialistSummaries, setSpecialistSummaries] = useState<Record<string, SpecialistOperationalSummary>>({});
  const [recentActivity, setRecentActivity] = useState<ActivityLog[]>([]);
  const [metrics, setMetrics] = useState<DashboardMetrics>(emptyMetrics);
  const [connectionCounts, setConnectionCounts] = useState<ConnectionCounts>({ connected: 0, selected: 0, attentionRequired: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dataErrors, setDataErrors] = useState<string[]>([]);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  useEffect(() => {
    if (!profile?.active_organization_id) return;
    const orgId = profile.active_organization_id;
    let cancelled = false;
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;

    async function loadData(initialLoad = false) {
      if (initialLoad) setLoading(true);
      else setRefreshing(true);

      const [dashboardData, connCounts] = await Promise.all([
        fetchDashboardData(orgId),
        fetchConnectionCounts(orgId),
      ]);

      if (cancelled) return;
      setSpecialists(dashboardData.specialists);
      setWorkflowCounts(dashboardData.workflowCounts);
      setSpecialistSummaries(dashboardData.specialistSummaries);
      setRecentActivity(dashboardData.recentActivity);
      setMetrics(dashboardData.metrics);
      setDataErrors(dashboardData.errors);
      setConnectionCounts(connCounts);
      setLastSyncedAt(new Date());
      setLoading(false);
      setRefreshing(false);
    }

    void loadData(true);

    const unsubscribe = subscribeToCommandCenter(orgId, () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => void loadData(false), 200);
    });

    return () => {
      cancelled = true;
      if (refreshTimer) clearTimeout(refreshTimer);
      unsubscribe();
    };
  }, [profile?.active_organization_id]);

  const specialistNameById = useMemo(
    () => Object.fromEntries(specialists.map(specialist => [specialist.id, specialist.name])),
    [specialists],
  );

  const handleSignOut = async () => {
    setSigningOut(true);
    await signOut();
  };

  const userName = profile?.first_name
    ? `${profile.first_name}${profile.last_name ? ` ${profile.last_name}` : ""}`
    : user?.email || "User";

  const firstName = profile?.first_name || "Operator";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-subtle bg-background/95 sticky top-0 z-50 shadow-[0_8px_30px_rgba(0,0,0,0.08)]">
        <div className="container flex items-center justify-between h-[64px]">
          <div className="flex items-center gap-4">
            <Link href="/">
              <img src="/assets/upshot-theory-logo.png" alt="Upshot Theory" className="h-10 w-auto" />
            </Link>
            <div className="hidden sm:flex items-center gap-2 ml-4">
              <span className="text-[10px] font-mono text-muted-foreground tracking-wider uppercase">Command Center</span>
              <span className="w-1.5 h-1.5 rounded-full bg-[oklch(0.75_0.18_155)] animate-pulse" />
            </div>
            <nav className="hidden md:flex items-center gap-4 ml-6">
              <Link href="/app" className="text-xs font-medium text-foreground">Command Center</Link>
              <Link href="/app/connections" className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">Business Systems</Link>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-medium">{userName}</p>
              <p className="text-[10px] text-muted-foreground">{organization?.name || "No organization"}</p>
            </div>
            <button
              onClick={handleSignOut}
              disabled={signingOut}
              className="px-3 py-1.5 rounded-lg border border-subtle text-xs font-medium text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-all"
            >
              {signingOut ? "..." : "Sign Out"}
            </button>
          </div>
        </div>
      </header>

      <main className="container py-8 lg:py-12">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between mb-8">
          <div>
            <span className="text-[10px] font-mono text-gold tracking-wider uppercase">// Command Center</span>
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight mt-1">
              Good to see you, {firstName}.
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Your digital workforce is online and reporting live operational activity.
            </p>
            <div className="flex items-center gap-2 mt-3 text-[10px] font-mono text-muted-foreground">
              <Wifi className="w-3 h-3 text-[oklch(0.75_0.18_155)]" />
              <span>Live</span>
              <span>·</span>
              <span>{refreshing ? "Syncing changes..." : lastSyncedAt ? `Synced ${lastSyncedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Connecting..."}</span>
            </div>
          </div>
          <Link
            href="/app/deploy"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm text-[#1a1000] transition-all duration-150 hover:shadow-[0_0_20px_oklch(0.65_0.14_75/30%)] active:scale-[0.97]"
            style={{ backgroundColor: "oklch(0.65 0.14 75)" }}
          >
            <Plus className="w-4 h-4" /> Hire Specialist
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
          <MetricCard label="Specialists Online" value={metrics.activeSpecialists.toString()} />
          <MetricCard label="Jobs Completed Today" value={metrics.successfulExecutionsToday.toString()} />
          <MetricCard label="Success Rate" value={`${metrics.successRateToday}%`} />
          <MetricCard label="Active Capabilities" value={metrics.deployedWorkflows.toString()} />
          <MetricCard label="Needs Review" value={metrics.needsHumanReview.toString()} highlight={metrics.needsHumanReview > 0} />
        </div>

        {dataErrors.length > 0 && (
          <div className="rounded-xl border border-[oklch(0.62_0.22_25/40%)] bg-[oklch(0.62_0.22_25/8%)] p-4 mb-6">
            <p className="text-xs font-semibold text-[oklch(0.75_0.18_25)] mb-1">Some live data could not be loaded</p>
            {dataErrors.map(error => (
              <p key={error} className="text-[11px] text-muted-foreground">{error}</p>
            ))}
          </div>
        )}

        <div className="rounded-2xl border border-subtle bg-surface p-5 mb-8">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Link2 className="w-4 h-4 text-gold" />
              <span className="text-[10px] font-mono text-muted-foreground tracking-wider uppercase">Business Systems</span>
            </div>
            <Link href="/app/connections" className="text-[11px] font-medium text-gold hover:underline">
              Manage Systems →
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <MiniMetric label="Connected" value={connectionCounts.connected} />
            <MiniMetric label="Selected" value={connectionCounts.selected} />
            <MiniMetric label="Attention Required" value={connectionCounts.attentionRequired} alert={connectionCounts.attentionRequired > 0} />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="flex flex-col items-center gap-3">
              <div className="w-6 h-6 border-2 border-gold border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-muted-foreground font-mono">Bringing your workforce online...</p>
            </div>
          </div>
        ) : (
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
        )}
      </main>
    </div>
  );
}

function SpecialistCard({
  specialist,
  summary,
  capabilityCount,
}: {
  specialist: DigitalSpecialist;
  summary?: SpecialistOperationalSummary;
  capabilityCount: number;
}) {
  const state = summary?.state || "offline";
  const status = workforceStateConfig[state];

  return (
    <article className="rounded-xl border border-subtle bg-background/35 p-5 transition-all hover:border-foreground/15 hover:bg-background/55">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-lg font-semibold truncate">{specialist.name}</p>
          <p className="text-xs text-muted-foreground truncate">{specialist.role_name || "Digital Specialist"}</p>
        </div>
        <span className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-mono font-semibold ${status.badgeClass}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${status.dotClass} ${state === "working" ? "animate-pulse" : ""}`} />
          {status.label}
        </span>
      </div>

      <div className="mt-5 rounded-lg border border-subtle bg-surface/60 p-3">
        <p className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground mb-1">Current Work</p>
        <p className="text-xs font-medium line-clamp-2">{summary?.currentJob || "Ready for work"}</p>
      </div>

      <div className="grid grid-cols-3 gap-3 mt-4">
        <CardMetric label="Jobs Today" value={summary?.completedToday || 0} />
        <CardMetric label="Capabilities" value={capabilityCount} />
        <CardMetric label="Review" value={summary?.needsReview || 0} alert={(summary?.needsReview || 0) > 0} />
      </div>

      <div className="flex items-center justify-between mt-4 pt-4 border-t border-subtle text-[10px] text-muted-foreground">
        <span>{specialist.industry_name || "General Operations"}</span>
        <span>{formatRelativeTime(summary?.lastActivityAt)}</span>
      </div>
    </article>
  );
}

function TimelineItem({ item, specialistName }: { item: ActivityLog; specialistName?: string }) {
  const severity = item.severity?.toLowerCase();
  const isWarning = severity === "warning" || severity === "critical";
  const isSuccess = severity === "success";
  const Icon = isWarning ? AlertTriangle : isSuccess ? CheckCircle2 : Activity;

  return (
    <div className="flex gap-3 px-5 py-4">
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
        {specialistName && <p className="text-[10px] text-gold mt-1.5">{specialistName}</p>}
      </div>
    </div>
  );
}

const workforceStateConfig: Record<WorkforceState, { label: string; badgeClass: string; dotClass: string }> = {
  working: {
    label: "Working",
    badgeClass: "bg-[oklch(0.75_0.18_155/15%)] text-[oklch(0.75_0.18_155)]",
    dotClass: "bg-[oklch(0.75_0.18_155)]",
  },
  idle: {
    label: "Ready",
    badgeClass: "bg-gold/10 text-gold",
    dotClass: "bg-gold",
  },
  needs_review: {
    label: "Needs Review",
    badgeClass: "bg-[oklch(0.75_0.18_75/15%)] text-[oklch(0.78_0.16_75)]",
    dotClass: "bg-[oklch(0.78_0.16_75)]",
  },
  failed: {
    label: "Failed",
    badgeClass: "bg-[oklch(0.62_0.22_25/15%)] text-[oklch(0.75_0.18_25)]",
    dotClass: "bg-[oklch(0.75_0.18_25)]",
  },
  offline: {
    label: "Offline",
    badgeClass: "bg-muted/50 text-muted-foreground",
    dotClass: "bg-muted-foreground",
  },
};

function MetricCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border bg-surface p-5 ${highlight ? "border-[oklch(0.62_0.22_25/40%)]" : "border-subtle"}`}>
      <p className="text-[10px] font-mono text-muted-foreground tracking-wider uppercase mb-2">{label}</p>
      <span className={`text-2xl font-mono font-bold ${highlight ? "text-[oklch(0.75_0.18_25)]" : ""}`}>{value}</span>
    </div>
  );
}

function MiniMetric({ label, value, alert }: { label: string; value: number; alert?: boolean }) {
  return (
    <div>
      <p className={`text-lg font-mono font-bold ${alert ? "text-[oklch(0.75_0.18_25)]" : ""}`}>{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}

function CardMetric({ label, value, alert }: { label: string; value: number; alert?: boolean }) {
  return (
    <div>
      <p className={`text-sm font-mono font-bold ${alert ? "text-[oklch(0.75_0.18_25)]" : ""}`}>{value}</p>
      <p className="text-[9px] text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}

function formatRelativeTime(value?: string | null): string {
  if (!value) return "No activity yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Activity recorded";
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatActivityTime(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
