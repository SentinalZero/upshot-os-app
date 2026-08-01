import { motion } from "framer-motion";

export function HeroSection() {
  const fadeUp: any = {
    hidden: { opacity: 0, y: 20 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: { delay: i * 0.08, duration: 0.5, ease: "easeOut" },
    }),
  };

  return (
    <section id="top" className="relative flex min-h-screen items-center pt-[76px]">
      <div className="absolute inset-0 z-0 overflow-hidden bg-background">
        <div className="absolute -left-28 -top-44 h-[560px] w-[560px] rounded-full bg-[oklch(0.65_0.14_75/8%)] blur-[130px]" />
        <div className="absolute right-[2%] top-[18%] h-[460px] w-[460px] rounded-full bg-[oklch(0.55_0.08_230/4%)] blur-[140px]" />
        <div className="absolute bottom-[-20%] left-[35%] h-[520px] w-[520px] rounded-full bg-[oklch(0.65_0.14_75/4%)] blur-[150px]" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/95 to-background" />
      </div>
      <div className="absolute inset-0 z-[1] opacity-[0.025]" style={{ backgroundImage: "linear-gradient(oklch(1 0 0 / 25%) 1px, transparent 1px), linear-gradient(90deg, oklch(1 0 0 / 25%) 1px, transparent 1px)", backgroundSize: "80px 80px" }} />

      <div className="container relative z-10 py-20 lg:py-28">
        <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
          <div>
            <motion.div custom={0} initial="hidden" animate="visible" variants={fadeUp} className="mb-6 flex items-center gap-3">
              <img src="/assets/upshot-os-logo.png" alt="Upshot OS" className="h-10 w-auto" />
              <span className="text-[11px] font-mono font-semibold uppercase tracking-[0.25em] text-gold">Operational AI Platform</span>
            </motion.div>

            <motion.h1 custom={1} initial="hidden" animate="visible" variants={fadeUp} className="mb-6 font-display text-4xl font-bold leading-[0.95] tracking-[-0.03em] sm:text-5xl lg:text-[4rem]">
              Your team runs operations. <span className="text-gold">We automate the rest.</span>
            </motion.h1>

            <motion.p custom={2} initial="hidden" animate="visible" variants={fadeUp} className="mb-8 max-w-xl text-base leading-relaxed text-muted-foreground">
              Upshot Theory designs and deploys AI-powered operational workflows that give your team back capacity. Upshot OS is the workspace for onboarding, guiding, and measuring your Digital Workforce.
            </motion.p>

            <motion.div custom={3} initial="hidden" animate="visible" variants={fadeUp} className="mb-10 flex flex-wrap gap-4">
              <a href="#assessment" className="inline-flex items-center gap-2 rounded-lg px-6 py-3.5 text-sm font-semibold text-[#1a1000] transition-all duration-150 hover:shadow-[0_0_20px_oklch(0.65_0.14_75/30%)] active:scale-[0.97]" style={{ backgroundColor: "oklch(0.65 0.14 75)" }}>
                Request Workflow Assessment
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="ml-1"><path d="M1 7h12M8 2l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </a>
              <a href="#product" className="inline-flex items-center gap-2 rounded-lg border border-subtle bg-white/[0.03] px-6 py-3.5 text-sm font-semibold text-foreground transition-all duration-150 hover:bg-white/[0.06] active:scale-[0.97]">See Upshot OS</a>
            </motion.div>

            <motion.div custom={4} initial="hidden" animate="visible" variants={fadeUp} className="flex flex-wrap gap-2">
              {["CRM updates", "Follow-ups", "Scheduling", "Reporting"].map(tag => <span key={tag} className="rounded border border-subtle bg-white/[0.02] px-3 py-1.5 text-[11px] font-mono font-medium tracking-wide text-muted-foreground">{tag}</span>)}
            </motion.div>
          </div>

          <motion.div initial={{ opacity: 0, y: 30, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: 0.4, duration: 0.7, ease: "easeOut" }} className="relative">
            <div className="rounded-2xl border border-subtle bg-card/80 p-5 shadow-2xl backdrop-blur-xl">
              <div className="mb-4 flex items-center justify-between border-b border-subtle pb-4">
                <div>
                  <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Upshot OS</p>
                  <p className="mt-0.5 font-display text-base font-bold">Example workforce activity</p>
                </div>
                <span className="flex items-center gap-1.5 rounded border border-[oklch(0.75_0.18_155/25%)] bg-[oklch(0.75_0.18_155/12%)] px-2.5 py-1 text-[10px] font-mono font-semibold text-[oklch(0.75_0.18_155)]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[oklch(0.75_0.18_155)]" /> SAMPLE
                </span>
              </div>

              <div className="mb-4 grid grid-cols-3 gap-2">
                {[
                  { label: "Time Returned", value: "18.5 hrs" },
                  { label: "Work Completed", value: "76" },
                  { label: "Needs Review", value: "1" },
                ].map(metric => (
                  <div key={metric.label} className="rounded-lg border border-subtle bg-white/[0.02] p-3">
                    <p className="mb-1 text-[10px] font-mono tracking-wide text-muted-foreground">{metric.label}</p>
                    <span className="font-mono text-xl font-bold text-foreground lg:text-2xl">{metric.value}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                {[
                  { name: "Emma", desc: "CS Operations Specialist", detail: "Follow-up prepared for approval", status: "amber" },
                  { name: "Dispatch Coordinator", desc: "Operations Specialist", detail: "Driver updates completed", status: "green" },
                  { name: "Invoice Specialist", desc: "Finance Operations", detail: "Invoices reconciled", status: "green" },
                ].map(role => (
                  <div key={role.name} className="flex items-center gap-3 rounded-lg border border-subtle bg-white/[0.02] p-2.5">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${role.status === "green" ? "bg-[oklch(0.75_0.18_155)]" : "bg-[oklch(0.72_0.15_75)]"}`} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold">{role.name}</p>
                      <p className="truncate text-[11px] text-muted-foreground">{role.desc} · {role.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="absolute -inset-4 -z-10 rounded-3xl bg-[oklch(0.65_0.14_75/5%)] blur-3xl" />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
