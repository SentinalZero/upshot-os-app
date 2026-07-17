import { useState, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation, Link } from "wouter";
import { prototypeData, IndustryKey, Role, LiveEvent } from "@/components/prototype/prototypeData";
import { deployDigitalSpecialist, toSlug, mapOversightMode, type DeployConfig } from "@/lib/supabaseService";
import { createIntegrationsFromDeployment } from "@/lib/connectionsService";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Check, Play, Pause, Rocket, Shield, Zap, Activity, ArrowLeft, AlertCircle } from "lucide-react";

export default function Deploy() {
  const { user, profile, organization } = useAuth();
  const [, navigate] = useLocation();

  // Wizard state
  const [industry, setIndustryState] = useState<IndustryKey>("Logistics");
  const [role, setRoleState] = useState<Role>(prototypeData.roles[0]);
  const [tasks, setTasks] = useState<string[]>([]);
  const [apps, setApps] = useState<string[]>([]);
  const [oversight, setOversight] = useState<string[]>(prototypeData.industries["Logistics"].approvalTemplates.slice(0, 2));
  const [specialistName, setSpecialistName] = useState("");

  // Deployment state
  const [deploying, setDeploying] = useState(false);
  const [deployed, setDeployed] = useState(false);
  const [deployError, setDeployError] = useState<string | null>(null);
  const [deployedSpecialistId, setDeployedSpecialistId] = useState<string | null>(null);
  const deployClickedRef = useRef(false);

  // Simulation state (post-deploy animation)
  const [simulationRunning, setSimulationRunning] = useState(false);
  const [liveEvents, setLiveEvents] = useState<LiveEvent[]>([]);
  const [completedWork, setCompletedWork] = useState(0);
  const [approvalWork, setApprovalWork] = useState(0);
  const [minutesSaved, setMinutesSaved] = useState(0);
  const simulationTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  const industryKeys = Object.keys(prototypeData.industries) as IndustryKey[];
  const industryData = prototypeData.industries[industry];
  const scenario = prototypeData.scenarios[industry];

  // Computed
  const taskCount = tasks.length;
  const appCount = apps.length;
  const oversightCount = oversight.length;
  const monthlyHours = Math.max(0, taskCount * 9 + appCount * 3 + oversightCount * 2);
  const monthlyValue = monthlyHours * 45;
  const annualHours = monthlyHours * 12;
  const annualValue = monthlyValue * 12;
  const exceptionRate = taskCount ? Math.min(34, Math.max(8, oversightCount * 7 + Math.round((oversightCount / Math.max(taskCount, 1)) * 10))) : 0;
  const paybackSignal = monthlyValue >= 1500 ? "Strong" : taskCount ? "Emerging" : "Pilot-ready";
  const pilotTarget = taskCount >= 3 && appCount >= 2 ? "14 days" : "Configure";

  const effectiveName = specialistName.trim() || role.name;

  // Actions
  const setIndustry = useCallback((ind: IndustryKey) => {
    setIndustryState(ind);
    setOversight(prototypeData.industries[ind].approvalTemplates.slice(0, 2));
    resetDeployState();
  }, []);

  const setRole = useCallback((r: Role) => {
    setRoleState(r);
    setTasks([]);
    resetDeployState();
  }, []);

  const toggleTask = useCallback((task: string) => {
    setTasks(prev => prev.includes(task) ? prev.filter(t => t !== task) : [...prev, task]);
    resetDeployState();
  }, []);

  const toggleApp = useCallback((app: string) => {
    setApps(prev => prev.includes(app) ? prev.filter(a => a !== app) : [...prev, app]);
    resetDeployState();
  }, []);

  const toggleOversight = useCallback((rule: string) => {
    setOversight(prev => prev.includes(rule) ? prev.filter(r => r !== rule) : [...prev, rule]);
    resetDeployState();
  }, []);

  const applyScenario = useCallback((ind: IndustryKey) => {
    const sc = prototypeData.scenarios[ind];
    if (!sc) return;
    const r = prototypeData.roles.find(rl => rl.name === sc.role) || prototypeData.roles[0];
    setIndustryState(ind);
    setRoleState(r);
    setTasks([...sc.tasks]);
    setApps([...sc.apps]);
    setOversight(prototypeData.industries[ind].approvalTemplates.slice(0, 2));
    resetDeployState();
  }, []);

  function resetDeployState() {
    setDeployed(false);
    setDeploying(false);
    setDeployError(null);
    setDeployedSpecialistId(null);
    setSimulationRunning(false);
    setLiveEvents([]);
    setCompletedWork(0);
    setApprovalWork(0);
    setMinutesSaved(0);
    deployClickedRef.current = false;
    if (simulationTimer.current) {
      clearInterval(simulationTimer.current);
      simulationTimer.current = null;
    }
  }

  // ─── DEPLOY (real Supabase write) ──────────────────────────────────────────
  const handleDeploy = async () => {
    if (!tasks.length || !apps.length || !oversight.length) return;
    if (deploying || deployClickedRef.current) return; // prevent double-click
    deployClickedRef.current = true;

    if (!user || !profile?.active_organization_id) {
      setDeployError("You must be signed in with an active organization.");
      deployClickedRef.current = false;
      return;
    }

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
      description: `${effectiveName} for ${industry} — automating ${taskCount} workflows across ${appCount} systems.`,
      oversightMode,
      selectedSystems: apps,
      configuration: {
        industry,
        role: role.name,
        tasks,
        apps,
        oversight,
        oversightMode,
        deployedFrom: "wizard",
      },
      tasks: tasks.map(t => ({
        name: t,
        workflowKey: toSlug(t),
        description: `Automated workflow: ${t}`,
      })),
    };

    const result = await deployDigitalSpecialist(config);

    if (!result.success) {
      setDeployError(result.error || "Deployment failed. Please try again.");
      setDeploying(false);
      deployClickedRef.current = false;
      return;
    }

    // Success — show deployment animation
    setDeployedSpecialistId(result.specialistId || null);

    // Create integration records for selected systems
    if (result.specialistId && config.selectedSystems.length > 0) {
      createIntegrationsFromDeployment(
        config.organizationId,
        config.userId,
        result.specialistId,
        config.selectedSystems
      ).then(intResult => {
        if (intResult.errors.length > 0) {
          console.warn("[Deploy] Some integrations could not be created:", intResult.errors);
        }
      });
    }

    // Brief animation delay to feel intentional
    setTimeout(() => {
      setDeploying(false);
      setDeployed(true);
      // Seed initial events
      const task = tasks[0] || role.tasks[0];
      const app = apps[0] || "connected system";
      const rule = oversight[0] || "Human review";
      setLiveEvents([
        { type: "complete", title: `${task} completed`, detail: `${role.name} executed the workflow through ${app} and logged the outcome.` },
        { type: "approval", title: `${rule} paused for approval`, detail: "Upshot OS prepared the action, attached context, and stopped before sending." },
        { type: "complete", title: "Audit trail updated", detail: "Every automated step was captured for review." },
      ]);
      setCompletedWork(2);
      setApprovalWork(1);
      setMinutesSaved(36);
      previewRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 950);
  };

  // Simulation toggle (post-deploy demo)
  const toggleSimulation = useCallback(() => {
    if (!deployed) return;
    setSimulationRunning(prev => {
      const running = !prev;
      if (!running && simulationTimer.current) {
        clearInterval(simulationTimer.current);
        simulationTimer.current = null;
      }
      if (running) {
        simulationTimer.current = setInterval(() => {
          const task = tasks[Math.floor(Math.random() * tasks.length)] || role.tasks[0];
          const app = apps[Math.floor(Math.random() * apps.length)] || "connected system";
          const rule = oversight[Math.floor(Math.random() * oversight.length)] || "Human review";
          const needsApproval = Math.random() < 0.32;
          const event: LiveEvent = needsApproval
            ? { type: "approval", title: `${rule} requires review`, detail: `${role.name} prepared the action but paused for owner approval.` }
            : { type: "complete", title: `${task} completed`, detail: `Read context, executed the step, and updated ${app}.` };
          setLiveEvents(prev => [event, ...prev].slice(0, 10));
          if (needsApproval) {
            setApprovalWork(prev => prev + 1);
            setMinutesSaved(prev => prev + 8);
          } else {
            setCompletedWork(prev => prev + 1);
            setMinutesSaved(prev => prev + 14);
          }
        }, 1800);
      }
      return running;
    });
  }, [deployed, tasks, apps, oversight, role]);

  const flowSteps = [
    { label: "Configure", done: true },
    { label: "Define Work", done: taskCount > 0 },
    { label: "Connect", done: appCount > 0 },
    { label: "Oversight", done: oversightCount > 0 },
    { label: "Deploy", done: deploying || deployed },
    { label: "Command Center", done: deployed },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Top Bar */}
      <header className="border-b border-subtle bg-surface/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="container flex items-center justify-between h-[64px]">
          <div className="flex items-center gap-4">
            <Link href="/app">
              <span className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeft className="w-4 h-4" /> Back to Command Center
              </span>
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-mono text-muted-foreground tracking-wider uppercase hidden sm:block">
              {organization?.name}
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-[oklch(0.75_0.18_155)] animate-pulse" />
          </div>
        </div>
      </header>

      <main className="container py-8 lg:py-12">
        {/* Page Header */}
        <div className="mb-8">
          <span className="text-[10px] font-mono text-gold tracking-wider uppercase">// Deploy Digital Specialist</span>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight mt-1">
            Configure and deploy a new AI role
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Choose the business context, select repetitive work, connect systems, and deploy to your organization.
          </p>
        </div>

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
              <span className="text-[10px] font-mono text-muted-foreground tracking-wider uppercase">Quick-start scenario</span>
              <h3 className="font-display text-lg font-semibold mt-1">{scenario.title}</h3>
              <p className="text-sm text-muted-foreground mt-1">{scenario.copy}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {industryKeys.map(key => (
              <button
                key={key}
                onClick={() => applyScenario(key)}
                className={`px-4 py-2 rounded-lg text-xs font-medium transition-all duration-200 ${industry === key ? "bg-gold text-background" : "bg-background border border-subtle text-muted-foreground hover:border-gold/40 hover:text-foreground"}`}
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
            {/* Step 1: Industry & Role + Name */}
            <BuilderCard title="Step 1 · Configure Role" subtitle="Choose the business context">
              <div className="mb-4">
                <span className="text-[10px] font-mono text-muted-foreground tracking-wider uppercase mb-2 block">Specialist Name (optional)</span>
                <input
                  type="text"
                  value={specialistName}
                  onChange={e => setSpecialistName(e.target.value)}
                  placeholder={role.name}
                  className="w-full px-4 py-3 rounded-lg border border-subtle bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold/50 transition-all"
                />
              </div>
              <div className="mb-4">
                <span className="text-[10px] font-mono text-muted-foreground tracking-wider uppercase mb-2 block">Industry</span>
                <div className="grid grid-cols-2 gap-2">
                  {industryKeys.map(key => (
                    <button
                      key={key}
                      onClick={() => setIndustry(key)}
                      className={`p-3 rounded-lg border text-left transition-all duration-200 ${industry === key ? "border-gold/50 bg-[oklch(0.65_0.14_75/8%)]" : "border-subtle bg-background hover:border-gold/30"}`}
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
                  {prototypeData.roles.map(r => (
                    <button
                      key={r.name}
                      onClick={() => setRole(r)}
                      className={`p-3 rounded-lg border text-left transition-all duration-200 ${role.name === r.name ? "border-gold/50 bg-[oklch(0.65_0.14_75/8%)]" : "border-subtle bg-background hover:border-gold/30"}`}
                    >
                      <span className="text-xs font-semibold">{r.name}</span>
                      <span className="text-[10px] text-muted-foreground ml-2">
                        {r.bestFit === industry ? "Recommended" : `Adapted from ${r.bestFit}`}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </BuilderCard>

            {/* Step 2: Tasks */}
            <BuilderCard title="Step 2 · Define Work" subtitle="Select repetitive tasks to automate">
              <div className="flex flex-wrap gap-2">
                {role.tasks.map(task => (
                  <button
                    key={task}
                    onClick={() => toggleTask(task)}
                    className={`px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 border ${tasks.includes(task) ? "border-[oklch(0.75_0.18_155/50%)] bg-[oklch(0.75_0.18_155/10%)] text-[oklch(0.75_0.18_155)]" : "border-subtle bg-background text-muted-foreground hover:border-foreground/20"}`}
                  >
                    {tasks.includes(task) && <Check className="w-3 h-3 inline mr-1" />}
                    {task}
                  </button>
                ))}
              </div>
            </BuilderCard>

            {/* Step 3: Systems */}
            <BuilderCard title="Step 3 · Connect Systems" subtitle="Select business systems (configuration only)">
              <p className="text-[10px] text-muted-foreground mb-3">These are configuration selections. OAuth integrations will be connected in a later phase.</p>
              <div className="grid grid-cols-2 gap-2">
                {industryData.systems.map(app => {
                  const suggested = (role.defaultApps as readonly string[]).includes(app);
                  return (
                    <button
                      key={app}
                      onClick={() => toggleApp(app)}
                      className={`p-2.5 rounded-lg border text-left transition-all duration-200 ${apps.includes(app) ? "border-[oklch(0.75_0.18_155/50%)] bg-[oklch(0.75_0.18_155/8%)]" : "border-subtle bg-background hover:border-foreground/20"}`}
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
                    onClick={() => toggleOversight(rule)}
                    className={`w-full p-3 rounded-lg border text-left flex items-center gap-3 transition-all duration-200 ${oversight.includes(rule) ? "border-[oklch(0.85_0.15_75/50%)] bg-[oklch(0.85_0.15_75/8%)]" : "border-subtle bg-background hover:border-foreground/20"}`}
                  >
                    <Shield className={`w-4 h-4 shrink-0 ${oversight.includes(rule) ? "text-gold" : "text-muted-foreground"}`} />
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
                  <h3 className="font-display text-lg font-semibold mt-1">Deploy Digital Specialist</h3>
                </div>
                <Rocket className="w-5 h-5 text-gold" />
              </div>
              <p className="text-xs text-muted-foreground mb-4">
                {deploying ? "Creating specialist, workflows, and logging deployment..." : deployed ? `${effectiveName} is now live in your Command Center.` : "This will create a real Digital Specialist in your organization."}
              </p>

              {deployError && (
                <div className="p-3 rounded-lg bg-[oklch(0.62_0.22_25/10%)] border border-[oklch(0.62_0.22_25/30%)] text-[oklch(0.75_0.18_25)] text-xs mb-4 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{deployError}</span>
                </div>
              )}

              {deployed ? (
                <button
                  onClick={() => navigate("/app")}
                  className="w-full py-3 rounded-lg font-semibold text-sm bg-[oklch(0.75_0.18_155)] text-background hover:bg-[oklch(0.75_0.18_155/90%)] transition-all duration-200 active:scale-[0.97]"
                >
                  Open Command Center →
                </button>
              ) : (
                <button
                  onClick={handleDeploy}
                  disabled={!tasks.length || !apps.length || !oversight.length || deploying}
                  className="w-full py-3 rounded-lg font-semibold text-sm bg-gold text-background hover:bg-gold/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 active:scale-[0.97]"
                >
                  {deploying ? "Deploying..." : "Deploy Digital Specialist"}
                </button>
              )}
              {(!tasks.length || !apps.length || !oversight.length) && !deployed && (
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
                  <strong className="text-sm font-display">{effectiveName}</strong>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-semibold flex items-center gap-1.5 ${deployed ? "bg-[oklch(0.75_0.18_155/15%)] text-[oklch(0.75_0.18_155)]" : deploying ? "bg-[oklch(0.85_0.15_75/15%)] text-gold animate-pulse" : "bg-muted text-muted-foreground"}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${deployed ? "bg-[oklch(0.75_0.18_155)]" : deploying ? "bg-gold" : "bg-muted-foreground"}`} />
                  {deployed ? "Live" : deploying ? "Deploying" : "Ready"}
                </span>
              </div>

              {/* Metrics Row */}
              <div className="grid grid-cols-3 border-b border-subtle">
                <MetricCell label="Tasks Automated" value={taskCount.toString()} />
                <MetricCell label="Systems Selected" value={appCount.toString()} />
                <MetricCell label="Hours Saved / Mo" value={monthlyHours.toString()} />
              </div>

              {/* Impact Strip */}
              <div className="grid grid-cols-3 border-b border-subtle bg-background/50">
                <MetricCell label="Annual Value" value={`$${annualValue.toLocaleString()}`} accent />
                <MetricCell label="Risk Control" value={oversightCount ? `${oversightCount} gates` : "Not set"} />
                <MetricCell label="Pilot Target" value={pilotTarget} />
              </div>

              {/* Deployment Status */}
              <div className="p-4 border-b border-subtle">
                <div className={`p-3 rounded-lg border ${deployed ? "border-[oklch(0.75_0.18_155/30%)] bg-[oklch(0.75_0.18_155/5%)]" : "border-subtle bg-background"}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`w-2 h-2 rounded-full ${deployed ? "bg-[oklch(0.75_0.18_155)]" : deploying ? "bg-gold animate-pulse" : "bg-muted-foreground"}`} />
                    <strong className="text-xs">
                      {deployed ? `${effectiveName} deployed to ${organization?.name}` : deploying ? `${effectiveName} deploying...` : taskCount ? `${effectiveName} configured` : "AI role ready to configure"}
                    </strong>
                  </div>
                  <p className="text-[11px] text-muted-foreground pl-4">
                    {taskCount
                      ? `Built for ${industry}: automating ${taskCount} workflows across ${appCount} systems with ${oversightCount} human-review rules.`
                      : "Select repetitive tasks to generate the deployment preview."}
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
                  <div className="flex items-center justify-between mb-3 p-3 rounded-lg border border-subtle bg-background">
                    <div>
                      <strong className="text-xs block">
                        {simulationRunning ? `${effectiveName} is actively working.` : deployed ? "Role deployed. Start the live workstream." : "Deploy the role to start the workstream."}
                      </strong>
                      <span className="text-[10px] text-muted-foreground">
                        {simulationRunning ? "Work is moving across systems while approval-sensitive items pause." : "The Command Center will show completed work, approvals, and impact."}
                      </span>
                    </div>
                    <button
                      onClick={toggleSimulation}
                      disabled={!deployed}
                      className="px-3 py-1.5 rounded-md text-[10px] font-semibold border border-subtle bg-surface hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1"
                    >
                      {simulationRunning ? <><Pause className="w-3 h-3" /> Pause</> : <><Play className="w-3 h-3" /> Run</>}
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <div className="p-2 rounded-md bg-background border border-subtle text-center">
                      <span className="text-[9px] text-muted-foreground block">Completed</span>
                      <strong className="text-sm font-mono">{completedWork}</strong>
                    </div>
                    <div className="p-2 rounded-md bg-background border border-subtle text-center">
                      <span className="text-[9px] text-muted-foreground block">Needs Approval</span>
                      <strong className="text-sm font-mono">{approvalWork}</strong>
                    </div>
                    <div className="p-2 rounded-md bg-background border border-subtle text-center">
                      <span className="text-[9px] text-muted-foreground block">Minutes Saved</span>
                      <strong className="text-sm font-mono">{minutesSaved}</strong>
                    </div>
                  </div>

                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {liveEvents.length > 0 ? liveEvents.slice(0, 6).map((event, i) => (
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
                          <strong className="text-[11px] block">{deploying ? "Deployment running" : "Waiting for deployment"}</strong>
                          <span className="text-[10px] text-muted-foreground">{deploying ? "Creating specialist and workflows in your organization..." : "Configure and deploy to see live activity."}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </TabsContent>

                {/* Approvals Tab */}
                <TabsContent value="approvals" className="p-4 mt-0">
                  <h4 className="text-xs font-semibold mb-3">Human approval queue</h4>
                  <div className="space-y-2">
                    {deployed ? oversight.map((rule, i) => (
                      <div key={rule} className="flex items-start gap-2 p-2 rounded-md bg-background border border-subtle">
                        <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${i === 0 ? "bg-[oklch(0.85_0.15_75)]" : i === 1 ? "bg-[oklch(0.65_0.2_25)]" : "bg-[oklch(0.75_0.18_155)]"}`} />
                        <div>
                          <strong className="text-[11px] block">{rule}</strong>
                          <span className="text-[10px] text-muted-foreground">Waiting for owner approval before action.</span>
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
                      <strong className="text-base font-mono text-gold">${monthlyValue.toLocaleString()}</strong>
                    </div>
                    <div className="p-3 rounded-md bg-background border border-subtle">
                      <span className="text-[9px] text-muted-foreground block">Annual Capacity</span>
                      <strong className="text-base font-mono">{annualHours.toLocaleString()} hrs</strong>
                    </div>
                    <div className="p-3 rounded-md bg-background border border-subtle">
                      <span className="text-[9px] text-muted-foreground block">Exception Rate</span>
                      <strong className="text-base font-mono">{exceptionRate}%</strong>
                    </div>
                    <div className="p-3 rounded-md bg-background border border-subtle">
                      <span className="text-[9px] text-muted-foreground block">Payback Signal</span>
                      <strong className="text-base font-mono">{paybackSignal}</strong>
                    </div>
                  </div>
                  <p className="text-[9px] text-muted-foreground mt-3">Estimates assume repetitive operational capacity valued at $45/hour. Actual results will be measured during pilot execution.</p>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>
      </main>
    </div>
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
