import { motion, useInView } from "framer-motion";
import { useRef, useState } from "react";

export function AssessmentSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const [result, setResult] = useState("");

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const hours = Number((form.elements.namedItem("hours") as HTMLInputElement).value || 0);
    const monthly = Math.round(hours * 4.33);
    const annual = Math.round(hours * 52);
    setResult(
      `Estimated opportunity: ${monthly.toLocaleString()} hours/month or ${annual.toLocaleString()} hours/year of repetitive work to review.`
    );
  };

  return (
    <section id="assessment" className="py-28 lg:py-36 relative" ref={ref}>
      {/* Gold accent line */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-px" style={{ backgroundImage: "linear-gradient(to right, transparent, oklch(0.65 0.14 75), transparent)" }} />

      <div className="container">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-start">
          {/* Left - Copy */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            <span className="text-[11px] font-mono font-semibold tracking-[0.25em] uppercase text-gold mb-4 block">
              // INITIATE ASSESSMENT
            </span>
            <h2 className="font-display text-3xl sm:text-4xl lg:text-[3.2rem] font-bold leading-[1.05] tracking-[-0.03em] mb-5">
              What could your business stop doing manually?
            </h2>
            <p className="text-base text-muted-foreground leading-relaxed mb-8">
              Take 2 minutes to estimate your team's operational capacity opportunity. We'll follow up with a personalized workflow assessment.
            </p>

            <div className="rounded-xl border border-subtle bg-card/50 p-5">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[oklch(0.75_0.18_155)]" />
                <p className="text-[11px] font-mono text-muted-foreground tracking-wider uppercase">Available</p>
              </div>
              <p className="font-semibold text-sm">Workflow Assessment</p>
              <p className="text-[13px] text-muted-foreground mt-1">15–30 minute operational capacity review</p>
            </div>
          </motion.div>

          {/* Right - Form */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.15, duration: 0.5, ease: "easeOut" }}
          >
            <form
              onSubmit={handleSubmit}
              className="rounded-2xl border border-subtle bg-card/80 backdrop-blur-xl p-6 space-y-4"
            >
              <div>
                <label className="block text-[11px] font-mono font-semibold text-muted-foreground mb-2 tracking-wider uppercase">
                  Business name
                </label>
                <input
                  type="text"
                  name="business"
                  placeholder="Acme Logistics"
                  required
                  className="w-full px-4 py-3 rounded-lg border border-subtle bg-background/50 text-foreground placeholder:text-muted-foreground/40 text-sm font-mono focus:outline-none focus:border-[oklch(0.65_0.14_75/50%)] transition-all"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono font-semibold text-muted-foreground mb-2 tracking-wider uppercase">
                  Workload type
                </label>
                <select
                  name="workload"
                  required
                  className="w-full px-4 py-3 rounded-lg border border-subtle bg-background/50 text-foreground text-sm focus:outline-none focus:border-[oklch(0.65_0.14_75/50%)] transition-all appearance-none"
                >
                  <option value="">Select one</option>
                  <option>Customer Success / Sales</option>
                  <option>Trucking / Field Operations</option>
                  <option>Salon / Service Business</option>
                  <option>IT / SaaS Support</option>
                  <option>Other</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-mono font-semibold text-muted-foreground mb-2 tracking-wider uppercase">
                  Hours spent weekly on repetitive work
                </label>
                <input
                  type="number"
                  name="hours"
                  min="1"
                  placeholder="40"
                  required
                  className="w-full px-4 py-3 rounded-lg border border-subtle bg-background/50 text-foreground placeholder:text-muted-foreground/40 text-sm font-mono focus:outline-none focus:border-[oklch(0.65_0.14_75/50%)] transition-all"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono font-semibold text-muted-foreground mb-2 tracking-wider uppercase">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  placeholder="you@company.com"
                  required
                  className="w-full px-4 py-3 rounded-lg border border-subtle bg-background/50 text-foreground placeholder:text-muted-foreground/40 text-sm font-mono focus:outline-none focus:border-[oklch(0.65_0.14_75/50%)] transition-all"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3.5 rounded-lg font-semibold text-sm text-[#1a1000] transition-all duration-150 hover:shadow-[0_0_20px_oklch(0.65_0.14_75/30%)] active:scale-[0.97] mt-2"
                style={{ backgroundColor: "oklch(0.65 0.14 75)" }}
              >
                Calculate Capacity Opportunity
              </button>

              {result && (
                <div className="pt-3 border-t border-subtle mt-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[oklch(0.75_0.18_155)]" />
                    <span className="text-[10px] font-mono text-muted-foreground tracking-wider">RESULT</span>
                  </div>
                  <p className="text-sm font-medium text-[oklch(0.75_0.18_155)]">
                    {result}
                  </p>
                </div>
              )}
            </form>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

