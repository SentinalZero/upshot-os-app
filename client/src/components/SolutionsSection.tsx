import { motion, useInView } from "framer-motion";
import { useRef } from "react";

export function SolutionsSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  const solutions = [
    {
      num: "01",
      title: "Customer Success Ops",
      desc: "CRM updates, meeting summaries, follow-ups, health reports, renewal tasks, and internal handoffs.",
      status: "DEPLOYED",
    },
    {
      num: "02",
      title: "Trucking Operations",
      desc: "Driver documents, delivery notifications, maintenance reminders, invoice workflows, and dispatch updates.",
      status: "DEPLOYED",
    },
    {
      num: "03",
      title: "Salon & Service Ops",
      desc: "Appointment reminders, lead follow-up, review requests, staff communication, and reporting.",
      status: "ACTIVE",
    },
    {
      num: "04",
      title: "IT & SaaS Support",
      desc: "Ticket classification, SLA monitoring, escalation routing, documentation, and customer updates.",
      status: "ACTIVE",
    },
  ];

  return (
    <section id="solutions" className="py-28 lg:py-36 relative" ref={ref}>
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
            // ROLE CONFIGURATIONS
          </span>
          <h2 className="font-display text-3xl sm:text-4xl lg:text-[3.2rem] font-bold leading-[1.05] tracking-[-0.03em]">
            Automated roles built around real workloads.
          </h2>
        </motion.div>

        <div className="grid sm:grid-cols-2 gap-4">
          {solutions.map((sol, i) => (
            <motion.article
              key={sol.num}
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.1 + i * 0.08, duration: 0.5, ease: "easeOut" }}
              className="group rounded-2xl border border-subtle bg-card/50 p-6 hover:bg-card/80 hover:border-[oklch(0.65_0.14_75/20%)] transition-all duration-200 relative"
            >
              <div className="flex items-center justify-between mb-4">
                <span className="font-mono text-xs font-bold text-gold">{sol.num}</span>
                <span className="flex items-center gap-1.5 text-[10px] font-mono tracking-wider text-muted-foreground/60">
                  <span className="w-1.5 h-1.5 rounded-full bg-[oklch(0.75_0.18_155)]" />
                  {sol.status}
                </span>
              </div>
              <h3 className="font-display font-bold text-lg mb-3">{sol.title}</h3>
              <p className="text-[13px] text-muted-foreground leading-relaxed">{sol.desc}</p>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
