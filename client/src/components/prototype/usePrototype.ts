import { useState, useCallback, useRef, useEffect } from "react";
import { prototypeData, IndustryKey, Role, LiveEvent } from "./prototypeData";

export interface PrototypeState {
  industry: IndustryKey;
  role: Role;
  tasks: string[];
  apps: string[];
  oversight: string[];
  deployed: boolean;
  deploying: boolean;
  simulationRunning: boolean;
  completedWork: number;
  approvalWork: number;
  minutesSaved: number;
  liveEvents: LiveEvent[];
}

export function usePrototype() {
  const [state, setState] = useState<PrototypeState>({
    industry: "Logistics",
    role: prototypeData.roles[0],
    tasks: [],
    apps: [],
    oversight: prototypeData.industries["Logistics"].approvalTemplates.slice(0, 2),
    deployed: false,
    deploying: false,
    simulationRunning: false,
    completedWork: 0,
    approvalWork: 0,
    minutesSaved: 0,
    liveEvents: [],
  });

  const simulationTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (simulationTimer.current) clearInterval(simulationTimer.current);
    };
  }, []);

  const setIndustry = useCallback((industry: IndustryKey) => {
    setState(prev => ({
      ...prev,
      industry,
      oversight: prototypeData.industries[industry].approvalTemplates.slice(0, 2),
      deployed: false,
      deploying: false,
      simulationRunning: false,
      completedWork: 0,
      approvalWork: 0,
      minutesSaved: 0,
      liveEvents: [],
    }));
    if (simulationTimer.current) {
      clearInterval(simulationTimer.current);
      simulationTimer.current = null;
    }
  }, []);

  const setRole = useCallback((role: Role) => {
    setState(prev => ({
      ...prev,
      role,
      tasks: [],
      deployed: false,
      deploying: false,
      simulationRunning: false,
      completedWork: 0,
      approvalWork: 0,
      minutesSaved: 0,
      liveEvents: [],
    }));
    if (simulationTimer.current) {
      clearInterval(simulationTimer.current);
      simulationTimer.current = null;
    }
  }, []);

  const toggleTask = useCallback((task: string) => {
    setState(prev => {
      const tasks = prev.tasks.includes(task)
        ? prev.tasks.filter(t => t !== task)
        : [...prev.tasks, task];
      return { ...prev, tasks, deployed: false, simulationRunning: false, completedWork: 0, approvalWork: 0, minutesSaved: 0, liveEvents: [] };
    });
    if (simulationTimer.current) {
      clearInterval(simulationTimer.current);
      simulationTimer.current = null;
    }
  }, []);

  const toggleApp = useCallback((app: string) => {
    setState(prev => {
      const apps = prev.apps.includes(app)
        ? prev.apps.filter(a => a !== app)
        : [...prev.apps, app];
      return { ...prev, apps, deployed: false, simulationRunning: false, completedWork: 0, approvalWork: 0, minutesSaved: 0, liveEvents: [] };
    });
    if (simulationTimer.current) {
      clearInterval(simulationTimer.current);
      simulationTimer.current = null;
    }
  }, []);

  const toggleOversight = useCallback((rule: string) => {
    setState(prev => {
      const oversight = prev.oversight.includes(rule)
        ? prev.oversight.filter(r => r !== rule)
        : [...prev.oversight, rule];
      return { ...prev, oversight, deployed: false, simulationRunning: false, completedWork: 0, approvalWork: 0, minutesSaved: 0, liveEvents: [] };
    });
    if (simulationTimer.current) {
      clearInterval(simulationTimer.current);
      simulationTimer.current = null;
    }
  }, []);

  const applyScenario = useCallback((industry: IndustryKey) => {
    const scenario = prototypeData.scenarios[industry];
    if (!scenario) return;
    const role = prototypeData.roles.find(r => r.name === scenario.role) || prototypeData.roles[0];
    setState(prev => ({
      ...prev,
      industry,
      role,
      tasks: [...scenario.tasks],
      apps: [...scenario.apps],
      oversight: prototypeData.industries[industry].approvalTemplates.slice(0, 2),
      deployed: false,
      deploying: false,
      simulationRunning: false,
      completedWork: 0,
      approvalWork: 0,
      minutesSaved: 0,
      liveEvents: [],
    }));
    if (simulationTimer.current) {
      clearInterval(simulationTimer.current);
      simulationTimer.current = null;
    }
  }, []);

  const deploy = useCallback(() => {
    setState(prev => {
      if (!prev.tasks.length || !prev.apps.length || !prev.oversight.length) return prev;
      return { ...prev, deploying: true, deployed: false, simulationRunning: false, completedWork: 0, approvalWork: 0, minutesSaved: 0, liveEvents: [] };
    });
    if (simulationTimer.current) {
      clearInterval(simulationTimer.current);
      simulationTimer.current = null;
    }
    setTimeout(() => {
      setState(prev => {
        if (!prev.deploying) return prev;
        const task = prev.tasks[0] || prev.role.tasks[0];
        const app = prev.apps[0] || prev.role.defaultApps[0] || "connected system";
        const rule = prev.oversight[0] || "Human review";
        const seedEvents: LiveEvent[] = [
          { type: "complete", title: `${task} completed`, detail: `${prev.role.name} executed the workflow through ${app} and logged the outcome.` },
          { type: "approval", title: `${rule} paused for approval`, detail: "Upshot OS prepared the action, attached context, and stopped before sending." },
          { type: "complete", title: "Manager summary created", detail: `Capacity impact, open exceptions, and next best actions recorded for ${prev.industry}.` },
          { type: "complete", title: "Audit trail updated", detail: "Every automated step was captured for review during the MVP pilot." },
        ];
        return { ...prev, deploying: false, deployed: true, completedWork: 3, approvalWork: 1, minutesSaved: 42, liveEvents: seedEvents };
      });
    }, 950);
  }, []);

  const toggleSimulation = useCallback(() => {
    setState(prev => {
      if (!prev.deployed) return prev;
      const running = !prev.simulationRunning;
      if (!running && simulationTimer.current) {
        clearInterval(simulationTimer.current);
        simulationTimer.current = null;
      }
      if (running) {
        simulationTimer.current = setInterval(() => {
          setState(s => {
            const task = s.tasks[Math.floor(Math.random() * s.tasks.length)] || s.role.tasks[0];
            const app = s.apps[Math.floor(Math.random() * s.apps.length)] || "connected system";
            const rule = s.oversight[Math.floor(Math.random() * s.oversight.length)] || "Human review";
            const needsApproval = Math.random() < 0.32;
            const event: LiveEvent = needsApproval
              ? { type: "approval", title: `${rule} requires review`, detail: `${s.role.name} prepared the action but paused for owner approval.` }
              : { type: "complete", title: `${task} completed`, detail: `Read context, executed the step, and updated ${app}.` };
            return {
              ...s,
              liveEvents: [event, ...s.liveEvents].slice(0, 10),
              completedWork: needsApproval ? s.completedWork : s.completedWork + 1,
              approvalWork: needsApproval ? s.approvalWork + 1 : s.approvalWork,
              minutesSaved: s.minutesSaved + (needsApproval ? 8 : 14),
            };
          });
        }, 1800);
      }
      return { ...prev, simulationRunning: running };
    });
  }, []);

  // Computed values
  const taskCount = state.tasks.length;
  const appCount = state.apps.length;
  const oversightCount = state.oversight.length;
  const monthlyHours = Math.max(0, taskCount * 9 + appCount * 3 + oversightCount * 2);
  const monthlyValue = monthlyHours * 45;
  const annualHours = monthlyHours * 12;
  const annualValue = monthlyValue * 12;
  const exceptionRate = taskCount ? Math.min(34, Math.max(8, oversightCount * 7 + Math.round((oversightCount / Math.max(taskCount, 1)) * 10))) : 0;
  const paybackSignal = monthlyValue >= 1500 ? "Strong" : taskCount ? "Emerging" : "Pilot-ready";
  const pilotTarget = taskCount >= 3 && appCount >= 2 ? "14 days" : "Configure";

  return {
    state,
    computed: { taskCount, appCount, oversightCount, monthlyHours, monthlyValue, annualHours, annualValue, exceptionRate, paybackSignal, pilotTarget },
    actions: { setIndustry, setRole, toggleTask, toggleApp, toggleOversight, applyScenario, deploy, toggleSimulation },
  };
}
