import { useAuth } from "@/contexts/AuthContext";
import { useState, useEffect } from "react";
import { Link } from "wouter";
import {
  fetchSpecialists,
  fetchWorkflowCounts,
  fetchRecentActivity,
  fetchTotalWorkflows,
  type DigitalSpecialist,
  type ActivityLog,
} from "@/lib/supabaseService";
import { fetchConnectionCounts, type ConnectionCounts } from "@/lib/connectionsService";
import { Plus, Rocket, Link2 } from "lucide-react";

export default function AppDashboard() {
  const { user, profile, organization, orgRole, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  // Real data state
  const [specialists, setSpecialists] = useState<DigitalSpecialist[]>([]);
  const [workflowCounts, setWorkflowCounts] = useState<Record<string, number>>({});
  const [recentActivity, setRecentActivity] = useState<ActivityLog[]>([]);
  const [totalWorkflows, setTotalWorkflows] = useState(0);
  const [connectionCounts, setConnectionCounts] = useState<ConnectionCounts>({ connected: 0, selected: 0, attentionRequired: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.active_organization_id) return;
    const orgId = profile.active_organization_id;

    async function loadData() {
      setLoading(true);
      const [specs, wfCounts, activity, wfTotal, connCounts] = await Promise.all([
        fetchSpecialists(orgId),
        fetchWorkflowCounts(orgId),
        fetchRecentActivity(orgId, 10),
        fetchTotalWorkflows(orgId),
        fetchConnectionCounts(orgId),
      ]);
      setSpecialists(specs);
      setWorkflowCounts(wfCounts);
      setRecentActivity(activity);
      setTotalWorkflows(wfTotal);
      setConnectionCounts(connCounts);
      setLoading(false);
    }

    loadData();
  }, [profile?.active_organization_id]);

  const handleSignOut = async () => {
    setSigningOut(true);
    await signOut();
  };

  const userName = profile?.first_name
    ? `${profile.first_name}${profile.last_name ? ` ${profile.last_name}` : ""}`
    : user?.email || "User";

  const activeSpecialists = specialists.filter(s => s.status === "active");

  return (
    <div className="min-h-screen bg-background">
      {/* Top Bar */}
      <header className="border-b border-subtle bg-surface/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="container flex items-center justify-between h-[64px]">
          <div className="flex items-center gap-4">
            <Link href="/">
              <img src="/manus-storage/upshot-theory-logo_f207295d.png" alt="Upshot Theory" className="h-10 w-auto" />
            </Link>
            <div className="hidden sm:flex items-center gap-2 ml-4">
              <span className="text-[10px] font-mono text-muted-foreground tracking-wider uppercase">Command Center</span>
              <span className="w-1.5 h-1.5 rounded-full bg-[oklch(0.75_0.18_155)] animate-pulse" />
            </div>
            <nav className="hidden md:flex items-center gap-4 ml-6">
              <Link href="/app" className="text-xs font-medium text-foreground">Dashboard</Link>
              <Link href="/app/connections" className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">Connections</Link>
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

      {/* Main Content */}
      <main className="container py-8 lg:py-12">
        {/* Welcome */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <span className="text-[10px] font-mono text-gold tracking-wider uppercase">// Dashboard</span>
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight mt-1">
              Welcome back, {profile?.first_name || "Operator"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {organization?.name} &middot; {orgRole || "Owner"} &middot; Active Digital Specialists: {activeSpecialists.length}
            </p>
          </div>
          <Link
            href="/app/deploy"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm text-[#1a1000] transition-all duration-150 hover:shadow-[0_0_20px_oklch(0.65_0.14_75/30%)] active:scale-[0.97]"
            style={{ backgroundColor: "oklch(0.65 0.14 75)" }}
          >
            <Plus className="w-4 h-4" /> Deploy Specialist
          </Link>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
          <MetricCard label="Active Specialists" value={activeSpecialists.length.toString()} />
          <MetricCard label="Total Specialists" value={specialists.length.toString()} />
          <MetricCard label="Configured Workflows" value={totalWorkflows.toString()} />
          <MetricCard label="Connected Systems" value={connectionCounts.connected.toString()} />
          <MetricCard label="Attention Required" value={connectionCounts.attentionRequired.toString()} highlight={connectionCounts.attentionRequired > 0} />
        </div>

        {/* Connections Summary */}
        <div className="rounded-2xl border border-subtle bg-surface p-5 mb-8">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Link2 className="w-4 h-4 text-gold" />
              <span className="text-[10px] font-mono text-muted-foreground tracking-wider uppercase">Connections</span>
            </div>
            <Link
              href="/app/connections"
              className="text-[11px] font-medium text-gold hover:underline"
            >
              Manage Connections →
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-lg font-mono font-bold">{connectionCounts.connected}</p>
              <p className="text-[10px] text-muted-foreground">Connected</p>
            </div>
            <div>
              <p className="text-lg font-mono font-bold">{connectionCounts.selected}</p>
              <p className="text-[10px] text-muted-foreground">Selected</p>
            </div>
            <div>
              <p className="text-lg font-mono font-bold text-[oklch(0.75_0.18_25)]">{connectionCounts.attentionRequired}</p>
              <p className="text-[10px] text-muted-foreground">Attention Required</p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="flex flex-col items-center gap-3">
              <div className="w-6 h-6 border-2 border-gold border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-muted-foreground font-mono">Loading organization data...</p>
            </div>
          </div>
        ) : (
          <>
            {/* Digital Specialists */}
            <div className="rounded-2xl border border-subtle bg-surface overflow-hidden mb-8">
              <div className="p-5 border-b border-subtle flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-mono text-muted-foreground tracking-wider uppercase">Digital Specialists</p>
                  <strong className="text-sm font-display">Deployed Workforce</strong>
                </div>
                <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-semibold flex items-center gap-1.5 bg-[oklch(0.75_0.18_155/15%)] text-[oklch(0.75_0.18_155)]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[oklch(0.75_0.18_155)]" />
                  {activeSpecialists.length} Active
                </span>
              </div>
              {specialists.length > 0 ? (
                <div className="divide-y divide-subtle">
                  {specialists.map((spec) => (
                    <div key={spec.id} className="flex items-center gap-3 px-5 py-4">
                      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                        spec.status === "active" ? "bg-[oklch(0.75_0.18_155)]" :
                        spec.status === "paused" ? "bg-gold" : "bg-muted-foreground"
                      }`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{spec.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {spec.role_name} &middot; {spec.industry_name} &middot; {spec.oversight_mode.replace("_", " ")} &middot; {(spec.selected_systems || []).length} systems
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-mono text-muted-foreground">{workflowCounts[spec.id] || 0} workflows</span>
                        <p className="text-[10px] text-muted-foreground">
                          {spec.deployed_at ? new Date(spec.deployed_at).toLocaleDateString() : "—"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center">
                  <Rocket className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm font-medium mb-1">No Digital Specialists deployed yet</p>
                  <p className="text-xs text-muted-foreground mb-4">Deploy your first AI operational role to get started.</p>
                  <Link
                    href="/app/deploy"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-xs text-[#1a1000]"
                    style={{ backgroundColor: "oklch(0.65 0.14 75)" }}
                  >
                    <Plus className="w-3 h-3" /> Deploy First Specialist
                  </Link>
                </div>
              )}
            </div>

            {/* Recent Activity */}
            <div className="rounded-2xl border border-subtle bg-surface overflow-hidden">
              <div className="p-5 border-b border-subtle flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-mono text-muted-foreground tracking-wider uppercase">Recent Activity</p>
                  <strong className="text-sm font-display">Organization Activity Log</strong>
                </div>
              </div>
              {recentActivity.length > 0 ? (
                <div className="divide-y divide-subtle">
                  {recentActivity.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 px-5 py-4">
                      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                        item.severity === "success" ? "bg-[oklch(0.75_0.18_155)]" :
                        item.severity === "warning" ? "bg-gold" : "bg-[oklch(0.62_0.22_25)]"
                      }`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.title}</p>
                        <p className="text-[11px] text-muted-foreground">{item.description || item.activity_type}</p>
                      </div>
                      <span className="text-[10px] font-mono text-muted-foreground whitespace-nowrap">
                        {new Date(item.created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center">
                  <p className="text-sm text-muted-foreground">No activity yet</p>
                  <p className="text-xs text-muted-foreground mt-1">Deploy a Digital Specialist to see activity here.</p>
                </div>
              )}
            </div>

            {/* User & Org Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8">
              <div className="rounded-xl border border-subtle bg-surface p-5">
                <span className="text-[10px] font-mono text-muted-foreground tracking-wider uppercase block mb-3">Account</span>
                <div className="space-y-2">
                  <InfoRow label="Name" value={userName} />
                  <InfoRow label="Email" value={user?.email || "—"} />
                  <InfoRow label="Role" value={orgRole || "Owner"} />
                </div>
              </div>
              <div className="rounded-xl border border-subtle bg-surface p-5">
                <span className="text-[10px] font-mono text-muted-foreground tracking-wider uppercase block mb-3">Organization</span>
                <div className="space-y-2">
                  <InfoRow label="Name" value={organization?.name || "—"} />
                  <InfoRow label="Slug" value={organization?.slug || "—"} />
                  <InfoRow label="ID" value={organization?.id?.slice(0, 8) || "—"} />
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function MetricCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border bg-surface p-5 ${highlight ? "border-[oklch(0.62_0.22_25/40%)]" : "border-subtle"}`}>
      <p className="text-[10px] font-mono text-muted-foreground tracking-wider uppercase mb-2">{label}</p>
      <div className="flex items-end gap-2">
        <span className={`text-2xl font-mono font-bold ${highlight ? "text-[oklch(0.75_0.18_25)]" : ""}`}>{value}</span>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-mono">{value}</span>
    </div>
  );
}
