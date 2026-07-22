import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, Check, Rocket, Shield, Zap } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { prototypeData, type IndustryKey, type Role } from "@/components/prototype/prototypeData";
import { createIntegrationsFromDeployment } from "@/lib/connectionsService";
import { supabase } from "@/lib/supabase";
import { deployDigitalSpecialist, mapOversightMode, toSlug, type DeployConfig } from "@/lib/supabaseService";

const HOURLY_VALUE = 45;
const MINUTES_RECLAIMED_PER_SUCCESSFUL_EXECUTION = 14;
const completedStatuses = new Set(["successful", "success", "completed"]);

interface ActualImpact {
  successfulExecutions: number;
  hoursReclaimed: number;
  valueCreated: number;
}

const emptyImpact: ActualImpact = {
  successfulExecutions: 0,
  hoursReclaimed: 0,
  valueCreated: 0,
};

export default function DeployV2() {
  const { user, profile, organization } = useAuth();
  const [, navigate] = useLocation();

  const [industry, setIndustry] = useState<IndustryKey>("Logistics");
  const [role, setRole] = useState<Role>(prototypeData.roles[0]);
  const [tasks, setTasks] = useState<string[]>([]);
  const [apps, setApps] = useState<string[]>([]);
  const [oversight, setOversight] = useState<string[]>(prototypeData.industries.Logistics.approvalTemplates.slice(0, 2));
  const [specialistName, setSpecialistName] = useState("");
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
    setOversight(prototypeData.industries[next].approvalTemplates.slice(0, 2));
    resetDeployment();
  };

  const chooseRole = (next: Role) => {
    setRole(next);
    setTasks([]);
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
      const hoursReclaimed = Math.round((minutesReclaimed / 60) * 10) / 10;
      const valueCreated = Math.round((minutesReclaimed / 60) * HOURLY_VALUE);
      setActualImpact({ successfulExecutions, hoursReclaimed, valueCreated });
    }

    setImpactLoading(false);
  }, [profile?.active_organization_id]);

  useEffect(() => {
    if (!supabase || !deployedSpecialistId || !profile?.active_organization_id) return;
    const client = supabase;

    void loadActualImpact(deployedSpecialistId);
    const channel = client
      .channel(`deployment-roi:${deployedSpecialistId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "workflow_executions",
          filter: `organization_id=eq.${profile.active_organization_id}`,
        },
        payload => {
          const row = (payload.new || payload.old) as { specialist_id?: string };
          if (row.specialist_id === deployedSpecialistId) void loadActualImpact(deployedSpecialistId);
        },
      )
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [deployedSpecialistId, loadActualImpact, profile?.active_organization_id]);

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
      description: `${effectiveName} for ${industry} automating ${tasks.length} workflows across ${apps.length} systems.`,
      oversightMode,
      selectedSystems: apps,
      configuration: {
        industry,
        role: role.name,
        tasks,
        apps,
        oversight,
        oversightMode,
        deployedFrom: "wizard-v2",
        estimatedMonthlyHours,
        estimatedAnnualHours,
        estimatedAnnualValue,
        hourlyValue: HOURLY_VALUE,
      },
      tasks: tasks.map(task => ({
        name: task,
        workflowKey: toSlug(task),
        description: `Automated workflow: ${task}`,
      })),
    };

    const result = await deployDigitalSpecialist(config);
    if (!result.success || !result.specialistId) {
      setDeployError(result.error || "Deployment failed. Please try again.");
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
        { label: "Actual Hours Reclaimed", value: `${actualImpact.hoursReclaimed.toLocaleString()} hrs`, accent: false },
        { label: "Actual Value Created", value: `$${actualImpact.valueCreated.toLocaleString()}`, accent: true },
      ]
    : [
        { label: "Estimated Hours Saved", value: `${estimatedAnnualHours.toLocaleString()} hrs / yr`, accent: false },
        { label: "Estimated Annual Value", value: `$${estimatedAnnualValue.toLocaleString()}`, accent: true },
      ], [actualImpact, deployed, estimatedAnnualHours, estimatedAnnualValue]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-subtle bg-surface/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="container flex items-center justify-between h-[64px]">
          <Link href="/app" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" /> Back to Command Center
          </Link>
          <span className="text-[10px] font-mono text-muted-foreground uppercase">{organization?.name}</span>
        </div>
      </header>

      <main className="container py-8 lg:py-12">
        <div className="mb-8">
          <span className="text-[10px] font-mono text-gold uppercase">// Deploy Digital Specialist</span>
          <h1 className="font-display text-3xl font-bold mt-1">Configure operational capacity</h1>
          <p className="text-sm text-muted-foreground mt-2">Estimate impact before deployment. Measure reclaimed capacity from live workflow executions after deployment.</p>
        </div>

        <div className="grid lg:grid-cols-[1fr_0.9fr] gap-6 items-start">
          <section className="space-y-5">
            <BuilderCard title="1 · Configure Role">
              <input value={specialistName} onChange={event => setSpecialistName(event.target.value)} placeholder={role.name} className="w-full px-4 py-3 mb-4 rounded-lg border border-subtle bg-background text-sm" />
              <div className="grid grid-cols-2 gap-2 mb-4">
                {(Object.keys(prototypeData.industries) as IndustryKey[]).map(item => <Choice key={item} selected={industry === item} onClick={() => chooseIndustry(item)}>{item}</Choice>)}
              </div>
              <div className="grid gap-2">
                {prototypeData.roles.map(item => <Choice key={item.name} selected={role.name === item.name} onClick={() => chooseRole(item)}>{item.name}</Choice>)}
              </div>
            </BuilderCard>

            <BuilderCard title="2 · Define Work">
              <div className="flex flex-wrap gap-2">{role.tasks.map(task => <Choice key={task} selected={tasks.includes(task)} onClick={() => toggle(task, tasks, setTasks)}>{task}</Choice>)}</div>
            </BuilderCard>

            <BuilderCard title="3 · Connect Systems">
              <div className="grid grid-cols-2 gap-2">{industryData.systems.map(app => <Choice key={app} selected={apps.includes(app)} onClick={() => toggle(app, apps, setApps)}>{app}</Choice>)}</div>
            </BuilderCard>

            <BuilderCard title="4 · Human Oversight">
              <div className="space-y-2">{industryData.approvalTemplates.map(rule => <Choice key={rule} selected={oversight.includes(rule)} onClick={() => toggle(rule, oversight, setOversight)}><Shield className="w-3.5 h-3.5 inline mr-2" />{rule}</Choice>)}</div>
            </BuilderCard>

            <div className="p-5 rounded-xl border border-gold/20 bg-[oklch(0.65_0.14_75/5%)]">
              {deployError && <p className="text-xs text-red-400 mb-3">{deployError}</p>}
              {deployed ? (
                <button onClick={() => navigate("/app")} className="w-full py-3 rounded-lg font-semibold text-sm bg-[oklch(0.75_0.18_155)] text-background">Open Command Center →</button>
              ) : (
                <button onClick={handleDeploy} disabled={!canDeploy || deploying} className="w-full py-3 rounded-lg font-semibold text-sm bg-gold text-background disabled:opacity-40">
                  <Rocket className="w-4 h-4 inline mr-2" />{deploying ? "Deploying..." : "Deploy Digital Specialist"}
                </button>
              )}
            </div>
          </section>

          <aside className="lg:sticky lg:top-24 rounded-2xl border border-subtle bg-surface overflow-hidden">
            <div className="p-5 border-b border-subtle flex items-center justify-between">
              <div><p className="text-[10px] font-mono text-muted-foreground uppercase">ROI Measurement</p><strong className="font-display">{effectiveName}</strong></div>
              <span className={`px-2.5 py-1 rounded-full text-[10px] font-mono ${deployed ? "text-green-400 bg-green-400/10" : "text-gold bg-gold/10"}`}>{deployed ? "Live actuals" : "Pre-deployment estimate"}</span>
            </div>
            <div className="p-5">
              <div className="grid grid-cols-2 gap-3">
                {roiCards.map(card => (
                  <div key={card.label} className="p-4 rounded-xl border border-subtle bg-background">
                    <span className="text-[9px] font-mono text-muted-foreground uppercase block mb-2">{card.label}</span>
                    <strong className={`text-xl font-mono ${card.accent ? "text-gold" : ""}`}>{impactLoading && deployed ? "Syncing..." : card.value}</strong>
                  </div>
                ))}
              </div>
              <div className="mt-4 p-4 rounded-xl border border-subtle bg-background/50">
                {deployed ? (
                  <>
                    <div className="flex items-center gap-2 mb-2"><Zap className="w-4 h-4 text-gold" /><strong className="text-xs">Measured from live executions</strong></div>
                    <p className="text-[11px] text-muted-foreground">{actualImpact.successfulExecutions.toLocaleString()} successful workflow executions recorded. Actual value updates automatically as new executions complete.</p>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2 mb-2"><Check className="w-4 h-4 text-gold" /><strong className="text-xs">Planning estimate</strong></div>
                    <p className="text-[11px] text-muted-foreground">Based on selected workflows, systems, oversight gates, and operational capacity valued at ${HOURLY_VALUE}/hour.</p>
                  </>
                )}
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

function BuilderCard({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="p-5 rounded-xl border border-subtle bg-surface/50"><span className="text-[10px] font-mono text-gold uppercase block mb-4">{title}</span>{children}</div>;
}

function Choice({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className={`w-full p-3 rounded-lg border text-left text-xs transition-all ${selected ? "border-gold/50 bg-gold/10 text-foreground" : "border-subtle bg-background text-muted-foreground hover:border-gold/30"}`}>{selected && <Check className="w-3 h-3 inline mr-1" />}{children}</button>;
}
