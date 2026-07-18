import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { Link2, Plus, Wifi } from "lucide-react";
import {
  fetchDashboardData,
  subscribeToCommandCenter,
  type ActivityLog,
  type DashboardMetrics,
  type DigitalSpecialist,
  type SpecialistOperationalSummary,
} from "@/lib/supabaseService";
import { fetchConnectionCounts, type ConnectionCounts } from "@/lib/connectionsService";
import { fetchWorkflowExecutionDetail, type WorkflowExecutionDetail } from "@/lib/executionDetailService";
import { fetchSpecialistDetail, type SpecialistDetailData } from "@/lib/specialistDetailService";
import { ExecutionDetailModal } from "@/components/ExecutionDetailModal";
import { SpecialistDetailModal } from "@/components/SpecialistDetailModal";
import { CommandCenterWorkforce } from "@/components/CommandCenterWorkforce";

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

export default function InteractiveAppDashboard() {
  const { user, profile, organization, signOut } = useAuth();
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

  const [selectedExecution, setSelectedExecution] = useState<WorkflowExecutionDetail | null>(null);
  const [selectedActivityTitle, setSelectedActivityTitle] = useState("");
  const [selectedExecutionSpecialistName, setSelectedExecutionSpecialistName] = useState<string | undefined>();
  const [executionDetailLoading, setExecutionDetailLoading] = useState(false);
  const [executionDetailError, setExecutionDetailError] = useState<string | null>(null);

  const [selectedSpecialist, setSelectedSpecialist] = useState<DigitalSpecialist | null>(null);
  const [specialistDetail, setSpecialistDetail] = useState<SpecialistDetailData | null>(null);
  const [specialistDetailLoading, setSpecialistDetailLoading] = useState(false);

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

  const loadExecutionDetail = async (executionId: string, title: string, specialistName?: string) => {
    const organizationId = profile?.active_organization_id;
    if (!organizationId) return;

    setSelectedExecution(null);
    setSelectedActivityTitle(title);
    setSelectedExecutionSpecialistName(specialistName);
    setExecutionDetailError(null);
    setExecutionDetailLoading(true);

    const result = await fetchWorkflowExecutionDetail(organizationId, executionId);
    setExecutionDetailLoading(false);
    setSelectedExecution(result.data);
    setExecutionDetailError(result.error);
  };

  const handleOpenActivity = async (item: ActivityLog) => {
    const executionId = typeof item.metadata?.execution_id === "string" ? item.metadata.execution_id : "";
    if (!executionId) return;

    await loadExecutionDetail(
      executionId,
      item.title || item.message || "Workflow activity",
      item.digital_specialist_id ? specialistNameById[item.digital_specialist_id] : undefined,
    );
  };

  const handleOpenSpecialist = async (specialist: DigitalSpecialist) => {
    const organizationId = profile?.active_organization_id;
    if (!organizationId) return;

    setSelectedSpecialist(specialist);
    setSpecialistDetail(null);
    setSpecialistDetailLoading(true);
    const detail = await fetchSpecialistDetail(organizationId, specialist.id);
    setSpecialistDetail(detail);
    setSpecialistDetailLoading(false);
  };

  const handleOpenSpecialistJob = async (executionId: string, specialistName: string) => {
    setSelectedSpecialist(null);
    setSpecialistDetail(null);
    setSpecialistDetailLoading(false);
    await loadExecutionDetail(executionId, "Workflow execution", specialistName);
  };

  const handleCloseExecutionDetail = () => {
    setSelectedExecution(null);
    setSelectedActivityTitle("");
    setSelectedExecutionSpecialistName(undefined);
    setExecutionDetailLoading(false);
    setExecutionDetailError(null);
  };

  const handleCloseSpecialistDetail = () => {
    setSelectedSpecialist(null);
    setSpecialistDetail(null);
    setSpecialistDetailLoading(false);
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    await signOut();
  };

  const userName = profile?.first_name
    ? `${profile.first_name}${profile.last_name ? ` ${profile.last_name}` : ""}`
    : user?.email || "User";
  const firstName = profile?.first_name || "Operator";
  const executionDetailOpen = executionDetailLoading || !!selectedExecution || !!executionDetailError;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-subtle bg-background/95 sticky top-0 z-50 shadow-[0_8px_30px_rgba(0,0,0,0.08)]">
        <div className="container flex items-center justify-between h-[64px]">
          <div className="flex items-center gap-4">
            <Link href="/"><img src="/assets/upshot-theory-logo.png" alt="Upshot Theory" className="h-10 w-auto" /></Link>
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
            <button onClick={handleSignOut} disabled={signingOut} className="px-3 py-1.5 rounded-lg border border-subtle text-xs font-medium text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-all">
              {signingOut ? "..." : "Sign Out"}
            </button>
          </div>
        </div>
      </header>

      <main className="container py-8 lg:py-12">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between mb-8">
          <div>
            <span className="text-[10px] font-mono text-gold tracking-wider uppercase">// Command Center</span>
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight mt-1">Good to see you, {firstName}.</h1>
            <p className="text-sm text-muted-foreground mt-1">Your digital workforce is online and reporting live operational activity.</p>
            <div className="flex items-center gap-2 mt-3 text-[10px] font-mono text-muted-foreground">
              <Wifi className="w-3 h-3 text-[oklch(0.75_0.18_155)]" />
              <span>Live</span><span>·</span>
              <span>{refreshing ? "Syncing changes..." : lastSyncedAt ? `Synced ${lastSyncedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Connecting..."}</span>
            </div>
          </div>
          <Link href="/app/deploy" className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm text-[#1a1000] transition-all duration-150 hover:shadow-[0_0_20px_oklch(0.65_0.14_75/30%)] active:scale-[0.97]" style={{ backgroundColor: "oklch(0.65 0.14 75)" }}>
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
            {dataErrors.map(error => <p key={error} className="text-[11px] text-muted-foreground">{error}</p>)}
          </div>
        )}

        <div className="rounded-2xl border border-subtle bg-surface p-5 mb-8">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2"><Link2 className="w-4 h-4 text-gold" /><span className="text-[10px] font-mono text-muted-foreground tracking-wider uppercase">Business Systems</span></div>
            <Link href="/app/connections" className="text-[11px] font-medium text-gold hover:underline">Manage Systems →</Link>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <MiniMetric label="Connected" value={connectionCounts.connected} />
            <MiniMetric label="Selected" value={connectionCounts.selected} />
            <MiniMetric label="Attention Required" value={connectionCounts.attentionRequired} alert={connectionCounts.attentionRequired > 0} />
          </div>
        </div>

        <CommandCenterWorkforce
          loading={loading}
          specialists={specialists}
          workflowCounts={workflowCounts}
          specialistSummaries={specialistSummaries}
          recentActivity={recentActivity}
          specialistNameById={specialistNameById}
          metrics={metrics}
          onOpenActivity={handleOpenActivity}
          onOpenSpecialist={handleOpenSpecialist}
        />
      </main>

      {selectedSpecialist && (
        <SpecialistDetailModal
          specialist={selectedSpecialist}
          operationalSummary={specialistSummaries[selectedSpecialist.id]}
          detail={specialistDetail}
          loading={specialistDetailLoading}
          onClose={handleCloseSpecialistDetail}
          onOpenJob={handleOpenSpecialistJob}
        />
      )}

      {executionDetailOpen && (
        <ExecutionDetailModal
          detail={selectedExecution}
          loading={executionDetailLoading}
          error={executionDetailError}
          activityTitle={selectedActivityTitle}
          specialistName={selectedExecutionSpecialistName}
          onClose={handleCloseExecutionDetail}
        />
      )}
    </div>
  );
}

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
