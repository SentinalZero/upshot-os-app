import { useState } from "react";
import { AlertTriangle, PauseCircle, PlayCircle, Trash2, X } from "lucide-react";
import type { SpecialistLifecycleAction } from "@/lib/specialistLifecycleService";

interface SpecialistLifecyclePanelProps {
  specialistName: string;
  specialistStatus?: string | null;
  canManage: boolean;
  capabilities: number;
  integrations: number;
  jobs: number;
  actionLoading: boolean;
  actionError: string | null;
  onAction: (action: SpecialistLifecycleAction) => Promise<void>;
}

export function SpecialistLifecyclePanel({
  specialistName,
  specialistStatus,
  canManage,
  capabilities,
  integrations,
  jobs,
  actionLoading,
  actionError,
  onAction,
}: SpecialistLifecyclePanelProps) {
  const [pendingAction, setPendingAction] = useState<SpecialistLifecycleAction | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const inactive = ["inactive", "paused", "retired", "terminated"].includes((specialistStatus || "").toLowerCase());
  const deleteEligible = capabilities === 0 && integrations === 0 && jobs === 0;

  const begin = (action: SpecialistLifecycleAction) => {
    setConfirmation("");
    setPendingAction(action);
  };

  const close = () => {
    if (actionLoading) return;
    setConfirmation("");
    setPendingAction(null);
  };

  const confirmationWord = pendingAction ? actionConfirmationWord(pendingAction) : "";
  const confirmed = confirmation.trim().toUpperCase() === confirmationWord;

  return (
    <section className="rounded-xl border border-[oklch(0.62_0.22_25/30%)] bg-[oklch(0.62_0.22_25/5%)] p-5">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[oklch(0.75_0.18_25)]" />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-mono uppercase tracking-wider text-[oklch(0.75_0.18_25)]">Specialist Settings</p>
          <h3 className="mt-1 font-display text-lg font-semibold">Lifecycle controls</h3>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            Deactivation stops future work and preserves job history. Permanent deletion is available only when this specialist has no capabilities, connected systems, or execution history.
          </p>

          {!canManage && (
            <div className="mt-4 rounded-lg border border-subtle bg-background/35 p-4 text-xs text-muted-foreground">
              Only organization owners and admins can change Digital Specialist lifecycle settings.
            </div>
          )}

          {canManage && (
            <div className="mt-5 flex flex-wrap gap-3">
              {inactive ? (
                <button type="button" onClick={() => begin("reactivate")} className="inline-flex items-center gap-2 rounded-lg border border-[oklch(0.75_0.18_155/35%)] px-4 py-2 text-xs font-semibold text-[oklch(0.75_0.18_155)] transition-colors hover:bg-[oklch(0.75_0.18_155/8%)]">
                  <PlayCircle className="h-4 w-4" /> Reactivate Specialist
                </button>
              ) : (
                <button type="button" onClick={() => begin("deactivate")} className="inline-flex items-center gap-2 rounded-lg border border-[oklch(0.75_0.18_75/35%)] px-4 py-2 text-xs font-semibold text-[oklch(0.78_0.16_75)] transition-colors hover:bg-[oklch(0.75_0.18_75/8%)]">
                  <PauseCircle className="h-4 w-4" /> Deactivate Specialist
                </button>
              )}
              <button
                type="button"
                onClick={() => begin("delete")}
                disabled={!deleteEligible}
                className="inline-flex items-center gap-2 rounded-lg border border-[oklch(0.62_0.22_25/40%)] px-4 py-2 text-xs font-semibold text-[oklch(0.75_0.18_25)] transition-colors hover:bg-[oklch(0.62_0.22_25/8%)] disabled:cursor-not-allowed disabled:opacity-40"
                title={deleteEligible ? "Permanently delete specialist" : "Deactivate instead. Retained records prevent permanent deletion."}
              >
                <Trash2 className="h-4 w-4" /> Delete Permanently
              </button>
            </div>
          )}

          {canManage && !deleteEligible && (
            <p className="mt-3 text-[10px] text-muted-foreground">
              Permanent deletion unavailable: {capabilities} capabilities, {integrations} systems, and {jobs} jobs are retained.
            </p>
          )}
        </div>
      </div>

      {pendingAction && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/75 p-4" onMouseDown={close}>
          <div className="w-full max-w-md rounded-2xl border border-subtle bg-background p-6 shadow-2xl" onMouseDown={event => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-mono uppercase tracking-wider text-gold">Confirm Action</p>
                <h3 className="mt-1 font-display text-xl font-semibold">{actionTitle(pendingAction)}</h3>
              </div>
              <button type="button" onClick={close} disabled={actionLoading} className="rounded-lg border border-subtle p-2 text-muted-foreground hover:text-foreground disabled:opacity-50"><X className="h-4 w-4" /></button>
            </div>

            <p className="mt-4 text-xs leading-5 text-muted-foreground">{actionDescription(pendingAction, specialistName)}</p>
            <label className="mt-5 block text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              Type <span className="font-semibold text-foreground">{confirmationWord}</span> to confirm
            </label>
            <input
              value={confirmation}
              onChange={event => setConfirmation(event.target.value)}
              disabled={actionLoading}
              autoComplete="off"
              spellCheck={false}
              placeholder={confirmationWord}
              className="mt-2 w-full rounded-lg border border-subtle bg-surface px-3 py-2.5 text-sm uppercase outline-none transition-colors focus:border-gold disabled:opacity-60"
              autoFocus
            />

            {actionError && <p className="mt-3 text-xs text-[oklch(0.75_0.18_25)]">{actionError}</p>}

            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={close} disabled={actionLoading} className="rounded-lg border border-subtle px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground disabled:opacity-50">Cancel</button>
              <button
                type="button"
                disabled={!confirmed || actionLoading}
                onClick={() => void onAction(pendingAction)}
                className="rounded-lg bg-[oklch(0.62_0.22_25)] px-4 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                {actionLoading ? "Working..." : actionButton(pendingAction)}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function actionConfirmationWord(action: SpecialistLifecycleAction): string {
  if (action === "delete") return "DELETE";
  if (action === "reactivate") return "REACTIVATE";
  return "DEACTIVATE";
}

function actionTitle(action: SpecialistLifecycleAction): string {
  if (action === "delete") return "Delete this specialist permanently?";
  if (action === "reactivate") return "Reactivate this specialist?";
  return "Deactivate this specialist?";
}

function actionDescription(action: SpecialistLifecycleAction, name: string): string {
  if (action === "delete") return `${name} will be permanently removed. This cannot be undone.`;
  if (action === "reactivate") return `${name} will return to active status. Capabilities and business systems may still need to be reconnected or enabled.`;
  return `${name} will stop receiving future work. Existing history remains available for reporting and audit purposes.`;
}

function actionButton(action: SpecialistLifecycleAction): string {
  if (action === "delete") return "Delete Permanently";
  if (action === "reactivate") return "Reactivate";
  return "Deactivate";
}
