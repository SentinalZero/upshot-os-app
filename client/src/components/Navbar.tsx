import { useState, useEffect } from "react";
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

  const navLinks = [
    { label: "Product", href: "#product" },
    { label: "Solutions", href: "#solutions" },
    { label: "Process", href: "#process" },
    { label: "Prototype", href: "#prototype" },
    { label: "ROI", href: "#roi" },
  ];

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-200 ${
        scrolled
          ? "bg-background/80 backdrop-blur-xl border-b border-subtle"
          : "bg-transparent"
      }`}
    >
      <div className="container flex items-center justify-between h-[76px]">
        {/* Logo */}
        <a href="#top" className="flex items-center gap-4">
          <img
            src="/manus-storage/upshot-theory-logo_f207295d.png"
            alt="Upshot Theory"
            className="h-12 w-auto"
          />
        </a>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-[13px] font-mono font-medium tracking-wide uppercase text-muted-foreground hover:text-foreground transition-colors duration-150"
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* CTA / Auth Buttons */}
        <div className="hidden md:flex items-center gap-3">
          {!loading && user ? (
            <Link
              href="/app"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm text-[#1a1000] transition-all duration-150 hover:shadow-[0_0_20px_oklch(0.65_0.14_75/30%)] active:scale-[0.97]"
              style={{ backgroundColor: "oklch(0.65 0.14 75)" }}
            >
              Open Command Center
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm text-muted-foreground hover:text-foreground border border-subtle hover:border-foreground/20 transition-all duration-150"
              >
                Sign In
              </Link>
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm text-[#1a1000] transition-all duration-150 hover:shadow-[0_0_20px_oklch(0.65_0.14_75/30%)] active:scale-[0.97]"
                style={{ backgroundColor: "oklch(0.65 0.14 75)" }}
              >
                Create Account
              </Link>
            </>
          )}
        </div>

        {/* Mobile menu button */}
        <button
          className="md:hidden flex flex-col gap-1.5 p-2"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          <span className={`block w-5 h-0.5 bg-foreground transition-transform duration-200 ${mobileOpen ? "rotate-45 translate-y-2" : ""}`} />
          <span className={`block w-5 h-0.5 bg-foreground transition-opacity duration-200 ${mobileOpen ? "opacity-0" : ""}`} />
          <span className={`block w-5 h-0.5 bg-foreground transition-transform duration-200 ${mobileOpen ? "-rotate-45 -translate-y-2" : ""}`} />
        </button>
      </div>

      {/* Mobile Nav */}
      {mobileOpen && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="md:hidden bg-background/95 backdrop-blur-xl border-b border-subtle px-6 pb-6"
        >
          <nav className="flex flex-col gap-4 pt-2">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="text-base font-medium text-muted-foreground hover:text-foreground"
              >
                {link.label}
              </a>
            ))}
            <div className="border-t border-subtle pt-4 mt-2 flex flex-col gap-3">
              {!loading && user ? (
                <Link
                  href="/app"
                  onClick={() => setMobileOpen(false)}
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg font-semibold text-sm text-[#1a1000]"
                  style={{ backgroundColor: "oklch(0.65 0.14 75)" }}
                >
                  Open Command Center
                </Link>
              ) : (
                <>
                  <Link
                    href="/login"
                    onClick={() => setMobileOpen(false)}
                    className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg font-medium text-sm text-foreground border border-subtle"
                  >
                    Sign In
                  </Link>
                  <Link
                    href="/signup"
                    onClick={() => setMobileOpen(false)}
                    className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg font-semibold text-sm text-[#1a1000]"
                    style={{ backgroundColor: "oklch(0.65 0.14 75)" }}
                  >
                    Create Account
                  </Link>
                </>
              )}
            </div>
          </nav>
        </motion.div>
      )}
    </header>
  );
}

