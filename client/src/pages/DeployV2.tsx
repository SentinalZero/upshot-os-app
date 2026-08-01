import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  Check,
  ChevronLeft,
  Clock3,
  Rocket,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { prototypeData, type IndustryKey, type Role } from "@/components/prototype/prototypeData";
import { createIntegrationsFromDeployment } from "@/lib/connectionsService";
import { supabase } from "@/lib/supabase";
import { deployDigitalSpecialist, mapOversightMode, toSlug, type DeployConfig } from "@/lib/supabaseService";

const HOURLY_VALUE = 45;
const MINUTES_RECLAIMED_PER_SUCCESSFUL_EXECUTION = 14;
const completedStatuses = new Set(["successful", "success", "completed"]);
const serviceBusinessScenario = prototypeData.scenarios["Service Business"];
const receptionistRole = prototypeData.roles.find(item => item.name === serviceBusinessScenario.role) ?? prototypeData.roles[0];

const steps = [
  { eyebrow: "Your role", title: "What do you do?", description: "Choose the role that best matches the work you want help with." },
  { eyebrow: "Your workload", title: "What is taking too much time?", description: "Pick the recurring work you would gladly take off your plate." },
  { eyebrow: "Your tools", title: "Where does the work happen?", description: "Connect the systems your Digital Specialist should work across." },
  { eyebrow: "Your guardrails", title: "When should we ask first?", description: "Keep the work moving while preserving human judgment where it matters." },
  { eyebrow: "Meet your specialist", title: "Your new teammate is ready", description: "Review the role, responsibilities, tools, and expected impact before onboarding." },
];

interface ActualImpact {
  successfulExecutions: number;
  hoursReclaimed: number;
  valueCreated: number;
}

const emptyImpact: ActualImpact = { successfulExecutions: 0, hoursReclaimed: 0, valueCreated: 0 };

export default function DeployV2() {
  const { user, profile, organization } = useAuth();
  const [, navigate] = useLocation();

  const [step, setStep] = useState(0);
  const [industry, setIndustry] = useState<IndustryKey>("Service Business");
  const [role, setRole] = useState<Role>(receptionistRole);
  const [tasks, setTasks] = useState<string[]>([...serviceBusinessScenario.tasks]);
  const [apps, setApps] = useState<string[]>([...serviceBusinessScenario.apps]);
  const [oversight, setOversight] = useState<string[]>(prototypeData.industries["Service Business"].approvalTemplates.slice(0, 2));
  const [specialistName, setSpecialistName] = useState("Emma");
  const [deploying, setDeploying] = useState(false);
  const [deployed, setDeployed] = useState(false);
  const [deployedSpecialistId, setDeployedSpecialistId] = useState<string | null>(null);
  const [deployError, setDeployError] = useState<string | null>(null);
  const [actualImpact, setActualImpact] = useState<ActualImpact>(emptyImpact);
  const [impactLoading, setImpactLoading] = useState(false);

  const industryData = prototypeData.industries[industry];
  const effectiveName = specialistName.trim() || role.name;
  const estimatedMonthlyHours = Math.max(0, tasks.length * 9 + apps.length * 3 + oversight.length * 2);
  const estimatedAnnualHours = estimatedMonthlyHours * 12;
  const estimatedAnnualValue = estimatedAnnualHours * HOURLY_VALUE;

  const resetDeployment = useCallback(() => {
    setDeployed(false);
    setDeployedSpecialistId(null);
    setDeployError(null);
    setActualImpact(emptyImpact);
  }, []);

  const chooseIndustry = (next: IndustryKey) => {
    setIndustry(next);
    const scenario = prototypeData.scenarios[next];
    const matchingRole = prototypeData.roles.find(item => item.name === scenario.role);
    if (matchingRole) setRole(matchingRole);
    setTasks([...scenario.tasks]);
    setApps([...scenario.apps]);
    setOversight(prototypeData.industries[next].approvalTemplates.slice(0, 2));
    resetDeployment();
  };

  const chooseRole = (next: Role) => {
    const matchingIndustry = next.bestFit as IndustryKey;
    setRole(next);
    setIndustry(matchingIndustry);
    setTasks([...next.tasks.slice(0, 4)]);
    setApps([...next.defaultApps]);
    setOversight(prototypeData.industries[matchingIndustry].approvalTemplates.slice(0, 2));
    resetDeployment();
  };

  const toggle = (value: string, values: string[], setter: (next: string[]) => void) => {
    setter(values.includes(value) ? values.filter(item => item !== value) : [...values, value]);
    resetDeployment();
  };

  const loadActualImpact = useCallback(async (specialistId: string) => {
    if (!supabase || !profile?.active_organization_id) return;
    setImpactLoading(true);
    const { data, error } = await supabase
      .from("workflow_executions")
      .select("id, status")
      .eq("organization_id", profile.active_organization_id)
      .eq("specialist_id", specialistId);

    if (!error) {
      const successfulExecutions = (data || []).filter(item => completedStatuses.has(String(item.status || "").toLowerCase())).length;
      const minutesReclaimed = successfulExecutions * MINUTES_RECLAIMED_PER_SUCCESSFUL_EXECUTION;
      setActualImpact({
        successfulExecutions,
        hoursReclaimed: Math.round((minutesReclaimed / 60) * 10) / 10,
        valueCreated: Math.round((minutesReclaimed / 60) * HOURLY_VALUE),
      });
    }
    setImpactLoading(false);
  }, [profile?.active_organization_id]);

  useEffect(() => {
    if (!supabase || !deployedSpecialistId || !profile?.active_organization_id) return;
    const client = supabase;
    void loadActualImpact(deployedSpecialistId);
    const channel = client
      .channel(`deployment-roi:${deployedSpecialistId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "workflow_executions",
        filter: `organization_id=eq.${profile.active_organization_id}`,
      }, payload => {
        const row = (payload.new || payload.old) as { specialist_id?: string };
        if (row.specialist_id === deployedSpecialistId) void loadActualImpact(deployedSpecialistId);
      })
      .subscribe();

    return () => { void client.removeChannel(channel); };
  }, [deployedSpecialistId, loadActualImpact, profile?.active_organization_id]);

  const canContinue = [true, tasks.length > 0, apps.length > 0, oversight.length > 0, true][step];
  const canDeploy = tasks.length > 0 && apps.length > 0 && oversight.length > 0;

  const handleDeploy = async () => {
    if (!canDeploy || deploying || !user || !profile?.active_organization_id) return;
    setDeploying(true);
    setDeployError(null);

    const oversightMode = mapOversightMode(oversight);
    const config: DeployConfig = {
      organizationId: profile.active_organization_id,
      userId: user.id,
      name: effectiveName,
      roleName: role.name,
      roleKey: toSlug(role.name),
      industryName: industry,
      industryKey: toSlug(industry),
      description: `${effectiveName} supports ${role.name} work across ${apps.length} connected systems.`,
      oversightMode,
      selectedSystems: apps,
      configuration: {
        industry,
        role: role.name,
        tasks,
        apps,
        oversight,
        oversightMode,
        deployedFrom: "story-first-onboarding",
        estimatedMonthlyHours,
        estimatedAnnualHours,
        estimatedAnnualValue,
        hourlyValue: HOURLY_VALUE,
      },
      tasks: tasks.map(task => ({ name: task, workflowKey: toSlug(task), description: `Assigned work: ${task}` })),
    };

    const result = await deployDigitalSpecialist(config);
    if (!result.success || !result.specialistId) {
      setDeployError(result.error || "We could not onboard your specialist. Please try again.");
      setDeploying(false);
      return;
    }

    setDeployedSpecialistId(result.specialistId);
    await createIntegrationsFromDeployment(config.organizationId, config.userId, result.specialistId, config.selectedSystems);
    setDeployed(true);
    setDeploying(false);
  };

  const roiCards = useMemo(() => deployed
    ? [
        { label: "Hours returned", value: `${actualImpact.hoursReclaimed.toLocaleString()} hrs`, accent: false },
        { label: "Value created", value: `$${actualImpact.valueCreated.toLocaleString()}`, accent: true },
      ]
    : [
        { label: "Estimated time returned", value: `${estimatedAnnualHours.toLocaleString()} hrs / yr`, accent: false },
        { label: "Estimated annual value", value: `$${estimatedAnnualValue.toLocaleString()}`, accent: true },
      ], [actualImpact, deployed, estimatedAnnualHours, estimatedAnnualValue]);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-subtle bg-background/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/app" className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back to Upshot OS
          </Link>
          <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground">{organization?.name}</span>
        </div>
      </header>

      <main className="container py-8 lg:py-12">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-gold/20 bg-gold/5 px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.16em] text-gold">
                <Sparkles className="h-3.5 w-3.5" /> Hire a Digital Specialist
              </div>
              <h1 className="max-w-3xl font-display text-4xl font-semibold tracking-tight lg:text-5xl">Let&apos;s get some of your time back.</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground lg:text-base">
                Tell us what you do, what is slowing you down, and which tools you already use. Upshot handles the complexity behind the scenes.
              </p>
            </div>
            <div className="text-left lg:text-right">
              <p className="text-xs text-muted-foreground">Step {step + 1} of {steps.length}</p>
              <div className="mt-2 flex gap-1.5">
                {steps.map((_, index) => <span key={index} className={`h-1.5 w-9 rounded-full transition-colors ${index <= step ? "bg-gold" : "bg-subtle"}`} />)}
              </div>
            </div>
          </div>

          <div className="grid items-start gap-6 lg:grid-cols-[1.25fr_0.75fr]">
            <section className="min-h-[520px] overflow-hidden rounded-3xl border border-subtle bg-surface/60 shadow-2xl shadow-black/10">
              <div className="border-b border-subtle px-6 py-5 lg:px-8">
                <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-gold">{steps[step].eyebrow}</p>
                <h2 className="mt-2 font-display text-2xl font-semibold lg:text-3xl">{steps[step].title}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{steps[step].description}</p>
              </div>

              <div className="p-6 lg:p-8">
                <AnimatePresence mode="wait">
                  <motion.div key={step} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.28, ease: "easeOut" }}>
                    {step === 0 && (
                      <div className="space-y-8">
                        <div>
                          <p className="mb-3 text-xs font-medium text-muted-foreground">Choose your industry</p>
                          <div className="grid gap-3 sm:grid-cols-2">
                            {(Object.keys(prototypeData.industries) as IndustryKey[]).map(item => (
                              <Choice key={item} selected={industry === item} onClick={() => chooseIndustry(item)}>
                                <BriefcaseBusiness className="h-4 w-4" /><span>{item}</span>
                              </Choice>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className="mb-3 text-xs font-medium text-muted-foreground">Choose the role that needs help</p>
                          <div className="grid gap-3 sm:grid-cols-2">
                            {prototypeData.roles.map(item => (
                              <Choice key={item.name} selected={role.name === item.name} onClick={() => chooseRole(item)}><span>{item.name}</span></Choice>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {step === 1 && (
                      <div className="grid gap-3 sm:grid-cols-2">
                        {role.tasks.map(task => (
                          <Choice key={task} selected={tasks.includes(task)} onClick={() => toggle(task, tasks, setTasks)}>
                            <Clock3 className="h-4 w-4" /><span>{task}</span>
                          </Choice>
                        ))}
                      </div>
                    )}

                    {step === 2 && (
                      <div className="grid gap-3 sm:grid-cols-2">
                        {industryData.systems.map(app => (
                          <Choice key={app} selected={apps.includes(app)} onClick={() => toggle(app, apps, setApps)}><span>{app}</span></Choice>
                        ))}
                      </div>
                    )}

                    {step === 3 && (
                      <div className="space-y-3">
                        {industryData.approvalTemplates.map(rule => (
                          <Choice key={rule} selected={oversight.includes(rule)} onClick={() => toggle(rule, oversight, setOversight)}>
                            <ShieldCheck className="h-4 w-4" /><span>{rule}</span>
                          </Choice>
                        ))}
                      </div>
                    )}

                    {step === 4 && (
                      <div className="space-y-6">
                        <div className="flex items-center gap-4 rounded-2xl border border-gold/20 bg-gold/5 p-5">
                          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gold text-xl font-semibold text-background">{effectiveName.slice(0, 1).toUpperCase()}</div>
                          <div className="flex-1">
                            <label className="text-[10px] font-mono uppercase tracking-[0.16em] text-muted-foreground">Digital Specialist name</label>
                            <input value={specialistName} onChange={event => setSpecialistName(event.target.value)} className="mt-1 w-full border-0 bg-transparent p-0 font-display text-2xl font-semibold outline-none" aria-label="Digital Specialist name" />
                            <p className="mt-1 text-sm text-muted-foreground">{role.name} Digital Specialist</p>
                          </div>
                          <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-[10px] font-mono uppercase text-emerald-400">Ready to work</span>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <SummaryCard title="Responsibilities" items={tasks} />
                          <SummaryCard title="Connected tools" items={apps} />
                        </div>
                        {deployError && <p className="rounded-xl border border-red-400/20 bg-red-400/5 p-3 text-xs text-red-400">{deployError}</p>}
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>

              <div className="flex items-center justify-between border-t border-subtle px-6 py-5 lg:px-8">
                <button onClick={() => setStep(current => Math.max(0, current - 1))} disabled={step === 0 || deploying} className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30">
                  <ChevronLeft className="h-4 w-4" /> Back
                </button>
                {step < steps.length - 1 ? (
                  <button onClick={() => setStep(current => Math.min(steps.length - 1, current + 1))} disabled={!canContinue} className="inline-flex items-center gap-2 rounded-xl bg-gold px-5 py-3 text-sm font-semibold text-background transition-transform hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-40">
                    Continue <ArrowRight className="h-4 w-4" />
                  </button>
                ) : deployed ? (
                  <button onClick={() => navigate("/app")} className="inline-flex items-center gap-2 rounded-xl bg-emerald-400 px-5 py-3 text-sm font-semibold text-background">Meet your team <ArrowRight className="h-4 w-4" /></button>
                ) : (
                  <button onClick={handleDeploy} disabled={!canDeploy || deploying} className="inline-flex items-center gap-2 rounded-xl bg-gold px-5 py-3 text-sm font-semibold text-background transition-transform hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-40">
                    <Rocket className="h-4 w-4" /> {deploying ? "Onboarding..." : `Onboard ${effectiveName}`}
                  </button>
                )}
              </div>
            </section>

            <aside className="space-y-4 lg:sticky lg:top-24">
              <div className="overflow-hidden rounded-3xl border border-subtle bg-surface">
                <div className="border-b border-subtle p-5">
                  <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-muted-foreground">Your specialist</p>
                  <div className="mt-3 flex items-center gap-3">
                    <div className="grid h-11 w-11 place-items-center rounded-xl bg-gold/10 font-display text-lg font-semibold text-gold">{effectiveName.slice(0, 1).toUpperCase()}</div>
                    <div><strong className="font-display text-lg">{effectiveName}</strong><p className="text-xs text-muted-foreground">{role.name}</p></div>
                  </div>
                </div>
                <div className="p-5">
                  <div className="grid grid-cols-2 gap-3">
                    {roiCards.map(card => (
                      <div key={card.label} className="rounded-2xl border border-subtle bg-background/60 p-4">
                        <span className="block text-[9px] font-mono uppercase leading-4 text-muted-foreground">{card.label}</span>
                        <strong className={`mt-2 block text-lg font-mono ${card.accent ? "text-gold" : ""}`}>{impactLoading && deployed ? "Syncing..." : card.value}</strong>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 rounded-2xl border border-subtle bg-background/40 p-4">
                    <div className="mb-2 flex items-center gap-2"><Zap className="h-4 w-4 text-gold" /><strong className="text-xs">{deployed ? "Work is now being measured" : "A simple planning estimate"}</strong></div>
                    <p className="text-[11px] leading-5 text-muted-foreground">
                      {deployed ? `${actualImpact.successfulExecutions.toLocaleString()} completed work items are contributing to measured impact.` : "This preview is based on the work, connected tools, and approval rules you selected."}
                    </p>
                  </div>
                </div>
              </div>
              <div className="rounded-3xl border border-gold/15 bg-gold/5 p-5">
                <p className="text-xs font-semibold">The complexity stays behind the curtain.</p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">Upshot still uses your existing specialist, connector, workflow, and approval architecture. This new experience simply starts with the user&apos;s problem instead of the engine.</p>
              </div>
            </aside>
          </div>
        </div>
      </main>
    </div>
  );
}

function Choice({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={`flex min-h-14 w-full items-center gap-3 rounded-2xl border p-4 text-left text-sm transition-all ${selected ? "border-gold/50 bg-gold/10 text-foreground shadow-lg shadow-gold/5" : "border-subtle bg-background/60 text-muted-foreground hover:-translate-y-0.5 hover:border-gold/30 hover:text-foreground"}`}>
      <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border ${selected ? "border-gold bg-gold text-background" : "border-subtle"}`}>{selected && <Check className="h-3 w-3" />}</span>
      {children}
    </button>
  );
}

function SummaryCard({ title, items }: { title: string; items: readonly string[] }) {
  return (
    <div className="rounded-2xl border border-subtle bg-background/50 p-5">
      <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-muted-foreground">{title}</p>
      <div className="mt-3 space-y-2">
        {items.map(item => <div key={item} className="flex items-start gap-2 text-sm"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold" /><span>{item}</span></div>)}
      </div>
    </div>
  );
}
