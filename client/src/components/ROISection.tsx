import { motion, useInView } from "framer-motion";
import { useRef } from "react";

export function ROISection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section id="roi" className="py-28 lg:py-36 relative" ref={ref}>
      {/* Subtle border top */}
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[oklch(1_0_0/6%)] to-transparent" />

      {/* Subtle grid overlay */}
      <div className="absolute inset-0 opacity-[0.015]" style={{ backgroundImage: "linear-gradient(oklch(1 0 0 / 30%) 1px, transparent 1px), linear-gradient(90deg, oklch(1 0 0 / 30%) 1px, transparent 1px)", backgroundSize: "60px 60px" }} />

      <div className="container relative">
        <div className="grid lg:grid-cols-[1.2fr_0.8fr] gap-12 items-center">
          {/* Left */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            <span className="text-[11px] font-mono font-semibold tracking-[0.25em] uppercase text-gold mb-4 block">
              // CAPACITY TELEMETRY
            </span>
            <h2 className="font-display text-3xl sm:text-4xl lg:text-[3.2rem] font-bold leading-[1.05] tracking-[-0.03em] mb-5">
              Give your business capacity without adding headcount.
            </h2>
            <p className="text-base text-muted-foreground leading-relaxed max-w-xl">
              If 10 employees each spend 8 hours a week on repetitive operational work, that is 3,840 hours per year of capacity that can be redesigned.
            </p>
          </motion.div>

          {/* Right - ROI Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={isInView ? { opacity: 1, scale: 1 } : {}}
            transition={{ delay: 0.2, duration: 0.6, ease: "easeOut" }}
            className="relative"
          >
            <div className="rounded-2xl border border-subtle bg-card/80 backdrop-blur-xl p-8">
              {/* Telemetry header */}
              <div className="flex items-center justify-between mb-4">
                <p className="text-[11px] font-mono text-muted-foreground tracking-wider uppercase">Annual capacity opportunity</p>
                <span className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground/60">
                  <span className="w-1.5 h-1.5 rounded-full bg-[oklch(0.75_0.18_155)] animate-pulse-dot" />
                  CALCULATED
                </span>
              </div>
              <p className="font-mono text-5xl lg:text-6xl font-bold text-gold mb-4">
                3,840
                <span className="text-xl text-muted-foreground ml-2">hrs/yr</span>
              </p>
              <div className="h-px w-full bg-gradient-to-r from-[oklch(0.65_0.14_75/30%)] to-transparent mb-4" />
              <p className="text-[13px] text-muted-foreground leading-relaxed">
                Before you hire another person, find the work your current team should not be doing manually.
              </p>
            </div>
            <div className="absolute -inset-4 rounded-3xl bg-[oklch(0.65_0.14_75/4%)] blur-3xl -z-10" />
          </motion.div>
        </div>
      </div>
    </section>
  );
}

