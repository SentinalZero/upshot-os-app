import type { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Menu, Plus, X } from "lucide-react";
import { useState } from "react";
import { AppUserMenu } from "@/components/AppUserMenu";

interface AppShellProps {
  children: ReactNode;
}

const navItems = [
  { href: "/app", label: "Today" },
  { href: "/app/workforce", label: "Workforce" },
  { href: "/app/connections", label: "Systems" },
];

export function AppShell({ children }: AppShellProps) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (href: string) => href === "/app" ? location === "/app" : location.startsWith(href);

  return (
    <div className="app-shell min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-subtle bg-background/90 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-5 lg:gap-8">
            <Link href="/app" aria-label="Upshot Today" className="shrink-0">
              <img src="/assets/upshot-theory-logo.png" alt="Upshot Theory" className="h-8 w-auto sm:h-9" />
            </Link>

            <nav className="hidden items-center gap-7 md:flex" aria-label="Application navigation">
              {navItems.map(item => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative py-5 text-xs font-semibold transition-colors ${isActive(item.href) ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {item.label}
                  {isActive(item.href) && <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-gold" />}
                </Link>
              ))}
            </nav>
          </div>

          <div className="hidden items-center gap-3 md:flex">
            <Link href="/app/deploy" className="inline-flex items-center gap-2 rounded-xl bg-gold px-4 py-2.5 text-xs font-semibold text-[#1a1000] transition-transform active:scale-[0.98]">
              <Plus className="h-4 w-4" /> Hire Specialist
            </Link>
            <AppUserMenu />
          </div>

          <button type="button" onClick={() => setMobileOpen(value => !value)} className="grid h-10 w-10 place-items-center rounded-xl border border-subtle bg-surface/60 md:hidden" aria-label="Toggle application navigation" aria-expanded={mobileOpen}>
            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>

        {mobileOpen && (
          <div className="border-t border-subtle bg-background md:hidden">
            <div className="container space-y-2 py-4">
              {navItems.map(item => (
                <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)} className={`block rounded-xl px-4 py-3 text-sm font-semibold ${isActive(item.href) ? "bg-gold/10 text-gold" : "text-muted-foreground"}`}>
                  {item.label}
                </Link>
              ))}
              <Link href="/app/deploy" onClick={() => setMobileOpen(false)} className="flex items-center justify-center gap-2 rounded-xl bg-gold px-4 py-3 text-sm font-semibold text-[#1a1000]">
                <Plus className="h-4 w-4" /> Hire Specialist
              </Link>
              <div className="pt-2"><AppUserMenu /></div>
            </div>
          </div>
        )}
      </header>

      <style>{`
        .app-shell-content > div > header:first-child,
        .app-shell-content > .app-dashboard-shell > div > header:first-child {
          display: none !important;
        }
      `}</style>
      <div className="app-shell-content">{children}</div>
    </div>
  );
}
