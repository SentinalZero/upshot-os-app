import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "wouter";

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, loading } = useAuth();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToSection = (href: string) => {
    const target = document.querySelector(href);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      window.history.replaceState(null, "", href);
    }
    setMobileOpen(false);
  };

  const navLinks = [
    { label: "Product", href: "#product" },
    { label: "Solutions", href: "#solutions" },
    { label: "Process", href: "#process" },
    { label: "Prototype", href: "#prototype" },
    { label: "ROI", href: "#roi" },
  ];

  return (
    <header className={`fixed inset-x-0 top-0 z-50 isolate overflow-hidden border-b border-subtle bg-background transition-shadow duration-200 ${scrolled ? "shadow-[0_8px_24px_rgba(0,0,0,0.28)]" : ""}`}>
      <div className="container flex h-[76px] items-center justify-between">
        <a href="#top" className="flex items-center gap-4">
          <img src="/assets/upshot-theory-logo.png" alt="Upshot Theory" className="h-12 w-auto" />
        </a>

        <nav className="hidden items-center gap-8 md:flex">
          {navLinks.map(link => (
            <a key={link.href} href={link.href} onClick={event => { event.preventDefault(); scrollToSection(link.href); }} className="text-[13px] font-mono font-medium uppercase tracking-wide text-muted-foreground transition-colors duration-150 hover:text-foreground">
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden min-w-[230px] items-center justify-end gap-3 md:flex">
          {loading ? (
            <div className="h-10 w-[190px] rounded-lg border border-subtle bg-white/[0.025]" aria-hidden="true" />
          ) : user ? (
            <Link href="/app" className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-[#1a1000] transition-all duration-150 hover:shadow-[0_0_20px_oklch(0.65_0.14_75/30%)] active:scale-[0.97]" style={{ backgroundColor: "oklch(0.65 0.14 75)" }}>
              Open Upshot OS
            </Link>
          ) : (
            <>
              <Link href="/login" className="inline-flex items-center gap-2 rounded-lg border border-subtle px-4 py-2.5 text-sm font-medium text-muted-foreground transition-all duration-150 hover:border-foreground/20 hover:text-foreground">Sign In</Link>
              <Link href="/signup" className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-[#1a1000] transition-all duration-150 hover:shadow-[0_0_20px_oklch(0.65_0.14_75/30%)] active:scale-[0.97]" style={{ backgroundColor: "oklch(0.65 0.14 75)" }}>Create Account</Link>
            </>
          )}
        </div>

        <button className="flex flex-col gap-1.5 p-2 md:hidden" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Toggle menu">
          <span className={`block h-0.5 w-5 bg-foreground transition-transform duration-200 ${mobileOpen ? "translate-y-2 rotate-45" : ""}`} />
          <span className={`block h-0.5 w-5 bg-foreground transition-opacity duration-200 ${mobileOpen ? "opacity-0" : ""}`} />
          <span className={`block h-0.5 w-5 bg-foreground transition-transform duration-200 ${mobileOpen ? "-translate-y-2 -rotate-45" : ""}`} />
        </button>
      </div>

      {mobileOpen && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="border-b border-subtle bg-background px-6 pb-6 md:hidden">
          <nav className="flex flex-col gap-4 pt-2">
            {navLinks.map(link => (
              <a key={link.href} href={link.href} onClick={event => { event.preventDefault(); scrollToSection(link.href); }} className="text-base font-medium text-muted-foreground hover:text-foreground">{link.label}</a>
            ))}
            <div className="mt-2 flex flex-col gap-3 border-t border-subtle pt-4">
              {loading ? (
                <div className="h-11 rounded-lg border border-subtle bg-white/[0.025]" aria-hidden="true" />
              ) : user ? (
                <Link href="/app" onClick={() => setMobileOpen(false)} className="inline-flex items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold text-[#1a1000]" style={{ backgroundColor: "oklch(0.65 0.14 75)" }}>Open Upshot OS</Link>
              ) : (
                <>
                  <Link href="/login" onClick={() => setMobileOpen(false)} className="inline-flex items-center justify-center gap-2 rounded-lg border border-subtle px-5 py-3 text-sm font-medium text-foreground">Sign In</Link>
                  <Link href="/signup" onClick={() => setMobileOpen(false)} className="inline-flex items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold text-[#1a1000]" style={{ backgroundColor: "oklch(0.65 0.14 75)" }}>Create Account</Link>
                </>
              )}
            </div>
          </nav>
        </motion.div>
      )}
    </header>
  );
}
