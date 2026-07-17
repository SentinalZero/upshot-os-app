import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Check } from "lucide-react";

export function ProductSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  const features = [
    "Automated role cards by department or workflow",
    "Human approval queues for sensitive actions",
    "Live activity feed showing work completed",
    "Capacity intelligence and ROI reporting",
  ];

  return (
    <section id="product" className="py-28 lg:py-36 relative" ref={ref}>
      {/* Subtle border top */}
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[oklch(1_0_0/6%)] to-transparent" />

      <div className="container">
        <div className="grid lg:grid-cols-[0.9fr_1.1fr] gap-12 lg:gap-20 items-center">
          {/* Left - Visual */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="relative order-2 lg:order-1"
          >
            <div className="rounded-2xl overflow-hidden border border-subtle relative">
              <img
                src="/manus-storage/dashboard-glow_42cde703.png"
                alt="Upshot OS Dashboard"
                className="w-full h-auto"
              />
              {/* Overlay telemetry */}
              <div className="absolute bottom-3 left-3 flex items-center gap-2 px-3 py-1.5 rounded-md bg-background/80 backdrop-blur-sm border border-subtle">
                <span className="w-1.5 h-1.5 rounded-full bg-[oklch(0.75_0.18_155)] animate-pulse-dot" />
                <span className="text-[10px] font-mono text-muted-foreground tracking-wider">UPSHOT OS v2.4</span>
              </div>
            </div>
            <div className="absolute -inset-6 rounded-3xl bg-[oklch(0.65_0.14_75/4%)] blur-3xl -z-10" />
          </motion.div>

          {/* Right - Copy */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.15, duration: 0.5, ease: "easeOut" }}
            className="order-1 lg:order-2"
          >
            <div className="flex items-center gap-3 mb-5">
              <img
                src="/manus-storage/upshot-os-logo-light_ff4f13c3.png"
                alt="Upshot OS"
                className="h-10 w-auto"
              />
              <span className="text-[11px] font-mono font-semibold tracking-[0.25em] uppercase text-gold">
                // FLAGSHIP PRODUCT
              </span>
            </div>

            <h2 className="font-display text-3xl sm:text-4xl lg:text-[3.2rem] font-bold leading-[1.05] tracking-[-0.03em] mb-5">
              What if capacity was software?
            </h2>

            <p className="text-base text-muted-foreground leading-relaxed mb-8 max-w-lg">
              Upshot OS is the operational command center where customers manage automated roles, review approvals, track workflow execution, and measure reclaimed capacity.
            </p>

            <ul className="space-y-3">
              {features.map((feature, i) => (
                <motion.li
                  key={feature}
                  initial={{ opacity: 0, x: -10 }}
                  animate={isInView ? { opacity: 1, x: 0 } : {}}
                  transition={{ delay: 0.3 + i * 0.08, duration: 0.4, ease: "easeOut" }}
                  className="flex items-start gap-3"
                >
                  <span className="mt-0.5 w-5 h-5 rounded flex items-center justify-center shrink-0 border border-[oklch(0.75_0.18_155/30%)] bg-[oklch(0.75_0.18_155/8%)]">
                    <Check className="w-3 h-3 text-[oklch(0.75_0.18_155)]" />
                  </span>
                  <span className="text-[13px] text-muted-foreground">{feature}</span>
                </motion.li>
              ))}
            </ul>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
