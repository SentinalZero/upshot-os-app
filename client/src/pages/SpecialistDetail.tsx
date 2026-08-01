import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { AlertTriangle, ArrowLeft, Bot, Check, Loader2, Power, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import type { DigitalSpecialist } from "@/lib/supabaseService";

interface SpecialistRecord extends DigitalSpecialist {
  description?: string | null;
  configuration?: Record<string, unknown> | null;
}

export default function SpecialistDetail() {
  const { profile } = useAuth();
  const [, navigate] = useLocation();
  const [, params] = useRoute("/app/workforce/:specialistId");
  const specialistId = params?.specialistId;
  const organizationId = profile?.active_organization_id;
  const [specialist, setSpecialist] = useState<SpecialistRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [retiring, setRetiring] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!supabase || !specialistId || !organizationId) return;
    let cancelled = false;
    setLoading(true);
    void supabase
      .from("digital_specialists")
      .select("id, organization_id, name, role_name, industry_name, status, framework_lifecycle_status, oversight_mode, selected_systems, deployed_at, created_at, description, configuration")
      .eq("id", specialistId)
      .eq("organization_id", organizationId)
      .single()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("[SpecialistDetail] load error", error);
          setSpecialist(null);
        } else {
          setSpecialist(data as SpecialistRecord);
        }
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [organizationId, specialistId]);

  const responsibilities = useMemo(() => {
    const value = specialist?.configuration?.tasks;
    return Array.isArray(value) ? value.filter(item => typeof item === "string") as string[] : [];
  }, [specialist]);

  const systems = specialist?.selected_systems || [];
  const isRetired = ["retired", "inactive", "terminated"].includes(String(specialist?.framework_lifecycle_status || specialist?.status || "").toLowerCase());

  const retireSpecialist = async () => {
    if (!supabase || !specialist || !organizationId) return;
    setRetiring(true);
    const { error } = await supabase
      .from("digital_specialists")
      .update({ framework_lifecycle_status: "retired", status: "inactive" })
      .eq("id", specialist.id)
      .eq("organization_id", organizationId);

    if (error) {
      toast.error(error.message || "Could not retire this Specialist.");
      setRetiring(false);
      return;
    }

    toast.success(`${specialist.name} has been retired.`);
    navigate("/app/workforce");
  };

  if (loading) return <div className="grid min-h-[60vh] place-items-center"><Loader2 className="h-7 w-7 animate-spin text-gold" /></div>;

  if (!specialist) {
    return <div className="container py-12"><Link href="/app/workforce" className="inline-flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4" /> Back to Workforce</Link><div className="mt-8 rounded-3xl border border-subtle bg-surface p-10 text-center"><h1 className="font-display text-2xl font-semibold">Specialist not found</h1><p className="mt-2 text-sm text-muted-foreground">This Specialist is not available in the current workspace.</p></div></div>;
  }

  return (
    <main className="container py-8 lg:py-12">
      <Link href="/app/workforce" className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Back to Workforce</Link>
      <section className="mt-6 overflow-hidden rounded-3xl border border-subtle bg-surface">
        <div className="flex flex-col gap-6 border-b border-subtle p-6 lg:flex-row lg:items-center lg:justify-between lg:p-8">
          <div className="flex items-center gap-4"><div className="grid h-16 w-16 place-items-center rounded-2xl bg-gold/10 text-gold"><Bot className="h-8 w-8" /></div><div><p className="text-[10px] font-mono uppercase tracking-[0.18em] text-gold">Digital Specialist</p><h1 className="mt-1 font-display text-3xl font-semibold">{specialist.name}</h1><p className="mt-1 text-sm text-muted-foreground">{specialist.role_name || "Digital Specialist"}</p></div></div>
          <span className={`w-fit rounded-full px-3 py-1.5 text-[10px] font-mono uppercase ${isRetired ? "bg-muted text-muted-foreground" : "bg-emerald-400/10 text-emerald-400"}`}>{isRetired ? "Retired" : "Ready"}</span>
        </div>
        <div className="grid gap-6 p-6 lg:grid-cols-2 lg:p-8">
          <DetailCard title="Mission"><p className="text-sm leading-6 text-muted-foreground">{specialist.description || `Support ${specialist.role_name || "assigned operational"} work across connected systems while preserving human judgment where it matters.`}</p></DetailCard>
          <DetailCard title="Human oversight"><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 text-gold" /><p className="text-sm leading-6 text-muted-foreground">{formatOversight(specialist.oversight_mode)}</p></div></DetailCard>
          <DetailCard title="Responsibilities">{responsibilities.length > 0 ? <ItemList items={responsibilities} /> : <p className="text-sm text-muted-foreground">No responsibilities have been recorded yet.</p>}</DetailCard>
          <DetailCard title="Connected systems">{systems.length > 0 ? <ItemList items={systems} /> : <p className="text-sm text-muted-foreground">No systems are currently assigned.</p>}</DetailCard>
        </div>
      </section>
      {!isRetired && <section className="mt-6 rounded-3xl border border-red-400/20 bg-red-400/5 p-6 lg:p-8"><div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between"><div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 h-5 w-5 text-red-400" /><div><h2 className="font-display text-lg font-semibold">Retire this Specialist</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">Retiring removes this Specialist from Today and the active Workforce view. Historical activity and completed work remain preserved.</p></div></div>{!confirming ? <button onClick={() => setConfirming(true)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-400/30 px-4 py-2.5 text-sm font-semibold text-red-300 hover:bg-red-400/10"><Power className="h-4 w-4" /> Retire Specialist</button> : <div className="flex flex-wrap gap-2"><button onClick={() => setConfirming(false)} disabled={retiring} className="rounded-xl border border-subtle px-4 py-2.5 text-sm text-muted-foreground">Cancel</button><button onClick={retireSpecialist} disabled={retiring} className="inline-flex items-center gap-2 rounded-xl bg-red-500 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{retiring ? <Loader2 className="h-4 w-4 animate-spin" /> : <Power className="h-4 w-4" />} Confirm retirement</button></div>}</div></section>}
    </main>
  );
}

function DetailCard({ title, children }: { title: string; children: React.ReactNode }) { return <div className="rounded-2xl border border-subtle bg-background/35 p-5"><p className="mb-3 text-[10px] font-mono uppercase tracking-[0.16em] text-muted-foreground">{title}</p>{children}</div>; }
function ItemList({ items }: { items: readonly string[] }) { return <div className="space-y-2">{items.map(item => <div key={item} className="flex items-start gap-2 text-sm"><Check className="mt-0.5 h-4 w-4 shrink-0 text-gold" /><span>{item}</span></div>)}</div>; }
function formatOversight(value?: string | null): string { if (value === "autonomous") return "Works independently within configured authority and escalates only when required."; if (value === "escalation_only") return "Continues routine work and pauses when an escalation condition is detected."; return "Prepares and coordinates work, then pauses for approval where human judgment is required."; }
