export function Footer() {
  return (
    <footer className="border-t border-subtle py-12 relative">
      {/* Grid overlay for command-system feel */}
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "linear-gradient(oklch(1 0 0 / 20%) 1px, transparent 1px), linear-gradient(90deg, oklch(1 0 0 / 20%) 1px, transparent 1px)", backgroundSize: "60px 60px" }} />
      <div className="container">
        <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <img
              src="/assets/upshot-theory-logo.png"
              alt="Upshot Theory"
              className="h-10 w-auto"
            />
            <div className="h-6 w-px bg-subtle" style={{ backgroundColor: "oklch(1 0 0 / 8%)" }} />
            <p className="text-xs font-mono text-muted-foreground tracking-wide uppercase">Deploy operational capacity</p>
          </div>

          <div className="flex items-center gap-6">
            <a
              href="#top"
              className="text-xs font-mono text-muted-foreground hover:text-foreground transition-colors duration-150"
            >
              Back to top ↑
            </a>
          </div>
        </div>

        <div className="relative mt-8 pt-6 border-t border-subtle flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Upshot Theory. All rights reserved.
          </p>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[oklch(0.75_0.18_155)] animate-pulse-dot" />
            <span className="text-xs text-muted-foreground font-mono">Systems operational</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
