import { motion } from "framer-motion";
import { useEffect, useState } from "react";

function AnimatedCounter({ target, suffix = "" }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const duration = 2000;
    const steps = 60;
    const increment = target / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(Math.floor(current * 10) / 10);
      }
    }, duration / steps);
    return () => clearInterval(timer);
  }, [target]);

  return (
    <span className="font-mono font-bold text-xl lg:text-2xl text-foreground">
      {typeof target === "number" && target % 1 !== 0 ? count.toFixed(1) : Math.floor(count).toLocaleString()}
      {suffix}
    </span>
  );
}

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
    <section id="top" className="relative min-h-screen flex items-center pt-[76px]">
      {/* Background */}
      <div className="absolute inset-0 z-0">
        <img
          src="/manus-storage/hero-abstract_f9ac2a47.png"
          alt=""
          className="w-full h-full object-cover opacity-30"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/50 via-background/80 to-background" />
      </div>

      {/* Grid overlay */}
      <div className="absolute inset-0 z-[1] opacity-[0.025]" style={{ backgroundImage: "linear-gradient(oklch(1 0 0 / 25%) 1px, transparent 1px), linear-gradient(90deg, oklch(1 0 0 / 25%) 1px, transparent 1px)", backgroundSize: "80px 80px" }} />

      <div className="container relative z-10 py-20 lg:py-28">
        <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-12 lg:gap-16 items-center">
          {/* Left - Copy */}
          <div>
            <motion.div
              custom={0}
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              className="flex items-center gap-3 mb-6"
            >
              <img
                src="/manus-storage/upshot-os-logo-light_ff4f13c3.png"
                alt="Upshot OS"
                className="h-10 w-auto"
              />
              <span className="text-[11px] font-mono font-semibold tracking-[0.25em] uppercase text-gold">
                Operational AI Platform
              </span>
            </motion.div>

            <motion.h1
              custom={1}
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              className="font-display text-4xl sm:text-5xl lg:text-[4rem] font-bold leading-[0.95] tracking-[-0.03em] mb-6"
            >
              Your team runs operations.{" "}
              <span className="text-gold">We automate the rest.</span>
            </motion.h1>

            <motion.p
              custom={2}
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              className="text-base text-muted-foreground leading-relaxed max-w-xl mb-8"
            >
              Upshot Theory designs and deploys AI-powered operational workflows that give your team back capacity. Upshot OS becomes the command center for the automated workforce running behind the scenes.
            </motion.p>

            <motion.div
              custom={3}
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              className="flex flex-wrap gap-4 mb-10"
            >
              <a
                href="#assessment"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-lg font-semibold text-sm text-[#1a1000] transition-all duration-150 hover:shadow-[0_0_20px_oklch(0.65_0.14_75/30%)] active:scale-[0.97]"
                style={{ backgroundColor: "oklch(0.65 0.14 75)" }}
              >
                Request Workflow Assessment
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="ml-1">
                  <path d="M1 7h12M8 2l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </a>
              <a
                href="#product"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-lg font-semibold text-sm border border-subtle bg-white/[0.03] text-foreground hover:bg-white/[0.06] transition-all duration-150 active:scale-[0.97]"
              >
                See Upshot OS
              </a>
            </motion.div>

            <motion.div
              custom={4}
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              className="flex flex-wrap gap-2"
            >
              {["CRM updates", "Follow-ups", "Scheduling", "Reporting"].map((tag) => (
                <span
                  key={tag}
                  className="px-3 py-1.5 rounded text-[11px] font-mono font-medium border border-subtle bg-white/[0.02] text-muted-foreground tracking-wide"
                >
                  {tag}
                </span>
              ))}
            </motion.div>
          </div>

          {/* Right - Dashboard Card */}
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.4, duration: 0.7, ease: "easeOut" }}
            className="relative"
          >
            <div className="rounded-2xl border border-subtle bg-card/80 backdrop-blur-xl p-5 shadow-2xl">
              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b border-subtle mb-4">
                <div>
                  <p className="text-[10px] font-mono text-muted-foreground tracking-wider uppercase">Command Center</p>
                  <p className="font-display font-bold text-base mt-0.5">Automated Workforce Live</p>
                </div>
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-mono font-semibold bg-[oklch(0.75_0.18_155/12%)] text-[oklch(0.75_0.18_155)] border border-[oklch(0.75_0.18_155/25%)]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[oklch(0.75_0.18_155)] animate-pulse-dot" />
                  LIVE
                </span>
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                {[
                  { label: "Hours Reclaimed", value: 84.3, suffix: "", change: "↑ 27%" },
                  { label: "Tasks Executed", value: 2742, suffix: "", change: "↑ 31%" },
                  { label: "Success Rate", value: 98.6, suffix: "%", change: "↑ 2.1%" },
                ].map((metric) => (
                  <div
                    key={metric.label}
                    className="rounded-lg border border-subtle bg-white/[0.02] p-3"
                  >
                    <p className="text-[10px] font-mono text-muted-foreground mb-1 tracking-wide">{metric.label}</p>
                    <AnimatedCounter target={metric.value} suffix={metric.suffix} />
                    <p className="text-[10px] text-[oklch(0.75_0.18_155)] mt-1 font-mono">{metric.change}</p>
                  </div>
                ))}
              </div>

              {/* Roles */}
              <div className="space-y-2">
                {[
                  { name: "CS Operations Specialist", desc: "Updated CRM, tasks, and follow-ups", count: 186, status: "green" },
                  { name: "Dispatch Coordinator", desc: "Processed driver docs and alerts", count: 142, status: "green" },
                  { name: "Invoice Processing Specialist", desc: "Waiting for approval", count: 27, status: "amber" },
                  { name: "IT Support Coordinator", desc: "Needs escalation approval", count: 14, status: "red" },
                ].map((role) => (
                  <div
                    key={role.name}
                    className="flex items-center gap-3 p-2.5 rounded-lg border border-subtle bg-white/[0.02]"
                  >
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        role.status === "green"
                          ? "bg-[oklch(0.75_0.18_155)]"
                          : role.status === "amber"
                          ? "bg-[oklch(0.72_0.15_75)]"
                          : "bg-[oklch(0.62_0.22_25)]"
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold truncate">{role.name}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{role.desc}</p>
                    </div>
                    <span className="font-mono text-xs font-bold text-muted-foreground">{role.count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Subtle glow effect behind card */}
            <div className="absolute -inset-4 rounded-3xl bg-[oklch(0.65_0.14_75/5%)] blur-3xl -z-10" />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
