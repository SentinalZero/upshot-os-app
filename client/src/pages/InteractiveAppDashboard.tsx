import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { Plus, Wifi } from "lucide-react";
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
import { manageDigitalSpecialist, type SpecialistLifecycleAction } from "@/lib/specialistLifecycleService";
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
  const [refreshKey, setRefreshKey] = useState(0);

  const [selectedExecution, setSelectedExecution] = useState<WorkflowExecutionDetail | null>(null);
  const [selectedActivityTitle, setSelectedActivityTitle] = useState("");
  const [selectedExecutionSpecialistName, setSelectedExecutionSpecialistName] = useState<string | undefined>();
  const [executionDetailLoading, setExecutionDetailLoading] = useState(false);
  const [executionDetailError, setExecutionDetailError] = useState<string | null>(null);

  const [selectedSpecialist, setSelectedSpecialist] = useState<DigitalSpecialist | null>(null);
  const [specialistDetail, setSpecialistDetail] = useState<SpecialistDetailData | null>(null);
  const [specialistDetailLoading, setSpecialistDetailLoading] = useState(false);
  const [lifecycleLoading, setLifecycleLoading] = useState(false);
  const [lifecycleError, setLifecycleError] = useState<string | null>(null);

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
  }, [profile?.active_organization_id, refreshKey]);

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
    await loadExecutionDetail(executionId, item.title || item.message || "Workflow activity", item.digital_specialist_id ? specialistNameById[item.digital_specialist_id] : undefined);
  };

  const handleOpenSpecialist = async (specialist: DigitalSpecialist) => {
    const organizationId = profile?.active_organization_id;
    if (!organizationId) return;
    setSelectedSpecialist(specialist);
    setSpecialistDetail(null);
    setLifecycleError(null);
    setSpecialistDetailLoading(true);
    const detail = await fetchSpecialistDetail(organizationId, specialist.id);
    setSpecialistDetail(detail);
    setSpecialistDetailLoading(false);
  };

  const handleOpenSpecialistJob = async (executionId: string, specialistName: string) => {
    setSelectedSpecialist(null);
    setSpecialistDetail(null);
    setSpecialistDetailLoading(false);
    setLifecycleError(null);
    await loadExecutionDetail(executionId, "Workflow execution", specialistName);
  };

  const handleLifecycleAction = async (action: SpecialistLifecycleAction) => {
    const organizationId = profile?.active_organization_id;
    if (!organizationId || !selectedSpecialist) return;
    setLifecycleLoading(true);
    setLifecycleError(null);
    const result = await manageDigitalSpecialist(organizationId, selectedSpecialist.id, action);
    setLifecycleLoading(false);
    if (!result.success) {
      setLifecycleError(result.error || "The specialist could not be updated.");
      return;
    }
    setSelectedSpecialist(null);
    setSpecialistDetail(null);
    setRefreshKey(value => value + 1);
  };

  const handleCloseExecutionDetail = () => {
    setSelectedExecution(null);
    setSelectedActivityTitle("");
    setSelectedExecutionSpecialistName(undefined);
    setExecutionDetailLoading(false);
    setExecutionDetailError(null);
  };

  const handleCloseSpecialistDetail = () => {
    if (lifecycleLoading) return;
    setSelectedSpecialist(null);
    setSpecialistDetail(null);
    setSpecialistDetailLoading(false);
    setLifecycleError(null);
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    await signOut();
  };

  const userName = profile?.first_name ? `${profile.first_name}${profile.last_name ? ` ${profile.last_name}` : ""}` : user?.email || "User";
  const firstName = profile?.first_name || "Operator";
  const executionDetailOpen = executionDetailLoading || !!selectedExecution || !!executionDetailError;
  const canManageLifecycle = ["owner", "admin"].includes((orgRole || "").toLowerCase());

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-subtle bg-background/95 shadow-[0_8px_30px_rgba(0,0,0,0.08)]">
        <div className="container flex h-[64px] items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/"><img src="/assets/upshot-theory-logo.png" alt="Upshot Theory" className="h-10 w-auto" /></Link>
            <div className="ml-4 hidden items-center gap-2 sm:flex"><span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Command Center</span><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[oklch(0.75_0.18_155)]" /></div>
            <nav className="ml-6 hidden items-center gap-4 md:flex"><Link href="/app" className="text-xs font-medium text-foreground">Command Center</Link><Link href="/app/connections" className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">Business Systems</Link></nav>
          </div>
          <div className="flex items-center gap-4"><div className="hidden text-right sm:block"><p className="text-xs font-medium">{userName}</p><p className="text-[10px] text-muted-foreground">{organization?.name || "No organization"}</p></div><button onClick={handleSignOut} disabled={signingOut} className="rounded-lg border border-subtle px-3 py-1.5 text-xs font-medium text-muted-foreground transition-all hover:border-foreground/20 hover:text-foreground">{signingOut ? "..." : "Sign Out"}</button></div>
        </div>
      </header>

      <main className="container py-8 lg:py-12">
        <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div><span className="text-[10px] font-mono uppercase tracking-wider text-gold">// Command Center</span><h1 className="mt-1 font-display text-2xl font-bold tracking-tight sm:text-3xl">Good to see you, {firstName}.</h1><p className="mt-1 text-sm text-muted-foreground">Your digital workforce is online and reporting live operational activity.</p><div className="mt-3 flex items-center gap-2 text-[10px] font-mono text-muted-foreground"><Wifi className="h-3 w-3 text-[oklch(0.75_0.18_155)]" /><span>Live</span><span>·</span><span>{refreshing ? "Syncing changes..." : lastSyncedAt ? `Synced ${lastSyncedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Connecting..."}</span></div></div>
          <Link href="/app/deploy" className="inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-[#1a1000] transition-all duration-150 hover:shadow-[0_0_20px_oklch(0.65_0.14_75/30%)] active:scale-[0.97]" style={{ backgroundColor: "oklch(0.65 0.14 75)" }}><Plus className="h-4 w-4" /> Hire Specialist</Link>
        </div>

        {dataErrors.length > 0 && <div className="mb-6 rounded-xl border border-[oklch(0.62_0.22_25/40%)] bg-[oklch(0.62_0.22_25/8%)] p-4"><p className="mb-1 text-xs font-semibold text-[oklch(0.75_0.18_25)]">Some live data could not be loaded</p>{dataErrors.map(error => <p key={error} className="text-[11px] text-muted-foreground">{error}</p>)}</div>}

        <CommandCenterWorkforce
          loading={loading}
          specialists={specialists}
          workflowCounts={workflowCounts}
          specialistSummaries={specialistSummaries}
          recentActivity={recentActivity}
          specialistNameById={specialistNameById}
          metrics={metrics}
          connectionCounts={connectionCounts}
          onOpenActivity={handleOpenActivity}
          onOpenSpecialist={handleOpenSpecialist}
        />
      </main>

      {selectedSpecialist && <SpecialistDetailModal specialist={selectedSpecialist} operationalSummary={specialistSummaries[selectedSpecialist.id]} detail={specialistDetail} loading={specialistDetailLoading} canManageLifecycle={canManageLifecycle} lifecycleLoading={lifecycleLoading} lifecycleError={lifecycleError} onClose={handleCloseSpecialistDetail} onOpenJob={handleOpenSpecialistJob} onLifecycleAction={handleLifecycleAction} />}
      {executionDetailOpen && <ExecutionDetailModal detail={selectedExecution} loading={executionDetailLoading} error={executionDetailError} activityTitle={selectedActivityTitle} specialistName={selectedExecutionSpecialistName} onClose={handleCloseExecutionDetail} />}
    </div>
  );
}
