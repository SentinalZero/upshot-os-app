import { useMemo, useState } from "react";
import { Pencil, RotateCcw, Save } from "lucide-react";
import { updateGmailDraft } from "@/lib/gmailDraftEditService";

interface GmailDraftEditorProps {
  organizationId: string;
  executionId: string;
  initialSubject: string;
  initialBody: string;
  approved: boolean;
  onSaved?: (subject: string, body: string, editedAt: string | null) => void;
}

export function GmailDraftEditor({ organizationId, executionId, initialSubject, initialBody, approved, onSaved }: GmailDraftEditorProps) {
  const [editing, setEditing] = useState(false);
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const [savedSubject, setSavedSubject] = useState(initialSubject);
  const [savedBody, setSavedBody] = useState(initialBody);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const dirty = useMemo(() => subject.trim() !== savedSubject.trim() || body.trim() !== savedBody.trim(), [body, savedBody, savedSubject, subject]);
  const valid = subject.trim().length > 0 && body.trim().length > 0;

  const save = async () => {
    if (!valid || !dirty || saving) return;
    setSaving(true);
    setError(null);
    const result = await updateGmailDraft(organizationId, executionId, subject, body);
    setSaving(false);
    if (!result.success || !result.subject || !result.body) {
      setError(result.error || "The Gmail draft could not be updated.");
      return;
    }
    setSubject(result.subject);
    setBody(result.body);
    setSavedSubject(result.subject);
    setSavedBody(result.body);
    setSavedAt(result.editedAt);
    setEditing(false);
    onSaved?.(result.subject, result.body, result.editedAt);
  };

  const cancel = () => {
    setSubject(savedSubject);
    setBody(savedBody);
    setError(null);
    setEditing(false);
  };

  return (
    <div className="mt-5 rounded-xl border border-subtle bg-background/55 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Email Draft</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {approved ? "Editing will return this draft to review before it can be sent." : "Edit the message and save it directly to Gmail."}
          </p>
        </div>
        {!editing && (
          <button type="button" onClick={() => setEditing(true)} className="inline-flex items-center gap-2 rounded-lg border border-subtle px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:border-gold/40 hover:text-gold">
            <Pencil className="h-3.5 w-3.5" /> Edit Draft
          </button>
        )}
      </div>

      {editing ? (
        <div className="mt-4 space-y-4">
          <label className="block">
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Subject</span>
            <input value={subject} onChange={event => setSubject(event.target.value)} maxLength={998} className="mt-2 w-full rounded-lg border border-subtle bg-background/45 px-3 py-2.5 text-sm outline-none transition-colors focus:border-gold" />
          </label>
          <label className="block">
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Message</span>
            <textarea value={body} onChange={event => setBody(event.target.value)} rows={12} maxLength={100000} className="mt-2 w-full resize-y rounded-lg border border-subtle bg-background/45 px-3 py-3 text-sm leading-6 outline-none transition-colors focus:border-gold" />
          </label>
          {error && <p className="text-xs text-[oklch(0.75_0.18_25)]">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void save()} disabled={!dirty || !valid || saving} className="inline-flex items-center gap-2 rounded-lg bg-gold px-3.5 py-2 text-xs font-semibold text-black disabled:cursor-not-allowed disabled:opacity-40">
              <Save className="h-4 w-4" /> {saving ? "Saving..." : "Save to Gmail"}
            </button>
            <button type="button" onClick={cancel} disabled={saving} className="inline-flex items-center gap-2 rounded-lg border border-subtle px-3.5 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground disabled:opacity-50">
              <RotateCcw className="h-4 w-4" /> Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Subject</p>
          <p className="mt-1 text-sm font-medium text-foreground/90">{savedSubject || "Follow up email"}</p>
          <p className="mt-5 text-[10px] uppercase tracking-wider text-muted-foreground">Email Preview</p>
          <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground/90">{savedBody || "No email body was stored for this draft."}</div>
          {savedAt && <p className="mt-4 text-[10px] text-muted-foreground">Saved to Gmail {formatDateTime(savedAt)}</p>}
        </div>
      )}
    </div>
  );
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "recently";
  return date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
