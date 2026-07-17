import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { usePrototype } from "./usePrototype";
import { prototypeData, IndustryKey } from "./prototypeData";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Check, Play, Pause, Rocket, Shield, Zap, Activity } from "lucide-react";

export function PrototypeSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });
  const { state, computed, actions } = usePrototype();
  const previewRef = useRef<HTMLDivElement>(null);

  const industryKeys = Object.keys(prototypeData.industries) as IndustryKey[];
  const industryData = prototypeData.industries[state.industry];
  const scenario = prototypeData.scenarios[state.industry];

  const flowSteps = [
    { label: "Configure", done: true },
    { label: "Define Work", done: computed.taskCount > 0 },
    { label: "Connect", done: computed.appCount > 0 },
    { label: "Oversight", done: computed.oversightCount > 0 },
    { label: "Deploy", done: state.deploying || state.deployed },
    { label: "Command Center", done: state.deployed },
  ];

  const handleDeploy = () => {
    if (!state.tasks.length || !state.apps.length || !state.oversight.length) return;
    actions.deploy();
    previewRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <section id="prototype" className="py-28 lg:py-36 relative" ref={ref}>
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[oklch(0.65_0.14_75/20%)] to-transparent" />

      <div className="container">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="mb-12"
        >
          <span className="text-[11px] font-mono font-semibold tracking-[0.25em] uppercase text-gold mb-3 block">
            // INTERACTIVE PROTOTYPE
          </span>
          <h2 className="font-display text-3xl sm:text-4xl lg:text-[3.2rem] font-bold leading-[1.05] tracking-[-0.03em] mb-4 max-w-2xl">
            Build your AI operational role.
          </h2>
          <p className="text-base text-muted-foreground max-w-xl leading-relaxed">
            Walk through the product experience: choose the business context, select the repetitive work, connect systems, deploy the role, and watch Upshot OS generate a live command-center preview.
          </p>
        </motion.div>

        {/* Flow Steps */}
        <div className="flex items-center gap-1 mb-10 overflow-x-auto pb-2">
          {flowSteps.map((step, i) => (
            <div key={step.label} className="flex items-center gap-1">
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-mono tracking-wider whitespace-nowrap transition-all duration-200 ${step.done ? "bg-[oklch(0.65_0.14_75/12%)] text-gold border border-[oklch(0.65_0.14_75/25%)]" : "bg-surface border border-subtle text-muted-foreground"}`}>
                <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${step.done ? "bg-gold text-background" : "bg-muted text-muted-foreground"}`}>
                  {step.done ? "✓" : i + 1}
                </span>
                {step.label}
              </div>
              {i < flowSteps.length - 1 && (
                <div className={`w-4 h-px ${step.done ? "bg-gold/40" : "bg-border"}`} />
              )}
            </div>
          ))}
        </div>

        {/* Scenario Selector */}
        <div className="mb-10 p-5 rounded-xl border border-subtle bg-surface/50">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-4">
            <div className="flex-1">
              <span className="text-[10px] font-mono text-muted-foreground tracking-wider uppercase">Demo-ready scenario</span>
              <h3 className="font-display text-lg font-semibold mt-1">{scenario.title}</h3>
              <p className="text-sm text-muted-foreground mt-1">{scenario.copy}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {industryKeys.map(key => (
              <button
                key={key}
                onClick={() => actions.applyScenario(key)}
                className={`px-4 py-2 rounded-lg text-xs font-medium transition-all duration-200 ${state.industry === key ? "bg-gold text-background" : "bg-background border border-subtle text-muted-foreground hover:border-gold/40 hover:text-foreground"}`}
              >
                {key}
              </button>
            ))}
          </div>
        </div>

        {/* Main Builder + Preview Grid */}
        <div className="grid lg:grid-cols-[1fr_1fr] gap-6 items-start">
          {/* Left: Builder Steps */}
          <div className="space-y-6">
            {/* Step 1: Industry & Role */}
            <BuilderCard title="Step 1 · Configure Role" subtitle="Choose the business context">
              <div className="mb-4">
                <span className="text-[10px] font-mono text-muted-foreground tracking-wider uppercase mb-2 block">Industry</span>
                <div className="grid grid-cols-2 gap-2">
                  {industryKeys.map(key => (
                    <button
                      key={key}
                      onClick={() => actions.setIndustry(key)}
                      className={`p-3 rounded-lg border text-left transition-all duration-200 ${state.industry === key ? "border-gold/50 bg-[oklch(0.65_0.14_75/8%)]" : "border-subtle bg-background hover:border-gold/30"}`}
                    >
                      <span className="text-xs font-semibold block">{key}</span>
                      <span className="text-[10px] text-muted-foreground">{prototypeData.industries[key].tone.slice(0, 40)}...</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <span className="text-[10px] font-mono text-muted-foreground tracking-wider uppercase mb-2 block">Automated Role</span>
                <div className="grid grid-cols-1 gap-2">
                  {prototypeData.roles.map(role => (
                    <button
                      key={role.name}
                      onClick={() => actions.setRole(role)}
                      className={`p-3 rounded-lg border text-left transition-all duration-200 ${state.role.name === role.name ? "border-gold/50 bg-[oklch(0.65_0.14_75/8%)]" : "border-subtle bg-background hover:border-gold/30"}`}
                    >
                      <span className="text-xs font-semibold">{role.name}</span>
                      <span className="text-[10px] text-muted-foreground ml-2">
                        {role.bestFit === state.industry ? "Recommended" : `Adapted from ${role.bestFit}`}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </BuilderCard>

            {/* Step 2: Tasks */}
            <BuilderCard title="Step 2 · Define Work" subtitle="Select repetitive tasks to automate">
              <div className="flex flex-wrap gap-2">
                {state.role.tasks.map(task => (
                  <button
                    key={task}
                    onClick={() => actions.toggleTask(task)}
                    className={`px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 border ${state.tasks.includes(task) ? "border-[oklch(0.75_0.18_155/50%)] bg-[oklch(0.75_0.18_155/10%)] text-[oklch(0.75_0.18_155)]" : "border-subtle bg-background text-muted-foreground hover:border-foreground/20"}`}
                  >
                    {state.tasks.includes(task) && <Check className="w-3 h-3 inline mr-1" />}
                    {task}
                  </button>
                ))}
              </div>
            </BuilderCard>

            {/* Step 3: Systems */}
            <BuilderCard title="Step 3 · Connect Systems" subtitle="Connect business systems (simulated)">
              <div className="grid grid-cols-2 gap-2">
                {industryData.systems.map(app => {
                  const suggested = (state.role.defaultApps as readonly string[]).includes(app);
                  return (
                    <button
                      key={app}
                      onClick={() => actions.toggleApp(app)}
                      className={`p-2.5 rounded-lg border text-left transition-all duration-200 ${state.apps.includes(app) ? "border-[oklch(0.75_0.18_155/50%)] bg-[oklch(0.75_0.18_155/8%)]" : "border-subtle bg-background hover:border-foreground/20"}`}
                    >
                      <span className="text-xs font-medium block">{app}</span>
                      <span className="text-[10px] text-muted-foreground">{suggested ? "Suggested" : "Optional"}</span>
                    </button>
                  );
                })}
              </div>
            </BuilderCard>

            {/* Step 4: Oversight */}
            <BuilderCard title="Step 4 · Human Oversight" subtitle="Decide what needs approval">
              <div className="space-y-2">
                {industryData.approvalTemplates.map(rule => (
                  <button
                    key={rule}
                    onClick={() => actions.toggleOversight(rule)}
                    className={`w-full p-3 rounded-lg border text-left flex items-center gap-3 transition-all duration-200 ${state.oversight.includes(rule) ? "border-[oklch(0.85_0.15_75/50%)] bg-[oklch(0.85_0.15_75/8%)]" : "border-subtle bg-background hover:border-foreground/20"}`}
                  >
                    <Shield className={`w-4 h-4 shrink-0 ${state.oversight.includes(rule) ? "text-gold" : "text-muted-foreground"}`} />
                    <div>
                      <span className="text-xs font-medium block">{rule}</span>
                      <span className="text-[10px] text-muted-foreground">Pause for human review</span>
                    </div>
                  </button>
                ))}
              </div>
            </BuilderCard>

            {/* Deploy Button */}
            <div className="p-5 rounded-xl border border-gold/20 bg-[oklch(0.65_0.14_75/5%)]">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <span className="text-[10px] font-mono text-gold tracking-wider uppercase">Step 5 · Deploy</span>
                  <h3 className="font-display text-lg font-semibold mt-1">Deploy your role</h3>
                </div>
                <Rocket className="w-5 h-5 text-gold" />
              </div>
              <p className="text-xs text-muted-foreground mb-4">
                {state.deploying ? "Provisioning role, mapping systems, and loading oversight rules..." : "Generate a live Upshot OS dashboard preview based on your selections."}
              </p>
              <button
                onClick={handleDeploy}
                disabled={!state.tasks.length || !state.apps.length || !state.oversight.length || state.deploying}
                className="w-full py-3 rounded-lg font-semibold text-sm bg-gold text-background hover:bg-gold/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 active:scale-[0.97]"
              >
                {state.deploying ? "Deploying..." : "Deploy Preview"}
              </button>
              {(!state.tasks.length || !state.apps.length || !state.oversight.length) && (
                <p className="text-[10px] text-muted-foreground mt-2 text-center">Select at least one task, system, and oversight rule</p>
              )}
            </div>
          </div>

          {/* Right: Command Center Preview */}
          <div ref={previewRef} className="lg:sticky lg:top-24">
            <div className="rounded-2xl border border-subtle bg-surface overflow-hidden">
              {/* Preview Header */}
              <div className="p-4 border-b border-subtle flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-mono text-muted-foreground tracking-wider uppercase">Upshot OS Command Center</p>
                  <strong className="text-sm font-display">{state.role.name}</strong>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-semibold flex items-center gap-1.5 ${state.deployed ? "bg-[oklch(0.75_0.18_155/15%)] text-[oklch(0.75_0.18_155)]" : state.deploying ? "bg-[oklch(0.85_0.15_75/15%)] text-gold animate-pulse" : "bg-muted text-muted-foreground"}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${state.deployed ? "bg-[oklch(0.75_0.18_155)]" : state.deploying ? "bg-gold" : "bg-muted-foreground"}`} />
                  {state.deployed ? "Live" : state.deploying ? "Deploying" : "Ready"}
                </span>
              </div>

              {/* Metrics Row */}
              <div className="grid grid-cols-3 border-b border-subtle">
                <MetricCell label="Tasks Automated" value={computed.taskCount.toString()} />
                <MetricCell label="Systems Connected" value={computed.appCount.toString()} />
                <MetricCell label="Hours Saved / Mo" value={computed.monthlyHours.toString()} />
              </div>

              {/* Impact Strip */}
              <div className="grid grid-cols-3 border-b border-subtle bg-background/50">
                <MetricCell label="Annual Value" value={`$${computed.annualValue.toLocaleString()}`} accent />
                <MetricCell label="Risk Control" value={computed.oversightCount ? `${computed.oversightCount} gates` : "Not set"} />
                <MetricCell label="Pilot Target" value={computed.pilotTarget} />
              </div>

              {/* Deployment Sequence */}
              <div className="p-4 border-b border-subtle">
                <div className={`p-3 rounded-lg border ${state.deployed ? "border-[oklch(0.75_0.18_155/30%)] bg-[oklch(0.75_0.18_155/5%)]" : "border-subtle bg-background"}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`w-2 h-2 rounded-full ${state.deployed ? "bg-[oklch(0.75_0.18_155)]" : state.deploying ? "bg-gold animate-pulse" : "bg-muted-foreground"}`} />
                    <strong className="text-xs">
                      {state.deployed ? `${state.role.name} deployed` : state.deploying ? `${state.role.name} deploying` : computed.taskCount ? `${state.role.name} configured` : "AI role ready to configure"}
                    </strong>
                  </div>
                  <p className="text-[11px] text-muted-foreground pl-4">
                    {computed.taskCount
                      ? `Built for ${state.industry}: automating ${computed.taskCount} workflows across ${computed.appCount || "selected"} systems with ${computed.oversightCount} human-review rules.`
                      : "Select repetitive tasks to generate the dashboard preview."}
                  </p>
                </div>
              </div>

              {/* Tabs */}
              <Tabs defaultValue="activity" className="w-full">
                <TabsList className="w-full rounded-none border-b border-subtle bg-transparent h-auto p-0">
                  <TabsTrigger value="activity" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-gold data-[state=active]:bg-transparent text-xs py-2.5">
                    <Activity className="w-3 h-3 mr-1" /> Activity
                  </TabsTrigger>
                  <TabsTrigger value="approvals" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-gold data-[state=active]:bg-transparent text-xs py-2.5">
                    <Shield className="w-3 h-3 mr-1" /> Approvals
                  </TabsTrigger>
                  <TabsTrigger value="roi" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-gold data-[state=active]:bg-transparent text-xs py-2.5">
                    <Zap className="w-3 h-3 mr-1" /> ROI
                  </TabsTrigger>
                </TabsList>

                {/* Activity Tab */}
                <TabsContent value="activity" className="p-4 mt-0">
                  {/* Simulation Control */}
                  <div className="flex items-center justify-between mb-3 p-3 rounded-lg border border-subtle bg-background">
                    <div>
                      <strong className="text-xs block">
                        {state.simulationRunning ? `${state.role.name} is actively working.` : state.deployed ? "Role deployed. Start the live workstream." : "Deploy the role to start the workstream."}
                      </strong>
                      <span className="text-[10px] text-muted-foreground">
                        {state.simulationRunning ? "Work is moving across systems while approval-sensitive items pause." : "The Command Center will show completed work, approvals, and impact."}
                      </span>
                    </div>
                    <button
                      onClick={actions.toggleSimulation}
                      disabled={!state.deployed}
                      className="px-3 py-1.5 rounded-md text-[10px] font-semibold border border-subtle bg-surface hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1"
                    >
                      {state.simulationRunning ? <><Pause className="w-3 h-3" /> Pause</> : <><Play className="w-3 h-3" /> Run</>}
                    </button>
                  </div>

                  {/* Simulation Metrics */}
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <div className="p-2 rounded-md bg-background border border-subtle text-center">
                      <span className="text-[9px] text-muted-foreground block">Completed</span>
                      <strong className="text-sm font-mono">{state.completedWork}</strong>
                    </div>
                    <div className="p-2 rounded-md bg-background border border-subtle text-center">
                      <span className="text-[9px] text-muted-foreground block">Needs Approval</span>
                      <strong className="text-sm font-mono">{state.approvalWork}</strong>
                    </div>
                    <div className="p-2 rounded-md bg-background border border-subtle text-center">
                      <span className="text-[9px] text-muted-foreground block">Minutes Saved</span>
                      <strong className="text-sm font-mono">{state.minutesSaved}</strong>
                    </div>
                  </div>

                  {/* Activity Feed */}
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {state.liveEvents.length > 0 ? state.liveEvents.slice(0, 6).map((event, i) => (
                      <div key={i} className="flex items-start gap-2 p-2 rounded-md bg-background border border-subtle">
                        <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${event.type === "approval" ? "bg-[oklch(0.85_0.15_75)]" : "bg-[oklch(0.75_0.18_155)]"}`} />
                        <div>
                          <strong className="text-[11px] block">{event.title}</strong>
                          <span className="text-[10px] text-muted-foreground">{event.detail}</span>
                        </div>
                      </div>
                    )) : (
                      <div className="flex items-start gap-2 p-2 rounded-md bg-background border border-subtle">
                        <span className="w-2 h-2 rounded-full mt-1.5 shrink-0 bg-[oklch(0.85_0.15_75)]" />
                        <div>
                          <strong className="text-[11px] block">{state.deploying ? "Deployment running" : "Preview not deployed"}</strong>
                          <span className="text-[10px] text-muted-foreground">{state.deploying ? "Upshot OS is packaging the role, systems, tasks, and approval rules." : "Select tasks, systems, and oversight rules, then click Deploy Preview."}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </TabsContent>

                {/* Approvals Tab */}
                <TabsContent value="approvals" className="p-4 mt-0">
                  <h4 className="text-xs font-semibold mb-3">Human approval queue</h4>
                  <div className="space-y-2">
                    {state.deployed ? state.oversight.map((rule, i) => (
                      <div key={rule} className="flex items-start gap-2 p-2 rounded-md bg-background border border-subtle">
                        <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${i === 0 ? "bg-[oklch(0.85_0.15_75)]" : i === 1 ? "bg-[oklch(0.65_0.2_25)]" : "bg-[oklch(0.75_0.18_155)]"}`} />
                        <div>
                          <strong className="text-[11px] block">{rule}</strong>
                          <span className="text-[10px] text-muted-foreground">{i < 2 ? "Waiting for owner approval before action." : "Routine review path recorded."}</span>
                        </div>
                      </div>
                    )) : (
                      <div className="flex items-start gap-2 p-2 rounded-md bg-background border border-subtle">
                        <span className="w-2 h-2 rounded-full mt-1.5 shrink-0 bg-[oklch(0.85_0.15_75)]" />
                        <div>
                          <strong className="text-[11px] block">Approval logic ready</strong>
                          <span className="text-[10px] text-muted-foreground">Sensitive actions pause before sending, updating, or escalating.</span>
                        </div>
                      </div>
                    )}
                  </div>
                </TabsContent>

                {/* ROI Tab */}
                <TabsContent value="roi" className="p-4 mt-0">
                  <h4 className="text-xs font-semibold mb-3">Capacity estimate</h4>
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    <div className="p-3 rounded-md bg-background border border-subtle">
                      <span className="text-[9px] text-muted-foreground block">Monthly Value</span>
                      <strong className="text-base font-mono text-gold">${computed.monthlyValue.toLocaleString()}</strong>
                    </div>
                    <div className="p-3 rounded-md bg-background border border-subtle">
                      <span className="text-[9px] text-muted-foreground block">Annual Capacity</span>
                      <strong className="text-base font-mono">{computed.annualHours.toLocaleString()} hrs</strong>
                    </div>
                    <div className="p-3 rounded-md bg-background border border-subtle">
                      <span className="text-[9px] text-muted-foreground block">Exception Rate</span>
                      <strong className="text-base font-mono">{computed.exceptionRate}%</strong>
                    </div>
                    <div className="p-3 rounded-md bg-background border border-subtle">
                      <span className="text-[9px] text-muted-foreground block">Payback Signal</span>
                      <strong className="text-base font-mono">{computed.paybackSignal}</strong>
                    </div>
                  </div>
                  <div className="p-3 rounded-md border border-subtle bg-[oklch(0.65_0.14_75/5%)]">
                    <strong className="text-[11px] block mb-1">What the buyer sees</strong>
                    <p className="text-[10px] text-muted-foreground">{scenario.proof}</p>
                  </div>
                  <p className="text-[9px] text-muted-foreground mt-3">Prototype estimates assume repetitive operational capacity valued at $45/hour. MVP pilots should validate actual cycle time, quality, exception rate, and capacity reclaimed.</p>
                </TabsContent>
              </Tabs>

              {/* CTA */}
              <div className="p-4 border-t border-subtle">
                <a
                  href="#assessment"
                  className="block w-full py-3 rounded-lg font-semibold text-sm text-center bg-gold text-background hover:bg-gold/90 transition-all duration-200 active:scale-[0.97]"
                >
                  Request MVP Pilot
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function BuilderCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="p-5 rounded-xl border border-subtle bg-surface/50">
      <div className="mb-4">
        <span className="text-[10px] font-mono text-gold tracking-wider uppercase">{title}</span>
        <h3 className="text-sm font-semibold mt-1">{subtitle}</h3>
      </div>
      {children}
    </div>
  );
}

function MetricCell({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="p-3 text-center border-r last:border-r-0 border-subtle">
      <span className="text-[9px] font-mono text-muted-foreground tracking-wider uppercase block mb-1">{label}</span>
      <strong className={`text-base font-mono ${accent ? "text-gold" : ""}`}>{value}</strong>
    </div>
  );
}
