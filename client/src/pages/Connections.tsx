import { useAuth } from "@/contexts/AuthContext";
import { useState, useEffect, useCallback } from "react";
import { Link, useSearch } from "wouter";
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
import {
  startGoogleOAuth,
  disconnectGoogleOAuth,
} from "@/lib/googleOAuthService";
import { ArrowLeft, Link2, Unlink, Plug, AlertCircle, CheckCircle2, Clock, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

// Status badge configuration
const statusConfig: Record<IntegrationStatus, { label: string; className: string; icon: React.ReactNode }> = {
  connected: {
    label: "Connected",
    className: "bg-[oklch(0.75_0.18_155/15%)] text-[oklch(0.75_0.18_155)] border-[oklch(0.75_0.18_155/30%)]",
    icon: <CheckCircle2 className="w-3 h-3" />,
  },
  selected: {
    label: "Selected",
    className: "bg-[oklch(0.65_0.14_75/15%)] text-gold border-[oklch(0.65_0.14_75/30%)]",
    icon: <Plug className="w-3 h-3" />,
  },
  pending: {
    label: "Connection Pending",
    className: "bg-[oklch(0.7_0.15_220/15%)] text-[oklch(0.7_0.15_220)] border-[oklch(0.7_0.15_220/30%)]",
    icon: <Clock className="w-3 h-3" />,
  },
  expired: {
    label: "Expired",
    className: "bg-[oklch(0.62_0.22_25/15%)] text-[oklch(0.75_0.18_25)] border-[oklch(0.62_0.22_25/30%)]",
    icon: <AlertCircle className="w-3 h-3" />,
  },
  disconnected: {
    label: "Disconnected",
    className: "bg-muted text-muted-foreground border-subtle",
    icon: <Unlink className="w-3 h-3" />,
  },
  error: {
    label: "Error",
    className: "bg-[oklch(0.62_0.22_25/15%)] text-[oklch(0.75_0.18_25)] border-[oklch(0.62_0.22_25/30%)]",
    icon: <XCircle className="w-3 h-3" />,
  },
};

// Google Workspace provider key constant
const GOOGLE_WORKSPACE_KEY = "google_workspace";

export default function Connections() {
  const { user, profile, organization } = useAuth();
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

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle OAuth redirect query params
  useEffect(() => {
    if (!searchString) return;
    const params = new URLSearchParams(searchString);

    const googleStatus = params.get("google");
    const reason = params.get("reason");

    if (googleStatus === "connected") {
      toast.success("Google Workspace connected successfully!");
      // Reload data to reflect the new connected status
      loadData();
      // Clean URL
      window.history.replaceState({}, "", "/app/connections");
    }

    if (googleStatus === "error") {
      const errorMessages: Record<string, string> = {
        access_denied: "You denied access. No connection was made.",
        missing_code_or_state: "OAuth callback was missing required parameters.",
        invalid_state: "Invalid OAuth state. Please try connecting again.",
        state_expired: "The connection attempt expired. Please try again.",
        state_mismatch: "Security check failed. Please try connecting again.",
        token_exchange_failed: "Failed to exchange authorization code. Please try again.",
        no_access_token: "Google did not provide an access token.",
        secret_storage_failed: "Failed to securely store credentials. Contact support.",
        update_failed: "Connection succeeded but status update failed. Please refresh.",
        integration_not_found: "Integration record not found. Please try again.",
        unexpected_error: "An unexpected error occurred. Please try again.",
      };
      toast.error(errorMessages[reason || ""] || `OAuth error: ${reason || "unknown"}`);
      // Clean URL
      window.history.replaceState({}, "", "/app/connections");
    }
  }, [searchString, loadData]);

  // Derived data
  const connectedProviderKeys = new Set(integrations.map(i => i.provider_key));
  const connectedIntegrations = integrations.filter(i => i.status === "connected");
  const otherIntegrations = integrations.filter(i => i.status !== "connected");
  const availableCatalog = catalog.filter(c => !connectedProviderKeys.has(c.provider_key));

  // ─── Actions ───────────────────────────────────────────────────────────────

  const handleSelectIntegration = async (catalogItem: CatalogProvider) => {
    if (!orgId || !user) return;
    setActionLoading(catalogItem.id);

    const result = await selectIntegration(orgId, user.id, catalogItem);

    if (result.success) {
      toast.success(`${catalogItem.provider_name} selected`);
      await loadData();
    } else {
      toast.error(result.error || "Failed to select integration");
    }
    setActionLoading(null);
  };

  const handleConnect = async (integration: Integration) => {
    if (!orgId || !user) return;

    // Check if this is a Google Workspace integration
    if (integration.provider_key === GOOGLE_WORKSPACE_KEY) {
      setActionLoading(integration.id);

      const result = await startGoogleOAuth(integration.id, orgId);

      if (result.success && result.url) {
        // Redirect to Google consent screen
        window.location.href = result.url;
        return; // Page will navigate away
      } else {
        toast.error(result.error || "Failed to start Google OAuth");
        setActionLoading(null);
      }
    } else {
      // Non-Google integrations: placeholder for future releases
      toast.info("OAuth connection for this provider is coming in a future release.");
    }
  };

  const handleDisconnect = async (integration: Integration) => {
    if (!orgId || !user) return;

    // Check if this is a Google Workspace integration
    if (integration.provider_key === GOOGLE_WORKSPACE_KEY) {
      setActionLoading(integration.id);

      const result = await disconnectGoogleOAuth(integration.id, orgId);

      if (result.success) {
        toast.success("Google Workspace disconnected");
        await loadData();
      } else {
        toast.error(result.error || "Failed to disconnect");
      }
      setActionLoading(null);
    } else {
      toast.info("Disconnection for this provider is coming in a future release.");
    }
  };

  const handleAssignSpecialist = async (integrationId: string, specialistId: string | null) => {
    setActionLoading(integrationId);
    const result = await assignIntegrationToSpecialist(integrationId, specialistId);
    if (result.success) {
      toast.success("Assignment updated");
      await loadData();
    } else {
      toast.error(result.error || "Failed to update assignment");
    }
    setActionLoading(null);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Top Bar */}
      <header className="border-b border-subtle bg-surface/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="container flex items-center justify-between h-[64px]">
          <div className="flex items-center gap-4">
            <Link href="/app">
              <span className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeft className="w-4 h-4" /> Command Center
              </span>
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-mono text-muted-foreground tracking-wider uppercase hidden sm:block">
              {organization?.name}
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-[oklch(0.75_0.18_155)] animate-pulse" />
          </div>
        </div>
      </header>

      <main className="container py-8 lg:py-12">
        {/* Page Header */}
        <div className="mb-8">
          <span className="text-[10px] font-mono text-gold tracking-wider uppercase">// Connections Center</span>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight mt-1">
            System Connections
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage integrations between your Digital Specialists and business systems.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="flex flex-col items-center gap-3">
              <div className="w-6 h-6 border-2 border-gold border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-muted-foreground font-mono">Loading connections...</p>
            </div>
          </div>
        ) : (
          <>
            {/* ─── Connected Systems ─────────────────────────────────────────── */}
            <section className="mb-10">
              <div className="flex items-center gap-2 mb-4">
                <Link2 className="w-4 h-4 text-[oklch(0.75_0.18_155)]" />
                <h2 className="font-display text-lg font-semibold">Connected Systems</h2>
                <span className="text-[10px] font-mono text-muted-foreground ml-2">{connectedIntegrations.length} active</span>
              </div>

              {connectedIntegrations.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {connectedIntegrations.map(integration => (
                    <ConnectedCard
                      key={integration.id}
                      integration={integration}
                      specialists={specialists}
                      actionLoading={actionLoading}
                      onDisconnect={handleDisconnect}
                      onAssign={handleAssignSpecialist}
                    />
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-subtle bg-surface p-8 text-center">
                  <Link2 className="w-8 h-8 text-muted-foreground mx-auto mb-3 opacity-50" />
                  <p className="text-sm font-medium mb-1">No connected systems</p>
                  <p className="text-xs text-muted-foreground">Select an integration below and connect it to start automating workflows.</p>
                </div>
              )}
            </section>

            {/* ─── Selected / Pending / Error Integrations ────────────────────── */}
            {otherIntegrations.length > 0 && (
              <section className="mb-10">
                <div className="flex items-center gap-2 mb-4">
                  <Plug className="w-4 h-4 text-gold" />
                  <h2 className="font-display text-lg font-semibold">Selected Integrations</h2>
                  <span className="text-[10px] font-mono text-muted-foreground ml-2">{otherIntegrations.length} pending connection</span>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {otherIntegrations.map(integration => (
                    <IntegrationCard
                      key={integration.id}
                      integration={integration}
                      specialists={specialists}
                      actionLoading={actionLoading}
                      onConnect={handleConnect}
                      onAssign={handleAssignSpecialist}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* ─── Available Integrations ──────────────────────────────────────── */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Plug className="w-4 h-4 text-muted-foreground" />
                <h2 className="font-display text-lg font-semibold">Available Integrations</h2>
                <span className="text-[10px] font-mono text-muted-foreground ml-2">{availableCatalog.length} providers</span>
              </div>

              {availableCatalog.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {availableCatalog.map(item => (
                    <CatalogCard
                      key={item.id}
                      item={item}
                      actionLoading={actionLoading}
                      onSelect={handleSelectIntegration}
                    />
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-subtle bg-surface p-8 text-center">
                  <CheckCircle2 className="w-8 h-8 text-[oklch(0.75_0.18_155)] mx-auto mb-3 opacity-50" />
                  <p className="text-sm font-medium mb-1">All integrations selected</p>
                  <p className="text-xs text-muted-foreground">Every available provider has been added to your organization.</p>
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: IntegrationStatus }) {
  const config = statusConfig[status] || statusConfig.selected;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border ${config.className}`}>
      {config.icon}
      {config.label}
    </span>
  );
}

function ConnectedCard({
  integration,
  specialists,
  actionLoading,
  onDisconnect,
  onAssign,
}: {
  integration: Integration;
  specialists: DigitalSpecialist[];
  actionLoading: string | null;
  onDisconnect: (i: Integration) => void;
  onAssign: (integrationId: string, specialistId: string | null) => void;
}) {
  const isLoading = actionLoading === integration.id;

  return (
    <div className="rounded-xl border border-[oklch(0.75_0.18_155/20%)] bg-surface p-5">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold">{integration.provider_name}</h3>
          <StatusBadge status={integration.status} />
        </div>
      </div>

      <div className="space-y-1.5 mb-4">
        {integration.external_account_name && (
          <InfoRow label="Account" value={integration.external_account_name} />
        )}
        {integration.external_account_email && (
          <InfoRow label="Email" value={integration.external_account_email} />
        )}
        {integration.connected_at && (
          <InfoRow label="Connected" value={new Date(integration.connected_at).toLocaleDateString()} />
        )}
        {integration.last_verified_at && (
          <InfoRow label="Last Verified" value={new Date(integration.last_verified_at).toLocaleDateString()} />
        )}
        {integration.granted_scopes && integration.granted_scopes.length > 0 && (
          <div>
            <span className="text-[10px] text-muted-foreground block mb-1">Scopes</span>
            <div className="flex flex-wrap gap-1">
              {integration.granted_scopes.map(scope => (
                <span key={scope} className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{scope}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Specialist Assignment */}
      <SpecialistSelect
        specialists={specialists}
        currentId={integration.digital_specialist_id}
        onChange={(id) => onAssign(integration.id, id)}
        disabled={isLoading}
      />

      {/* Disconnect */}
      <button
        onClick={() => onDisconnect(integration)}
        disabled={isLoading}
        className="w-full mt-3 py-2 rounded-lg text-xs font-medium border border-subtle text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-all disabled:opacity-40"
      >
        {isLoading ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : "Disconnect"}
      </button>
    </div>
  );
}

function IntegrationCard({
  integration,
  specialists,
  actionLoading,
  onConnect,
  onAssign,
}: {
  integration: Integration;
  specialists: DigitalSpecialist[];
  actionLoading: string | null;
  onConnect: (i: Integration) => void;
  onAssign: (integrationId: string, specialistId: string | null) => void;
}) {
  const isLoading = actionLoading === integration.id;
  const canConnect = ["selected", "disconnected", "error", "expired"].includes(integration.status);
  const isPending = integration.status === "pending";

  return (
    <div className="rounded-xl border border-subtle bg-surface p-5">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold">{integration.provider_name}</h3>
          <StatusBadge status={integration.status} />
        </div>
      </div>

      {/* Specialist Assignment */}
      <SpecialistSelect
        specialists={specialists}
        currentId={integration.digital_specialist_id}
        onChange={(id) => onAssign(integration.id, id)}
        disabled={isLoading}
      />

      {/* Connect / Pending */}
      {canConnect && (
        <button
          onClick={() => onConnect(integration)}
          disabled={isLoading}
          className="w-full mt-3 py-2 rounded-lg text-xs font-semibold bg-gold text-background hover:bg-gold/90 disabled:opacity-40 transition-all active:scale-[0.97]"
          style={{ backgroundColor: "oklch(0.65 0.14 75)" }}
        >
          {isLoading ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : "Connect"}
        </button>
      )}
      {isPending && (
        <div className="mt-3 py-2 rounded-lg text-xs font-medium text-center border border-[oklch(0.7_0.15_220/30%)] text-[oklch(0.7_0.15_220)] bg-[oklch(0.7_0.15_220/8%)]">
          <Loader2 className="w-3 h-3 animate-spin inline-block mr-1.5" />
          Waiting for Google authorization...
        </div>
      )}
    </div>
  );
}

function CatalogCard({
  item,
  actionLoading,
  onSelect,
}: {
  item: CatalogProvider;
  actionLoading: string | null;
  onSelect: (item: CatalogProvider) => void;
}) {
  const isLoading = actionLoading === item.id;

  return (
    <div className="rounded-xl border border-subtle bg-surface p-5">
      <div className="mb-3">
        <h3 className="text-sm font-semibold">{item.provider_name}</h3>
        <span className="text-[10px] font-mono text-muted-foreground tracking-wider uppercase">{item.category}</span>
      </div>
      {item.description && (
        <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{item.description}</p>
      )}
      <div className="mb-3">
        <InfoRow label="Auth Type" value={item.auth_type} />
      </div>
      <button
        onClick={() => onSelect(item)}
        disabled={isLoading}
        className="w-full py-2 rounded-lg text-xs font-semibold border border-gold/40 text-gold hover:bg-[oklch(0.65_0.14_75/10%)] disabled:opacity-40 transition-all active:scale-[0.97]"
      >
        {isLoading ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : "Select Integration"}
      </button>
    </div>
  );
}

function SpecialistSelect({
  specialists,
  currentId,
  onChange,
  disabled,
}: {
  specialists: DigitalSpecialist[];
  currentId: string | null;
  onChange: (id: string | null) => void;
  disabled: boolean;
}) {
  if (specialists.length === 0) {
    return (
      <div className="text-[10px] text-muted-foreground mt-2">
        No Digital Specialists available for assignment.
      </div>
    );
  }

  return (
    <div className="mt-3">
      <label className="text-[10px] font-mono text-muted-foreground tracking-wider uppercase block mb-1">Assigned Specialist</label>
      <select
        value={currentId || ""}
        onChange={e => onChange(e.target.value || null)}
        disabled={disabled}
        className="w-full px-3 py-2 rounded-lg border border-subtle bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-gold/40 disabled:opacity-50 transition-all"
      >
        <option value="">No specific Digital Specialist</option>
        {specialists.map(s => (
          <option key={s.id} value={s.id}>{s.name}</option>
        ))}
      </select>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <span className="text-[10px] font-mono">{value}</span>
    </div>
  );
}
