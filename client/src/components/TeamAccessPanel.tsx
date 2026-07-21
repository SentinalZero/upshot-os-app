import { useEffect, useState } from "react";
import { MailPlus, RefreshCw, ShieldCheck, Trash2, UserRound, XCircle } from "lucide-react";
import { fetchTeamAccess, inviteTeamMember, removeTeamMember, revokeTeamInvitation, updateTeamMemberRole, type TeamAccessSnapshot } from "@/lib/teamAccessService";

export function TeamAccessPanel({ organizationId }: { organizationId: string }) {
  const [snapshot, setSnapshot] = useState<TeamAccessSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "member">("member");
  const [pendingRole, setPendingRole] = useState<{ userId: string; email: string; currentRole: string; nextRole: "admin" | "member" } | null>(null);
  const [pendingRemoval, setPendingRemoval] = useState<{ userId: string; email: string; role: string } | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    const result = await fetchTeamAccess(organizationId);
    setLoading(false);
    setSnapshot(result.data);
    setError(result.error);
  };

  useEffect(() => { void load(); }, [organizationId]);

  const invite = async () => {
    if (!email.trim() || working) return;
    setWorking(true);
    setError(null);
    const result = await inviteTeamMember(organizationId, email.trim(), role);
    setWorking(false);
    if (!result.success) {
      setError(result.error || "Invitation could not be sent.");
      return;
    }
    setEmail("");
    setRole("member");
    await load();
  };

  const revoke = async (invitationId: string) => {
    if (working) return;
    setWorking(true);
    setError(null);
    const result = await revokeTeamInvitation(organizationId, invitationId);
    setWorking(false);
    if (!result.success) {
      setError(result.error || "Invitation could not be revoked.");
      return;
    }
    await load();
  };

  const changeRole = async () => {
    if (!pendingRole || working) return;
    setWorking(true);
    setError(null);
    const result = await updateTeamMemberRole(organizationId, pendingRole.userId, pendingRole.nextRole);
    setWorking(false);
    if (!result.success) {
      setError(result.error || "The member role could not be updated.");
      return;
    }
    setPendingRole(null);
    await load();
  };

  const removeMember = async () => {
    if (!pendingRemoval || working) return;
    setWorking(true);
    setError(null);
    const result = await removeTeamMember(organizationId, pendingRemoval.userId);
    setWorking(false);
    if (!result.success) {
      setError(result.error || "Workspace access could not be removed.");
      return;
    }
    setPendingRemoval(null);
    await load();
  };

  if (loading) return <div className="mt-6 flex min-h-40 items-center justify-center rounded-xl border border-subtle bg-background/35"><RefreshCw className="h-5 w-5 animate-spin text-gold" /></div>;

  return (
    <div className="mt-6 space-y-6">
      {snapshot?.canManage && (
        <section className="rounded-xl border border-subtle bg-background/35 p-5">
          <div className="flex items-start gap-3"><MailPlus className="mt-0.5 h-5 w-5 text-gold" /><div><h3 className="text-sm font-semibold">Invite a teammate</h3><p className="mt-1 text-xs text-muted-foreground">Send secure access as an Admin or Member. Owner access cannot be assigned here.</p></div></div>
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_150px_auto]">
            <input type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="name@company.com" className="rounded-lg border border-subtle bg-surface px-3 py-2.5 text-sm outline-none focus:border-gold" />
            <select value={role} onChange={event => setRole(event.target.value as "admin" | "member")} className="rounded-lg border border-subtle bg-surface px-3 py-2.5 text-sm outline-none focus:border-gold"><option value="member">Member</option><option value="admin">Admin</option></select>
            <button type="button" onClick={() => void invite()} disabled={!email.trim() || working} className="rounded-lg bg-gold px-4 py-2.5 text-xs font-semibold text-black disabled:opacity-40">{working ? "Working..." : "Send Invite"}</button>
          </div>
        </section>
      )}

      {error && <div className="rounded-xl border border-[oklch(0.62_0.22_25/35%)] bg-[oklch(0.62_0.22_25/8%)] p-4 text-xs text-[oklch(0.75_0.18_25)]">{error}</div>}

      <section className="rounded-xl border border-subtle bg-background/35 p-5">
        <div className="flex items-center justify-between gap-3"><div><h3 className="text-sm font-semibold">Workspace members</h3><p className="mt-1 text-xs text-muted-foreground">{snapshot?.members.length || 0} active members</p></div><button type="button" onClick={() => void load()} className="rounded-lg border border-subtle p-2 text-muted-foreground hover:text-foreground" aria-label="Refresh members"><RefreshCw className="h-4 w-4" /></button></div>
        <div className="mt-4 divide-y divide-subtle">
          {(snapshot?.members || []).map(member => {
            const name = [member.first_name, member.last_name].filter(Boolean).join(" ") || member.email;
            const isOwner = member.role === "owner";
            const isRequester = member.user_id === snapshot?.requesterUserId;
            const manageable = snapshot?.canManage && !isOwner && !isRequester;
            return (
              <div key={member.user_id} className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0 last:pb-0">
                <div className="flex min-w-0 items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold/10 text-gold"><UserRound className="h-4 w-4" /></span><div className="min-w-0"><p className="truncate text-xs font-semibold">{name}{isRequester ? " · You" : ""}</p><p className="mt-0.5 truncate text-[10px] text-muted-foreground">{member.email}</p></div></div>
                {manageable ? (
                  <div className="flex items-center gap-2">
                    <select
                      value={member.role}
                      disabled={working}
                      onChange={event => setPendingRole({ userId: member.user_id, email: member.email, currentRole: member.role, nextRole: event.target.value as "admin" | "member" })}
                      className="rounded-lg border border-subtle bg-surface px-3 py-2 text-[10px] font-semibold capitalize outline-none focus:border-gold disabled:opacity-50"
                    >
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                    </select>
                    <button type="button" onClick={() => setPendingRemoval({ userId: member.user_id, email: member.email, role: member.role })} disabled={working} className="inline-flex items-center gap-1.5 rounded-lg border border-[oklch(0.62_0.22_25/30%)] px-3 py-2 text-[10px] font-semibold text-[oklch(0.72_0.16_25)] hover:bg-[oklch(0.62_0.22_25/8%)] disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" />Remove</button>
                  </div>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-subtle px-2.5 py-1 text-[9px] font-mono font-semibold capitalize text-muted-foreground"><ShieldCheck className="h-3 w-3 text-gold" />{member.role}</span>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-xl border border-subtle bg-background/35 p-5">
        <h3 className="text-sm font-semibold">Invitations</h3><p className="mt-1 text-xs text-muted-foreground">Pending, accepted, and revoked workspace invitations.</p>
        <div className="mt-4 space-y-3">
          {(snapshot?.invitations || []).length === 0 && <div className="rounded-lg border border-dashed border-subtle p-4 text-xs text-muted-foreground">No invitations have been sent.</div>}
          {(snapshot?.invitations || []).map(invitation => <div key={invitation.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-subtle bg-surface/50 p-4"><div className="min-w-0"><p className="truncate text-xs font-semibold">{invitation.email}</p><p className="mt-1 text-[10px] text-muted-foreground capitalize">{invitation.role} · {invitation.status} · Sent {formatDate(invitation.invited_at)}</p></div><div className="flex items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-[9px] font-mono font-semibold capitalize ${invitation.status === "accepted" ? "bg-[oklch(0.75_0.18_155/15%)] text-[oklch(0.75_0.18_155)]" : invitation.status === "pending" ? "bg-gold/10 text-gold" : "bg-muted/50 text-muted-foreground"}`}>{invitation.status}</span>{snapshot?.canManage && invitation.status === "pending" && <button type="button" onClick={() => void revoke(invitation.id)} disabled={working} className="inline-flex items-center gap-1.5 rounded-lg border border-subtle px-3 py-1.5 text-[10px] font-semibold text-muted-foreground hover:text-foreground disabled:opacity-50"><XCircle className="h-3.5 w-3.5" />Revoke</button>}</div></div>)}
        </div>
      </section>

      {!snapshot?.canManage && <div className="rounded-xl border border-subtle bg-background/35 p-4 text-xs text-muted-foreground">You can view workspace access. Only the Owner can invite teammates, change roles, or remove members.</div>}

      {pendingRole && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/75 p-4" onMouseDown={() => !working && setPendingRole(null)}>
          <div className="w-full max-w-md rounded-2xl border border-subtle bg-background p-6 shadow-2xl" onMouseDown={event => event.stopPropagation()}>
            <p className="text-[10px] font-mono uppercase tracking-wider text-gold">Confirm Role Change</p>
            <h3 className="mt-1 font-display text-xl font-semibold">Change workspace access?</h3>
            <p className="mt-4 text-xs leading-5 text-muted-foreground"><span className="font-semibold text-foreground">{pendingRole.email}</span> will change from {pendingRole.currentRole} to {pendingRole.nextRole}. This affects what they can manage in the workspace.</p>
            <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setPendingRole(null)} disabled={working} className="rounded-lg border border-subtle px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground disabled:opacity-50">Cancel</button><button type="button" onClick={() => void changeRole()} disabled={working} className="rounded-lg bg-gold px-4 py-2 text-xs font-semibold text-black disabled:opacity-50">{working ? "Updating..." : `Change to ${pendingRole.nextRole}`}</button></div>
          </div>
        </div>
      )}

      {pendingRemoval && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/75 p-4" onMouseDown={() => !working && setPendingRemoval(null)}>
          <div className="w-full max-w-md rounded-2xl border border-[oklch(0.62_0.22_25/35%)] bg-background p-6 shadow-2xl" onMouseDown={event => event.stopPropagation()}>
            <p className="text-[10px] font-mono uppercase tracking-wider text-[oklch(0.72_0.16_25)]">Remove Workspace Access</p>
            <h3 className="mt-1 font-display text-xl font-semibold">Remove this member?</h3>
            <p className="mt-4 text-xs leading-5 text-muted-foreground"><span className="font-semibold text-foreground">{pendingRemoval.email}</span> will immediately lose access to this workspace. Their account and historical activity will remain intact.</p>
            <div className="mt-4 rounded-lg border border-subtle bg-surface/60 p-3 text-[10px] text-muted-foreground">Current role: <span className="font-semibold capitalize text-foreground">{pendingRemoval.role}</span></div>
            <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setPendingRemoval(null)} disabled={working} className="rounded-lg border border-subtle px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground disabled:opacity-50">Cancel</button><button type="button" onClick={() => void removeMember()} disabled={working} className="rounded-lg bg-[oklch(0.62_0.22_25)] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">{working ? "Removing..." : "Remove Access"}</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

function formatDate(value: string): string { const date = new Date(value); return Number.isNaN(date.getTime()) ? "recently" : date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }); }
