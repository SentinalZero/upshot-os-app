import { useAuth } from "@/contexts/AuthContext";
import { useState, useEffect, useCallback } from "react";
import { useSearch } from "wouter";
import {
  fetchIntegrationCatalog,
  fetchOrgIntegrations,
  selectIntegration,
  assignIntegrationToSpecialist,
  type CatalogProvider,
  type Integration,
  type IntegrationStatus,
} from "@/lib/connectionsService";
import { fetchSpecialists, type DigitalSpecialist } from "@/lib/supabaseService";
import { startGoogleOAuth, disconnectGoogleOAuth } from "@/lib/googleOAuthService";
import { AlertCircle, CheckCircle2, Clock, Link2, Loader2, Plug, Unlink, XCircle } from "lucide-react";
import { toast } from "sonner";

const statusConfig: Record<IntegrationStatus, { label: string; className: string; icon: React.ReactNode }> = {
  connected: { label: "Connected", className: "bg-emerald-400/10 text-emerald-400 border-emerald-400/25", icon: <CheckCircle2 className="h-3 w-3" /> },
  selected: { label: "Ready to connect", className: "bg-gold/10 text-gold border-gold/25", icon: <Plug className="h-3 w-3" /> },
  pending: { label: "Connecting", className: "bg-sky-400/10 text-sky-400 border-sky-400/25", icon: <Clock className="h-3 w-3" /> },
  expired: { label: "Reconnect", className: "bg-red-400/10 text-red-400 border-red-400/25", icon: <AlertCircle className="h-3 w-3" /> },
  disconnected: { label: "Disconnected", className: "bg-muted text-muted-foreground border-subtle", icon: <Unlink className="h-3 w-3" /> },
  error: { label: "Needs attention", className: "bg-red-400/10 text-red-400 border-red-400/25", icon: <XCircle className="h-3 w-3" /> },
};

const GOOGLE_WORKSPACE_KEY = "google_workspace";

export default function Connections() {
  const { user, profile } = useAuth();
  const searchString = useSearch();
  const [catalog, setCatalog] = useState<CatalogProvider[]>([]);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [specialists, setSpecialists] = useState<DigitalSpecialist[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const orgId = profile?.active_organization_id;

  const loadData = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    const [catalogData, integrationsData, specialistsData] = await Promise.all([
      fetchIntegrationCatalog(),
      fetchOrgIntegrations(orgId),
      fetchSpecialists(orgId),
    ]);
    setCatalog(catalogData);
    setIntegrations(integrationsData);
    setSpecialists(specialistsData);
    setLoading(false);
  }, [orgId]);

  useEffect(() => { void loadData(); }, [loadData]);

  useEffect(() => {
    if (!searchString) return;
    const params = new URLSearchParams(searchString);
    const googleStatus = params.get("google");
    const reason = params.get("reason");
    if (googleStatus === "connected") {
      toast.success("Google Workspace connected successfully.");
      void loadData();
      window.history.replaceState({}, "", "/app/connections");
    }
    if (googleStatus === "error") {
      toast.error(reason ? `Google connection failed: ${reason.replaceAll("_", " ")}` : "Google connection failed.");
      window.history.replaceState({}, "", "/app/connections");
    }
  }, [searchString, loadData]);

  const connectedProviderKeys = new Set(integrations.map(item => item.provider_key));
  const connectedIntegrations = integrations.filter(item => item.status === "connected");
  const otherIntegrations = integrations.filter(item => item.status !== "connected");
  const availableCatalog = catalog.filter(item => !connectedProviderKeys.has(item.provider_key));

  const handleSelectIntegration = async (catalogItem: CatalogProvider) => {
    if (!orgId || !user) return;
    setActionLoading(catalogItem.id);
    const result = await selectIntegration(orgId, user.id, catalogItem);
    result.success ? toast.success(`${catalogItem.provider_name} added`) : toast.error(result.error || "Could not add integration");
    if (result.success) await loadData();
    setActionLoading(null);
  };

  const handleConnect = async (integration: Integration) => {
    if (!orgId || !user) return;
    if (integration.provider_key !== GOOGLE_WORKSPACE_KEY) {
      toast.info("This connection is coming in a future release.");
      return;
    }
    setActionLoading(integration.id);
    const result = await startGoogleOAuth(integration.id, orgId);
    if (result.success && result.url) {
      window.location.href = result.url;
      return;
    }
    toast.error(result.error || "Could not start Google authorization");
    setActionLoading(null);
  };

  const handleDisconnect = async (integration: Integration) => {
    if (!orgId || !user) return;
    if (integration.provider_key !== GOOGLE_WORKSPACE_KEY) {
      toast.info("This connection cannot be disconnected yet.");
      return;
    }
    setActionLoading(integration.id);
    const result = await disconnectGoogleOAuth(integration.id, orgId);
    result.success ? toast.success("Google Workspace disconnected") : toast.error(result.error || "Could not disconnect Google Workspace");
    if (result.success) await loadData();
    setActionLoading(null);
  };

  const handleAssignSpecialist = async (integrationId: string, specialistId: string | null) => {
    setActionLoading(integrationId);
    const result = await assignIntegrationToSpecialist(integrationId, specialistId);
    result.success ? toast.success("Specialist assignment updated") : toast.error(result.error || "Could not update assignment");
    if (result.success) await loadData();
    setActionLoading(null);
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="container py-8 lg:py-12">
        <div className="mb-8 max-w-3xl">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-gold/20 bg-gold/5 px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.16em] text-gold"><Link2 className="h-3.5 w-3.5" /> Systems</div>
          <h1 className="font-display text-3xl font-semibold tracking-tight lg:text-4xl">The tools your Specialists work across</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">Connect the systems your team already uses, then assign each connection to the Specialist responsible for the work.</p>
        </div>

        {loading ? (
          <div className="grid min-h-72 place-items-center"><div className="text-center"><div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-gold border-t-transparent" /><p className="mt-3 text-xs font-mono text-muted-foreground">Loading systems...</p></div></div>
        ) : (
          <div className="space-y-10">
            <section>
              <SectionTitle icon={<Link2 className="h-4 w-4 text-emerald-400" />} title="Connected systems" count={`${connectedIntegrations.length} active`} />
              {connectedIntegrations.length ? (
                <div className="mt-4 grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
                  {connectedIntegrations.map(integration => <ConnectedCard key={integration.id} integration={integration} specialists={specialists} actionLoading={actionLoading} onDisconnect={handleDisconnect} onAssign={handleAssignSpecialist} />)}
                </div>
              ) : (
                <EmptyState title="No systems connected yet" body="Connect Google Workspace to let a Specialist work with Gmail and Calendar." />
              )}
            </section>

            {otherIntegrations.length > 0 && (
              <section>
                <SectionTitle icon={<Plug className="h-4 w-4 text-gold" />} title="Ready to connect" count={`${otherIntegrations.length} selected`} />
                <div className="mt-4 grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
                  {otherIntegrations.map(integration => <IntegrationCard key={integration.id} integration={integration} specialists={specialists} actionLoading={actionLoading} onConnect={handleConnect} onAssign={handleAssignSpecialist} />)}
                </div>
              </section>
            )}

            {availableCatalog.length > 0 && (
              <section>
                <SectionTitle icon={<Plug className="h-4 w-4 text-muted-foreground" />} title="Available systems" count={`${availableCatalog.length} providers`} />
                <div className="mt-4 grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
                  {availableCatalog.map(item => <CatalogCard key={item.id} item={item} actionLoading={actionLoading} onSelect={handleSelectIntegration} />)}
                </div>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function SectionTitle({ icon, title, count }: { icon: React.ReactNode; title: string; count: string }) {
  return <div className="flex items-center gap-2">{icon}<h2 className="font-display text-xl font-semibold">{title}</h2><span className="ml-2 text-[10px] font-mono text-muted-foreground">{count}</span></div>;
}

function StatusBadge({ status }: { status: IntegrationStatus }) {
  const config = statusConfig[status] || statusConfig.selected;
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-mono font-semibold ${config.className}`}>{config.icon}{config.label}</span>;
}

function ConnectedCard({ integration, specialists, actionLoading, onDisconnect, onAssign }: { integration: Integration; specialists: DigitalSpecialist[]; actionLoading: string | null; onDisconnect: (integration: Integration) => void; onAssign: (integrationId: string, specialistId: string | null) => void }) {
  const isLoading = actionLoading === integration.id;
  const googleCapabilities = integration.provider_key === GOOGLE_WORKSPACE_KEY ? ["Gmail", "Google Calendar"] : [integration.provider_name];
  const assignedName = specialists.find(item => item.id === integration.digital_specialist_id)?.name;
  return (
    <article className="rounded-3xl border border-emerald-400/20 bg-surface p-6">
      <div className="flex items-start justify-between gap-4"><div><h3 className="font-display text-xl font-semibold">{integration.provider_name}</h3><div className="mt-2"><StatusBadge status={integration.status} /></div></div><div className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-400/10 text-emerald-400"><Link2 className="h-5 w-5" /></div></div>
      <div className="mt-5 rounded-2xl border border-subtle bg-background/35 p-4"><p className="text-[9px] font-mono uppercase tracking-[0.16em] text-muted-foreground">Available to your Specialist</p><div className="mt-3 flex flex-wrap gap-2">{googleCapabilities.map(item => <span key={item} className="rounded-full border border-subtle px-3 py-1.5 text-xs">{item}</span>)}</div></div>
      <div className="mt-5 grid gap-3 text-xs sm:grid-cols-2"><SimpleDetail label="Assigned to" value={assignedName || "Choose a Specialist"} /><SimpleDetail label="Last verified" value={integration.last_verified_at ? new Date(integration.last_verified_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "Connected"} /></div>
      <SpecialistSelect specialists={specialists} currentId={integration.digital_specialist_id} onChange={id => onAssign(integration.id, id)} disabled={isLoading} />
      <button onClick={() => onDisconnect(integration)} disabled={isLoading} className="mt-4 w-full rounded-xl border border-subtle py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40">{isLoading ? <Loader2 className="mx-auto h-3.5 w-3.5 animate-spin" /> : "Disconnect"}</button>
    </article>
  );
}

function IntegrationCard({ integration, specialists, actionLoading, onConnect, onAssign }: { integration: Integration; specialists: DigitalSpecialist[]; actionLoading: string | null; onConnect: (integration: Integration) => void; onAssign: (integrationId: string, specialistId: string | null) => void }) {
  const isLoading = actionLoading === integration.id;
  const canConnect = ["selected", "disconnected", "error", "expired"].includes(integration.status);
  return <article className="rounded-3xl border border-subtle bg-surface p-6"><h3 className="font-display text-lg font-semibold">{integration.provider_name}</h3><div className="mt-2"><StatusBadge status={integration.status} /></div><SpecialistSelect specialists={specialists} currentId={integration.digital_specialist_id} onChange={id => onAssign(integration.id, id)} disabled={isLoading} />{canConnect && <button onClick={() => onConnect(integration)} disabled={isLoading} className="mt-4 w-full rounded-xl bg-gold py-2.5 text-xs font-semibold text-[#1a1000] disabled:opacity-40">{isLoading ? <Loader2 className="mx-auto h-3.5 w-3.5 animate-spin" /> : "Connect"}</button>}{integration.status === "pending" && <div className="mt-4 rounded-xl border border-sky-400/25 bg-sky-400/5 py-2.5 text-center text-xs text-sky-400"><Loader2 className="mr-1.5 inline h-3.5 w-3.5 animate-spin" />Waiting for authorization</div>}</article>;
}

function CatalogCard({ item, actionLoading, onSelect }: { item: CatalogProvider; actionLoading: string | null; onSelect: (item: CatalogProvider) => void }) {
  const isLoading = actionLoading === item.id;
  return <article className="rounded-3xl border border-subtle bg-surface p-6"><h3 className="font-display text-lg font-semibold">{item.provider_name}</h3><p className="mt-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{item.category}</p>{item.description && <p className="mt-3 line-clamp-2 text-xs leading-5 text-muted-foreground">{item.description}</p>}<button onClick={() => onSelect(item)} disabled={isLoading} className="mt-5 w-full rounded-xl border border-gold/35 py-2.5 text-xs font-semibold text-gold disabled:opacity-40">{isLoading ? <Loader2 className="mx-auto h-3.5 w-3.5 animate-spin" /> : "Add system"}</button></article>;
}

function SpecialistSelect({ specialists, currentId, onChange, disabled }: { specialists: DigitalSpecialist[]; currentId: string | null; onChange: (id: string | null) => void; disabled: boolean }) {
  return <div className="mt-5"><label className="mb-1.5 block text-[9px] font-mono uppercase tracking-[0.16em] text-muted-foreground">Assigned Specialist</label><select value={currentId || ""} onChange={event => onChange(event.target.value || null)} disabled={disabled} className="w-full rounded-xl border border-subtle bg-background px-3 py-2.5 text-xs text-foreground outline-none focus:ring-2 focus:ring-gold/30 disabled:opacity-50"><option value="">Choose a Specialist</option>{specialists.map(specialist => <option key={specialist.id} value={specialist.id}>{specialist.name}</option>)}</select></div>;
}

function SimpleDetail({ label, value }: { label: string; value: string }) { return <div><p className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-1 font-medium">{value}</p></div>; }
function EmptyState({ title, body }: { title: string; body: string }) { return <div className="mt-4 rounded-3xl border border-dashed border-subtle bg-surface p-10 text-center"><Link2 className="mx-auto h-8 w-8 text-muted-foreground" /><p className="mt-4 font-display text-lg font-semibold">{title}</p><p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{body}</p></div>; }
