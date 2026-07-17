import { motion, useInView } from "framer-motion";
import { useRef } from "react";

export function ProcessSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  const steps = [
    {
      num: "01",
      title: "Discover",
      desc: "Identify bottlenecks, repetitive tasks, handoffs, and manual work draining the team.",
    },
    {
      num: "02",
      title: "Design",
      desc: "Map the workflow and decide where AI, automation, and approvals belong.",
    },
    {
      num: "03",
      title: "Deploy",
      desc: "Connect the systems, build the automation, and launch the operational role.",
    },
    {
      num: "04",
      title: "Optimize",
      desc: "Measure hours reclaimed, improve reliability, and expand the automated workforce.",
    },
  ];

  return (
    <section id="process" className="py-28 lg:py-36 relative" ref={ref}>
      {/* Subtle border top */}
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[oklch(1_0_0/6%)] to-transparent" />

      <div className="container relative">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="max-w-2xl mb-16"
        >
          <span className="text-[11px] font-mono font-semibold tracking-[0.25em] uppercase text-gold mb-4 block">
            // DEPLOYMENT SEQUENCE
          </span>
          <h2 className="font-display text-3xl sm:text-4xl lg:text-[3.2rem] font-bold leading-[1.05] tracking-[-0.03em]">
            From repetitive work to deployed capacity.
          </h2>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {steps.map((step, i) => (
            <motion.div
              key={step.num}
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.1 + i * 0.1, duration: 0.5, ease: "easeOut" }}
              className="relative"
            >
              <div className="rounded-2xl border border-subtle bg-card/50 p-6 h-full hover:border-[oklch(0.65_0.14_75/20%)] transition-all duration-200">
                <div className="flex items-center gap-3 mb-4">
                  <span className="font-mono text-xs font-bold text-gold">{step.num}</span>
                  {/* Progress indicator */}
                  <div className="flex-1 h-px bg-gradient-to-r from-[oklch(0.65_0.14_75/30%)] to-transparent" />
                </div>
                <h3 className="font-display font-bold text-lg mb-3">{step.title}</h3>
                <p className="text-[13px] text-muted-foreground leading-relaxed">{step.desc}</p>
              </div>
              {/* Connector line between steps */}
              {i < steps.length - 1 && (
                <div className="hidden lg:block absolute top-1/2 -right-2.5 w-5 h-px bg-[oklch(0.65_0.14_75/25%)]" />
              )}
            </motion.div>
          ))}
        </div>

        {/* Workflow visual */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.5, duration: 0.6, ease: "easeOut" }}
          className="mt-16 rounded-2xl overflow-hidden border border-subtle relative"
        >
          <img
            src="/assets/workflow-abstract.jpg"
            alt="Automated workflow visualization"
            className="w-full h-auto opacity-70"
          />
          {/* Overlay telemetry label */}
          <div className="absolute bottom-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-md bg-background/80 backdrop-blur-sm border border-subtle">
            <span className="w-1.5 h-1.5 rounded-full bg-[oklch(0.75_0.18_155)] animate-pulse-dot" />
            <span className="text-[10px] font-mono text-muted-foreground tracking-wider">WORKFLOW ROUTING ACTIVE</span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
