import { motion, useInView } from "framer-motion";
import { useRef } from "react";

export function ProblemSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  const painPoints = [
    { team: "Customer teams", work: "Meeting notes, CRM updates, renewal reminders, reporting.", id: "CS-OPS" },
    { team: "Operations teams", work: "Document routing, scheduling, internal alerts, follow-ups.", id: "OPS-GEN" },
    { team: "Service teams", work: "Reminders, review requests, customer updates, staff coordination.", id: "SVC-OPS" },
    { team: "IT and SaaS teams", work: "Ticket classification, escalations, summaries, SLA tracking.", id: "IT-SUP" },
  ];

  return (
    <section className="py-28 lg:py-36 relative" ref={ref}>
      {/* Gold accent line */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-px" style={{ backgroundImage: "linear-gradient(to right, transparent, oklch(0.65 0.14 75), transparent)" }} />

      {/* Subtle grid overlay */}
      <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: "linear-gradient(oklch(1 0 0 / 30%) 1px, transparent 1px), linear-gradient(90deg, oklch(1 0 0 / 30%) 1px, transparent 1px)", backgroundSize: "80px 80px" }} />

      <div className="container relative">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="max-w-3xl mb-16"
        >
          <span className="text-[11px] font-mono font-semibold tracking-[0.25em] uppercase text-gold mb-4 block">
            // BOTTLENECK ANALYSIS
          </span>
          <h2 className="font-display text-3xl sm:text-4xl lg:text-[3.2rem] font-bold leading-[1.05] tracking-[-0.03em] mb-5">
            You don't have a people problem. You have a capacity problem.
          </h2>
          <p className="text-base text-muted-foreground leading-relaxed max-w-2xl">
            Every company has valuable people spending hours every week on work that has to get done, but does not require their expertise.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {painPoints.map((point, i) => (
            <motion.div
              key={point.team}
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.1 + i * 0.08, duration: 0.5, ease: "easeOut" }}
              className="group rounded-xl border border-subtle bg-card/50 p-5 hover:bg-card/80 hover:border-[oklch(0.65_0.14_75/25%)] transition-all duration-200 relative overflow-hidden"
            >
              {/* Telemetry ID */}
              <span className="absolute top-3 right-3 text-[10px] font-mono text-muted-foreground/40 tracking-wider">
                {point.id}
              </span>
              <div className="w-1.5 h-1.5 rounded-full bg-[oklch(0.72_0.15_75)] mb-4 animate-pulse-dot" />
              <h3 className="font-display font-bold text-sm mb-2 group-hover:text-gold transition-colors duration-200">
                {point.team}
              </h3>
              <p className="text-[13px] text-muted-foreground leading-relaxed">
                {point.work}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
