import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { Building2, ChevronDown, LogOut, ShieldCheck, UserRound, UsersRound } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export function AppUserMenu() {
  const { user, profile, organization, orgRole, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const name = profile?.first_name
    ? `${profile.first_name}${profile.last_name ? ` ${profile.last_name}` : ""}`
    : user?.email || "User";
  const role = formatRole(orgRole);
  const initials = `${profile?.first_name?.[0] || user?.email?.[0] || "U"}${profile?.last_name?.[0] || ""}`.toUpperCase();

  const handleSignOut = async () => {
    setSigningOut(true);
    await signOut();
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(value => !value)}
        className="flex items-center gap-3 rounded-xl border border-subtle bg-surface/70 px-2.5 py-2 text-left transition-colors hover:border-foreground/20 hover:bg-surface"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gold/15 text-xs font-bold text-gold">{initials}</span>
        <span className="hidden min-w-0 sm:block">
          <span className="block max-w-40 truncate text-xs font-semibold">{name}</span>
          <span className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <span className="max-w-28 truncate">{organization?.name || "No organization"}</span>
            <span>·</span>
            <span className="text-gold">{role}</span>
          </span>
        </span>
        <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div role="menu" className="absolute right-0 top-[calc(100%+0.6rem)] z-[80] w-72 overflow-hidden rounded-xl border border-subtle bg-background shadow-2xl">
          <div className="border-b border-subtle p-4">
            <p className="truncate text-sm font-semibold">{name}</p>
            <p className="mt-1 truncate text-xs text-muted-foreground">{user?.email || "Email unavailable"}</p>
            <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-subtle bg-surface p-3">
              <div className="min-w-0">
                <p className="truncate text-xs font-medium">{organization?.name || "No organization"}</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">Current workspace</p>
              </div>
              <span className="rounded-full bg-gold/10 px-2.5 py-1 text-[9px] font-mono font-semibold text-gold">{role}</span>
            </div>
          </div>

          <nav className="p-2" aria-label="Account navigation">
            <MenuLink href="/app/settings/profile" icon={UserRound} label="Profile" description="Your account and role" onSelect={() => setOpen(false)} />
            <MenuLink href="/app/settings/team" icon={UsersRound} label="Team & Access" description="Members and permissions" onSelect={() => setOpen(false)} />
            <MenuLink href="/app/settings/organization" icon={Building2} label="Organization Settings" description="Workspace policies and controls" onSelect={() => setOpen(false)} />
            <MenuLink href="/app/settings/profile" icon={ShieldCheck} label="Access Summary" description={`${role} permissions`} onSelect={() => setOpen(false)} />
          </nav>

          <div className="border-t border-subtle p-2">
            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-xs text-muted-foreground transition-colors hover:bg-surface hover:text-foreground disabled:opacity-60"
            >
              <LogOut className="h-4 w-4" />
              {signingOut ? "Signing out..." : "Sign out"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MenuLink({ href, icon: Icon, label, description, onSelect }: { href: string; icon: typeof UserRound; label: string; description: string; onSelect: () => void }) {
  return (
    <Link href={href} onClick={onSelect} className="flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-surface">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
      <span>
        <span className="block text-xs font-semibold">{label}</span>
        <span className="mt-0.5 block text-[10px] text-muted-foreground">{description}</span>
      </span>
    </Link>
  );
}

function formatRole(role?: string | null): string {
  if (!role) return "Member";
  return role.replaceAll("_", " ").replace(/\b\w/g, character => character.toUpperCase());
}
