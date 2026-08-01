import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Check,
  Clock3,
  Plus,
  Sparkles,
  TrendingUp,
  Users,
  Wifi,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchDashboardData,
  subscribeToCommandCenter,
  type ActivityLog,
  type DashboardMetrics,
  type DigitalSpecialist,
  type SpecialistOperationalSummary,
} from "@/lib/supabaseService";
import { AttentionQueuePanel } from "@/components/AttentionQueuePanel";

const MINUTES_RETURNED_PER_COMPLETED_ITEM = 14;
const HOURLY_VALUE = 45;

const emptyMetrics: DashboardMetrics = {
  totalSpecialists: 0,
  activeSpecialists: 0,
  deployedWorkflows: 0,
  executionsToday: 0,
  successfulExecutionsToday: 0,
  failedExecutionsToday: 0,
  successRateToday: 0,
  needsHumanReview: 0,
};

export default function Today() {
  const { user, profile, organization } = useAuth();
  const [specialists, setSpecialists] = useState<DigitalSpecialist[]>([]);
  const [summaries, setSummaries] = useState<Record<string, SpecialistOperationalSummary>>({});
  const [activity, setActivity] = useState<ActivityLog[]>([]);
  const [metrics, setMetrics] = useState<DashboardMetrics>(emptyMetrics);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [currentTime, setCurrentTime] = useState<Date | null>(null);

  useEffect(() => {
    if (!profile?.active_organization_id) return;
    const organizationId = profile.active_organization_id;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const load = async (initial = false) => {
      initial ? setLoading(true) : setRefreshing(true);
      const data = await fetchDashboardData(organizationId);
      if (cancelled) return;
      setSpecialists(data.specialists);
      setSummaries(data.specialistSummaries);
      setActivity(data.recentActivity);
      setMetrics(data.metrics);
      setLastSyncedAt(new Date());
      setLoading(false);
      setRefreshing(false);
    };

    void load(true);
    const unsubscribe = subscribeToCommandCenter(organizationId, () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void load(false), 200);
    });

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      unsubscribe();
    };
  }, [profile?.active_organization_id]);

  useEffect(() => {
    const updateLocalTime = () => setCurrentTime(new Date());
    updateLocalTime();
    const interval = window.setInterval(updateLocalTime, 60_000);
    return () => window.clearInterval(interval);
  }, []);

  const visibleSpecialists = useMemo(() => {
    const seenRoles = new Set<string>();
    return specialists.filter(specialist => {
      const lifecycle = String(specialist.framework_lifecycle_status || specialist.status || "").toLowerCase();
      if (["inactive", "paused", "retired", "retiring", "terminated"].includes(lifecycle)) return false;

      const roleKey = String(specialist.role_name || specialist.name || specialist.id).trim().toLowerCase();
      if (seenRoles.has(roleKey)) return false;
      seenRoles.add(roleKey);
      return true;
    });
  }, [specialists]);

  const specialistNameById = useMemo(
    () => Object.fromEntries(specialists.map(specialist => [specialist.id, specialist.name])),
    [specialists],
  );

  const workingSpecialist = useMemo(
    () => visibleSpecialists.find(specialist => summaries[specialist.id]?.state === "working"),
    [visibleSpecialists, summaries],
  );

  const workingSummary = workingSpecialist ? summaries[workingSpecialist.id] : undefined;
  const completedItems = metrics.successfulExecutionsToday;
  const minutesReturned = completedItems * MINUTES_RETURNED_PER_COMPLETED_ITEM;
  const hoursReturned = Math.round((minutesReturned / 60) * 10) / 10;
  const estimatedValue = Math.round((minutesReturned / 60) * HOURLY_VALUE);
  const emailName = user?.email?.split("@")[0];
  const firstName = profile?.first_name || (emailName ? `${emailName.charAt(0).toUpperCase()}${emailName.slice(1)}` : "there");
  const recentWork = activity.slice(0, 6);
  const activeCount = visibleSpecialists.filter(specialist => {
    const state = summaries[specialist.id]?.state;
    return state === "working" || state === "idle" || state === "needs_review";
  }).length;

  const hour = currentTime?.getHours();
  const greeting = hour === undefined ? "Welcome back" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const hasCompletedWork = completedItems > 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-subtle bg-background/90 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/app" aria-label="Upshot Today">
            <img src="/assets/upshot-theory-logo.png" alt="Upshot Theory" className="h-10 w-auto" />
          </Link>
        </div>
      </header>

      <main className="container py-8 lg:py-12">
        <section className="mb-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,420px)] lg:items-end">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-gold/20 bg-gold/5 px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.16em] text-gold">
              <Sparkles className="h-3.5 w-3.5" /> Today
            </div>
            <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">{greeting}, {firstName}.</h1>
            <p className="mt-3 max-w-2xl text-base text-muted-foreground">
              {hasCompletedWork
                ? "Your Digital Workforce has already been working for you today."
                : "Your workspace is ready. Work will appear here as your Specialists complete it."}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-[10px] font-mono text-muted-foreground">
              <Wifi className="h-3.5 w-3.5 text-emerald-400" />
              <span>{refreshing ? "Syncing new work..." : "Live"}</span>
              <span>·</span>
              <span>{organization?.name || "Your organization"}</span>
              <span>·</span>
              <span>{lastSyncedAt ? `Updated ${lastSyncedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Connecting..."}</span>
            </div>
          </motion.div>

          <motion.aside initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.06 }} className="rounded-2xl border border-subtle bg-surface/70 p-5 lg:justify-self-end">
            <p className="text-[9px] font-mono uppercase tracking-[0.18em] text-gold">Workforce status</p>
            <p className="mt-2 font-display text-lg font-semibold leading-7 text-foreground">
              {metrics.needsHumanReview > 0
                ? `${metrics.needsHumanReview} item${metrics.needsHumanReview === 1 ? "" : "s"} need your judgment.`
                : "Nothing needs your attention right now."}
            </p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {metrics.needsHumanReview > 0
                ? "Everything else keeps moving while you review the exception."
                : "Your workforce is ready to keep work moving as new triggers arrive."}
            </p>
          </motion.aside>
        </section>

        {loading ? (
          <div className="grid min-h-[420px] place-items-center rounded-3xl border border-subtle bg-surface/50">
            <div className="text-center">
              <div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-gold border-t-transparent" />
              <p className="mt-3 text-xs font-mono text-muted-foreground">Reviewing today&apos;s work...</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Metric label="Hours returned" value={hoursReturned.toFixed(1)} helper="Estimated team capacity" />
              <Metric label="Completed work" value={completedItems.toLocaleString()} helper="Successful items today" />
              <Metric label="Estimated value" value={`$${estimatedValue.toLocaleString()}`} helper="At $45 per returned hour" accent />
              <Metric label="Workforce online" value={`${activeCount}/${visibleSpecialists.length}`} helper={metrics.needsHumanReview > 0 ? `${metrics.needsHumanReview} awaiting review` : "No decisions waiting"} />
            </motion.section>

            <section className="grid gap-6 xl:grid-cols-[1.12fr_0.88fr]">
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="overflow-hidden rounded-3xl border border-gold/20 bg-gradient-to-br from-gold/10 via-surface to-background p-6 lg:p-8">
                {workingSpecialist ? (
                  <>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gold font-display text-xl font-semibold text-background">{workingSpecialist.name.slice(0, 1).toUpperCase()}</div>
                        <div>
                          <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-muted-foreground">Working now</p>
                          <p className="mt-1 font-display text-2xl font-semibold">{workingSpecialist.name}</p>
                          <p className="text-sm text-muted-foreground">{workingSpecialist.role_name || "Digital Specialist"}</p>
                        </div>
                      </div>
                      <span className="inline-flex items-center gap-2 rounded-full bg-emerald-400/10 px-3 py-1.5 text-[10px] font-mono uppercase text-emerald-400"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />Working</span>
                    </div>
                    <div className="mt-8 rounded-2xl border border-subtle bg-background/55 p-5">
                      <p className="text-lg font-medium">{workingSummary?.currentJob || "Completing assigned operational work"}</p>
                      <div className="mt-4 h-2 overflow-hidden rounded-full bg-subtle"><motion.div initial={{ width: "18%" }} animate={{ width: "72%" }} transition={{ duration: 1.1, ease: "easeOut" }} className="h-full rounded-full bg-gold" /></div>
                      <p className="mt-3 text-xs text-muted-foreground">You will only be interrupted when your judgment or approval is required.</p>
                    </div>
                  </>
                ) : visibleSpecialists.length > 0 ? (
                  <div className="grid min-h-64 place-items-center text-center">
                    <div>
                      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-gold/20 bg-gold/10 text-gold"><Check className="h-6 w-6" /></div>
                      <p className="mt-5 font-display text-2xl font-semibold">Your workforce is caught up.</p>
                      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">No Specialist is actively running work right now. They remain ready for the next trigger.</p>
                    </div>
                  </div>
                ) : (
                  <div className="grid min-h-64 place-items-center text-center">
                    <div>
                      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-gold/20 bg-gold/10 text-gold"><Users className="h-6 w-6" /></div>
                      <p className="mt-5 font-display text-2xl font-semibold">Build your first Digital Specialist.</p>
                      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">Start with one role, one repeatable responsibility, and clear boundaries for human oversight.</p>
                      <Link href="/app/deploy" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gold px-4 py-2.5 text-xs font-semibold text-background"><Plus className="h-4 w-4" /> Hire Specialist</Link>
                    </div>
                  </div>
                )}

                {visibleSpecialists.length > 0 && (
                  <div className="mt-6 flex flex-wrap gap-3">
                    <Link href="/app/workforce" className="inline-flex items-center gap-2 rounded-xl border border-subtle bg-background/45 px-4 py-2.5 text-xs font-semibold hover:border-gold/30">View workforce <ArrowRight className="h-3.5 w-3.5" /></Link>
                    <Link href="/app/deploy" className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold text-gold">Hire another Specialist <ArrowRight className="h-3.5 w-3.5" /></Link>
                  </div>
                )}
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="rounded-3xl border border-subtle bg-surface p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-muted-foreground">Today&apos;s outcome</p>
                    <h2 className="mt-1 font-display text-xl font-semibold">The work you didn&apos;t have to do</h2>
                  </div>
                  <TrendingUp className="h-5 w-5 text-gold" />
                </div>
                <div className="mt-6 rounded-2xl border border-subtle bg-background/45 p-5">
                  {hasCompletedWork ? (
                    <>
                      <p className="font-display text-3xl font-semibold text-gold">{hoursReturned.toFixed(1)} hours returned</p>
                      <p className="mt-3 text-sm leading-6 text-muted-foreground">Your Digital Workforce completed {completedItems.toLocaleString()} operational item{completedItems === 1 ? "" : "s"}, creating an estimated ${estimatedValue.toLocaleString()} in returned capacity.</p>
                    </>
                  ) : (
                    <>
                      <p className="font-display text-2xl font-semibold">Your first outcome will appear here.</p>
                      <p className="mt-3 text-sm leading-6 text-muted-foreground">Upshot will summarize completed work, time returned, and estimated value using verified workflow activity.</p>
                    </>
                  )}
                </div>
                <div className="mt-5 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Successful today</span><span className="font-mono text-foreground">{metrics.successfulExecutionsToday}</span>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Needs human review</span><span className={`font-mono ${metrics.needsHumanReview > 0 ? "text-gold" : "text-foreground"}`}>{metrics.needsHumanReview}</span>
                </div>
              </motion.div>
            </section>

            <AttentionQueuePanel specialistNameById={specialistNameById} onOpenExecution={() => undefined} />

            <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
              <div className="overflow-hidden rounded-3xl border border-subtle bg-surface">
                <div className="flex items-center justify-between border-b border-subtle p-5">
                  <div><p className="text-[10px] font-mono uppercase tracking-[0.16em] text-muted-foreground">Completed today</p><h2 className="mt-1 font-display text-lg font-semibold">Work already handled</h2></div>
                  <Clock3 className="h-4 w-4 text-gold" />
                </div>
                {recentWork.length > 0 ? (
                  <div className="divide-y divide-subtle">{recentWork.map((item, index) => <ActivityItem key={item.id} item={item} specialistName={item.digital_specialist_id ? specialistNameById[item.digital_specialist_id] : undefined} index={index} />)}</div>
                ) : (
                  <div className="p-8 text-center"><Clock3 className="mx-auto h-7 w-7 text-muted-foreground" /><p className="mt-3 text-sm font-medium">No completed work yet today.</p><p className="mt-1 text-xs text-muted-foreground">Verified workflow activity will appear here as it happens.</p></div>
                )}
              </div>

              <div className="rounded-3xl border border-subtle bg-surface p-6">
                <div className="flex items-center justify-between"><div><p className="text-[10px] font-mono uppercase tracking-[0.16em] text-muted-foreground">Your digital workforce</p><h2 className="mt-1 font-display text-lg font-semibold">Ready across the organization</h2></div><Users className="h-4 w-4 text-gold" /></div>
                <div className="mt-5 space-y-3">{visibleSpecialists.slice(0, 4).map(specialist => { const summary = summaries[specialist.id]; const working = summary?.state === "working"; const needsReview = summary?.state === "needs_review"; return <div key={specialist.id} className="flex items-center justify-between gap-4 rounded-2xl border border-subtle bg-background/45 p-4"><div className="min-w-0"><p className="font-display font-semibold">{specialist.name}</p><p className="text-xs text-muted-foreground">{specialist.role_name || "Digital Specialist"}</p><p className="mt-2 truncate text-[11px] text-muted-foreground">{summary?.currentJob || "Ready for assigned work"}</p></div><span className={`shrink-0 rounded-full px-2.5 py-1 text-[9px] font-mono uppercase ${working ? "bg-emerald-400/10 text-emerald-400" : needsReview ? "bg-gold/10 text-gold" : "bg-emerald-400/10 text-emerald-400"}`}>{working ? "Working" : needsReview ? "Needs review" : "Ready"}</span></div>; })}</div>
                {visibleSpecialists.length === 0 && <div className="mt-5 rounded-2xl border border-dashed border-subtle p-6 text-center"><p className="text-sm font-medium">Every great team deserves another pair of hands.</p><Link href="/app/deploy" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gold px-4 py-2.5 text-xs font-semibold text-background"><Plus className="h-3.5 w-3.5" /> Meet your first Specialist</Link></div>}
                {visibleSpecialists.length > 0 && <Link href="/app/workforce" className="mt-5 inline-flex items-center gap-2 text-xs font-semibold text-gold">See the full workforce <ArrowRight className="h-3.5 w-3.5" /></Link>}
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

function Metric({ label, value, helper, accent = false }: { label: string; value: string; helper: string; accent?: boolean }) {
  return <div className="rounded-2xl border border-subtle bg-surface p-4"><p className="text-[9px] font-mono uppercase leading-4 text-muted-foreground">{label}</p><p className={`mt-2 font-display text-2xl font-semibold ${accent ? "text-gold" : ""}`}>{value}</p><p className="mt-2 text-[10px] text-muted-foreground">{helper}</p></div>;
}

function ActivityItem({ item, specialistName, index }: { item: ActivityLog; specialistName?: string; index: number }) {
  const title = item.title || item.message || "Operational work completed";
  const detail = item.description || item.message || item.activity_type || item.event_type || "Work recorded";
  const createdAt = item.created_at ? new Date(item.created_at) : null;
  const time = createdAt && !Number.isNaN(createdAt.getTime()) ? createdAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Today";
  return <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.04 * index }} className="flex gap-4 p-5"><div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-400/10 text-emerald-400"><Check className="h-3.5 w-3.5" /></div><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><p className="text-sm font-semibold">{title}</p><span className="whitespace-nowrap text-[9px] font-mono text-muted-foreground">{time}</span></div><p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{detail}</p>{specialistName && <p className="mt-2 text-[10px] text-gold">Completed by {specialistName}</p>}</div></motion.div>;
}
