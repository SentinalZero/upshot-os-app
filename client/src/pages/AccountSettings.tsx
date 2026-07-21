import { Link, useLocation } from "wouter";
import { Building2, ChevronLeft, ShieldCheck, UserRound, UsersRound } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { AppUserMenu } from "@/components/AppUserMenu";
import { TeamAccessPanel } from "@/components/TeamAccessPanel";

export default function AccountSettings() {
  const { user, profile, organization, orgRole } = useAuth();
  const [location] = useLocation();
  const section = location.endsWith("/team") ? "team" : location.endsWith("/organization") ? "organization" : "profile";
  const role = formatRole(orgRole);
  const canManage = ["owner", "admin"].includes((orgRole || "").toLowerCase());
  const name = profile?.first_name
    ? `${profile.first_name}${profile.last_name ? ` ${profile.last_name}` : ""}`
    : user?.email || "User";

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-subtle bg-background/95 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/app"><img src="/assets/upshot-theory-logo.png" alt="Upshot Theory" className="h-10 w-auto" /></Link>
            <nav className="hidden items-center gap-5 md:flex" aria-label="Primary navigation">
              <Link href="/app" className="text-xs text-muted-foreground transition-colors hover:text-foreground">Command Center</Link>
              <Link href="/app/connections" className="text-xs text-muted-foreground transition-colors hover:text-foreground">Business Systems</Link>
              <span className="text-xs font-semibold text-foreground">Settings</span>
            </nav>
          </div>
          <AppUserMenu />
        </div>
      </header>

      <main className="container py-8 lg:py-12">
        <Link href="/app" className="mb-6 inline-flex items-center gap-2 text-xs text-muted-foreground transition-colors hover:text-foreground">
          <ChevronLeft className="h-4 w-4" /> Back to Command Center
        </Link>

        <div className="mb-8">
          <p className="text-[10px] font-mono uppercase tracking-wider text-gold">Workspace Settings</p>
          <h1 className="mt-1 font-display text-3xl font-bold">Account and access</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">See who you are signed in as, which workspace you are managing, and what your role allows you to do.</p>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[240px_1fr]">
          <aside className="h-fit rounded-2xl border border-subtle bg-surface p-2">
            <SettingsLink href="/app/settings/profile" active={section === "profile"} icon={UserRound} label="Profile" description="Account and role" />
            <SettingsLink href="/app/settings/team" active={section === "team"} icon={UsersRound} label="Team & Access" description="Members and permissions" />
            <SettingsLink href="/app/settings/organization" active={section === "organization"} icon={Building2} label="Organization" description="Policies and controls" />
          </aside>

          <section className="rounded-2xl border border-subtle bg-surface p-6 lg:p-8">
            {section === "profile" && (
              <>
                <SectionHeader icon={UserRound} title="Your profile" description="Your identity and access in the current workspace." />
                <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <InfoCard label="Name" value={name} />
                  <InfoCard label="Email" value={user?.email || "Not available"} />
                  <InfoCard label="Organization" value={organization?.name || "No organization"} />
                  <InfoCard label="Workspace role" value={role} highlight />
                </div>
                <div className="mt-6 rounded-xl border border-subtle bg-background/35 p-5">
                  <div className="flex items-start gap-3">
                    <ShieldCheck className="mt-0.5 h-5 w-5 text-gold" />
                    <div>
                      <h2 className="text-sm font-semibold">{role} access</h2>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        {canManage
                          ? "You can manage Digital Specialists, business systems, members, and organization settings. Destructive actions still require confirmation."
                          : "You can use the workspace, but owner or admin approval is required for specialist lifecycle, member, and organization changes."}
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}

            {section === "team" && (
              <>
                <SectionHeader icon={UsersRound} title="Team & Access" description="Invite teammates, review workspace membership, and control pending access." />
                {organization?.id ? <TeamAccessPanel organizationId={organization.id} /> : <div className="mt-6 rounded-xl border border-subtle p-5 text-xs text-muted-foreground">No active organization is available.</div>}
              </>
            )}

            {section === "organization" && (
              <>
                <SectionHeader icon={Building2} title="Organization Settings" description="Workspace identity, approval defaults, operational policies, and security controls." />
                <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <InfoCard label="Organization" value={organization?.name || "No organization"} />
                  <InfoCard label="Your authority" value={canManage ? "Can manage settings" : "View only"} highlight={canManage} />
                </div>
                <div className="mt-6 rounded-xl border border-subtle bg-background/35 p-5">
                  <p className="text-sm font-semibold">Policy controls are being prepared</p>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">Approval defaults, security policies, billing, and workspace preferences will live here so administrative controls are never mixed into daily operations.</p>
                </div>
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

function SettingsLink({ href, active, icon: Icon, label, description }: { href: string; active: boolean; icon: typeof UserRound; label: string; description: string }) {
  return (
    <Link href={href} className={`flex items-start gap-3 rounded-xl p-3 transition-colors ${active ? "bg-gold/10 text-foreground" : "text-muted-foreground hover:bg-background/40 hover:text-foreground"}`}>
      <Icon className={`mt-0.5 h-4 w-4 ${active ? "text-gold" : ""}`} />
      <span><span className="block text-xs font-semibold">{label}</span><span className="mt-0.5 block text-[10px] opacity-75">{description}</span></span>
    </Link>
  );
}

function SectionHeader({ icon: Icon, title, description }: { icon: typeof UserRound; title: string; description: string }) {
  return <div className="flex items-start gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold/10 text-gold"><Icon className="h-5 w-5" /></div><div><h2 className="font-display text-xl font-semibold">{title}</h2><p className="mt-1 text-xs text-muted-foreground">{description}</p></div></div>;
}

function InfoCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return <div className="rounded-xl border border-subtle bg-background/35 p-4"><p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p><p className={`mt-2 break-words text-sm font-semibold ${highlight ? "text-gold" : ""}`}>{value}</p></div>;
}

function formatRole(role?: string | null): string {
  if (!role) return "Member";
  return role.replaceAll("_", " ").replace(/\b\w/g, character => character.toUpperCase());
}
