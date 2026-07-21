import { useEffect, useState } from "react";
import { AlertTriangle, RefreshCw, Save, ShieldCheck } from "lucide-react";
import { fetchOrganizationPolicy, updateOrganizationPolicy, type EmailPolicyMode, type OrganizationPolicySnapshot, type WorkspaceRole } from "@/lib/organizationPolicyService";

const roles: WorkspaceRole[] = ["owner", "admin", "member"];

export function OrganizationPolicyPanel({ organizationId }: { organizationId: string }) {
  const [snapshot, setSnapshot] = useState<OrganizationPolicySnapshot | null>(null);
  const [mode, setMode] = useState<EmailPolicyMode>("draft_only");
  const [approvers, setApprovers] = useState<WorkspaceRole[]>(["owner", "admin"]);
  const [senders, setSenders] = useState<WorkspaceRole[]>(["owner", "admin"]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [confirmAutoSend, setConfirmAutoSend] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    const result = await fetchOrganizationPolicy(organizationId);
    setLoading(false);
    setSnapshot(result.data);
    setError(result.error);
    if (result.data) {
      setMode(result.data.policy.email_mode);
      setApprovers(result.data.policy.approver_roles);
      setSenders(result.data.policy.sender_roles);
    }
  };

  useEffect(() => { void load(); }, [organizationId]);

  const toggleRole = (role: WorkspaceRole, values: WorkspaceRole[], setter: (next: WorkspaceRole[]) => void) => {
    const next = values.includes(role) ? values.filter(item => item !== role) : [...values, role];
    if (next.length) setter(next);
  };

  const save = async () => {
    if (!snapshot?.canManage || saving) return;
    if (mode === "auto_send_after_approval" && !confirmAutoSend) {
      setConfirmAutoSend(true);
      return;
    }
    setSaving(true);
    setError(null);
    setSaved(false);
    const result = await updateOrganizationPolicy(organizationId, { email_mode: mode, approver_roles: approvers, sender_roles: senders });
    setSaving(false);
    if (!result.success) {
      setError(result.error || "Policy could not be saved.");
      return;
    }
    setConfirmAutoSend(false);
    setSaved(true);
    await load();
  };

  if (loading) return <div className="mt-6 flex min-h-40 items-center justify-center rounded-xl border border-subtle bg-background/35"><RefreshCw className="h-5 w-5 animate-spin text-gold" /></div>;

  return (
    <div className="mt-6 space-y-5">
      {error && <div className="rounded-xl border border-[oklch(0.62_0.22_25/35%)] bg-[oklch(0.62_0.22_25/8%)] p-4 text-xs text-[oklch(0.75_0.18_25)]">{error}</div>}
      {saved && <div className="rounded-xl border border-[oklch(0.75_0.18_155/30%)] bg-[oklch(0.75_0.18_155/8%)] p-4 text-xs text-[oklch(0.75_0.18_155)]">Organization policy saved.</div>}

      <section className="rounded-xl border border-subtle bg-background/35 p-5">
        <div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 text-gold" /><div><h3 className="text-sm font-semibold">Email execution policy</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">Choose how Digital Specialists handle prepared customer emails across this workspace.</p></div></div>
        <div className="mt-5 grid gap-3">
          <PolicyOption value="draft_only" current={mode} onSelect={setMode} title="Draft only" description="Prepare Gmail drafts. A person reviews and sends manually." disabled={!snapshot?.canManage} />
          <PolicyOption value="approval_required" current={mode} onSelect={setMode} title="Approval required" description="A person must approve the draft before Upshot can send it." disabled={!snapshot?.canManage} />
          <PolicyOption value="auto_send_after_approval" current={mode} onSelect={setMode} title="Auto send after approval" description="Once approved, Upshot sends without a second send click." disabled={!snapshot?.canManage} warning />
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <RoleCard title="Who can approve" description="Roles allowed to approve prepared drafts." values={approvers} onToggle={role => toggleRole(role, approvers, setApprovers)} disabled={!snapshot?.canManage} />
        <RoleCard title="Who can send" description="Roles allowed to perform the explicit send action." values={senders} onToggle={role => toggleRole(role, senders, setSenders)} disabled={!snapshot?.canManage} />
      </section>

      {confirmAutoSend && <div className="rounded-xl border border-[oklch(0.75_0.18_75/40%)] bg-[oklch(0.75_0.18_75/8%)] p-5"><div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 h-5 w-5 text-[oklch(0.78_0.16_75)]" /><div><p className="text-sm font-semibold">Confirm automated sending</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Approved emails will be sent without a second manual confirmation. Review approver access carefully before enabling this mode.</p></div></div></div>}

      {snapshot?.canManage ? <button type="button" onClick={() => void save()} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-gold px-4 py-2.5 text-xs font-semibold text-black disabled:opacity-50"><Save className="h-4 w-4" />{saving ? "Saving..." : confirmAutoSend ? "Confirm and Save" : "Save Policy"}</button> : <div className="rounded-xl border border-subtle bg-background/35 p-4 text-xs text-muted-foreground">You can view this policy. Only the Owner can change organization approval settings.</div>}
    </div>
  );
}

function PolicyOption({ value, current, onSelect, title, description, disabled, warning }: { value: EmailPolicyMode; current: EmailPolicyMode; onSelect: (value: EmailPolicyMode) => void; title: string; description: string; disabled: boolean; warning?: boolean }) {
  const active = value === current;
  return <button type="button" disabled={disabled} onClick={() => onSelect(value)} className={`rounded-xl border p-4 text-left transition-colors disabled:cursor-default ${active ? "border-gold/50 bg-gold/8" : "border-subtle bg-surface/40 hover:border-foreground/20"}`}><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-semibold">{title}</p><p className="mt-1 text-[10px] leading-4 text-muted-foreground">{description}</p></div><span className={`h-4 w-4 shrink-0 rounded-full border ${active ? "border-gold bg-gold shadow-[inset_0_0_0_3px_var(--background)]" : "border-muted-foreground"}`} /></div>{warning && <p className="mt-2 text-[9px] font-mono uppercase tracking-wider text-[oklch(0.78_0.16_75)]">Higher automation</p>}</button>;
}

function RoleCard({ title, description, values, onToggle, disabled }: { title: string; description: string; values: WorkspaceRole[]; onToggle: (role: WorkspaceRole) => void; disabled: boolean }) {
  return <section className="rounded-xl border border-subtle bg-background/35 p-5"><h3 className="text-sm font-semibold">{title}</h3><p className="mt-1 text-xs text-muted-foreground">{description}</p><div className="mt-4 flex flex-wrap gap-2">{roles.map(role => <button key={role} type="button" disabled={disabled} onClick={() => onToggle(role)} className={`rounded-full border px-3 py-1.5 text-[10px] font-semibold capitalize ${values.includes(role) ? "border-gold/40 bg-gold/10 text-gold" : "border-subtle text-muted-foreground"}`}>{role}</button>)}</div></section>;
}
