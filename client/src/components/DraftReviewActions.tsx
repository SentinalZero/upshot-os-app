import { useMemo, useState } from "react";
import { CheckCircle2, Mail, MessageSquareText, XCircle } from "lucide-react";
import { reviewWorkflowOutput, type WorkflowReviewAction, type WorkflowReviewRecord } from "@/lib/workflowReviewService";
import { sendApprovedGmailDraft } from "@/lib/gmailDraftSendService";

interface DraftReviewActionsProps {
  organizationId: string;
  executionId: string;
  initialReview?: WorkflowReviewRecord | null;
  recipients?: string[];
  subject?: string;
  initialSentAt?: string | null;
}

export function DraftReviewActions({ organizationId, executionId, initialReview, recipients = [], subject = "Follow up email", initialSentAt }: DraftReviewActionsProps) {
  const [review, setReview] = useState<WorkflowReviewRecord | null>(initialReview || null);
  const [note, setNote] = useState(initialReview?.note || "");
  const [loading, setLoading] = useState<WorkflowReviewAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmingSend, setConfirmingSend] = useState(false);
  const [sending, setSending] = useState(false);
  const [sentAt, setSentAt] = useState<string | null>(initialSentAt || null);

  const statusLabel = useMemo(() => {
    if (sentAt) return "Sent";
    if (!review) return "Ready for review";
    if (review.status === "approved") return "Approved";
    if (review.status === "changes_requested") return "Changes requested";
    return "Dismissed";
  }, [review, sentAt]);

  const submit = async (action: WorkflowReviewAction) => {
    setLoading(action);
    setError(null);
    const result = await reviewWorkflowOutput(organizationId, executionId, action, note);
    setLoading(null);
    if (!result.success || !result.review) {
      setError(result.error || "The review could not be saved.");
      return;
    }
    setReview(result.review);
    setConfirmingSend(false);
  };

  const send = async () => {
    if (sending || review?.status !== "approved" || sentAt) return;
    setSending(true);
    setError(null);
    const result = await sendApprovedGmailDraft(organizationId, executionId);
    setSending(false);
    if (!result.success || !result.sentAt) {
      setError(result.error || "The approved email could not be sent.");
      return;
    }
    setSentAt(result.sentAt);
    setConfirmingSend(false);
  };

  return (
    <div className="mt-5 border-t border-subtle pt-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Human Review</p>
          <p className="mt-1 text-xs font-semibold">{statusLabel}</p>
          {sentAt ? <p className="mt-1 text-[10px] text-muted-foreground">Sent {formatDateTime(sentAt)}</p> : review?.reviewed_at ? <p className="mt-1 text-[10px] text-muted-foreground">Updated {formatDateTime(review.reviewed_at)}</p> : null}
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[9px] font-mono font-semibold uppercase tracking-wider ${sentAt ? "bg-[oklch(0.75_0.18_155/15%)] text-[oklch(0.75_0.18_155)]" : statusClass(review?.status)}`}>
          {statusLabel}
        </span>
      </div>

      {!sentAt && (
        <>
          <label className="mt-4 block text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Reviewer note</label>
          <textarea value={note} onChange={event => setNote(event.target.value)} rows={3} placeholder="Add context for approval or requested changes" className="mt-2 w-full resize-none rounded-lg border border-subtle bg-background/40 px-3 py-2.5 text-xs leading-5 outline-none transition-colors focus:border-gold" />
        </>
      )}

      {error && <p className="mt-3 text-xs text-[oklch(0.75_0.18_25)]">{error}</p>}

      {!sentAt && review?.status !== "approved" && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={() => void submit("approve")} disabled={loading !== null} className="inline-flex items-center gap-2 rounded-lg bg-[oklch(0.75_0.18_155)] px-3.5 py-2 text-xs font-semibold text-black transition-opacity disabled:opacity-50"><CheckCircle2 className="h-4 w-4" />{loading === "approve" ? "Approving..." : "Approve Draft"}</button>
          <button type="button" onClick={() => void submit("request_changes")} disabled={loading !== null} className="inline-flex items-center gap-2 rounded-lg border border-gold/35 px-3.5 py-2 text-xs font-semibold text-gold transition-colors hover:bg-gold/8 disabled:opacity-50"><MessageSquareText className="h-4 w-4" />{loading === "request_changes" ? "Saving..." : "Request Changes"}</button>
          <button type="button" onClick={() => void submit("dismiss")} disabled={loading !== null} className="inline-flex items-center gap-2 rounded-lg border border-subtle px-3.5 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"><XCircle className="h-4 w-4" />{loading === "dismiss" ? "Saving..." : "Dismiss"}</button>
        </div>
      )}

      {!sentAt && review?.status === "approved" && !confirmingSend && (
        <div className="mt-4 rounded-xl border border-[oklch(0.75_0.18_155/25%)] bg-[oklch(0.75_0.18_155/6%)] p-4">
          <p className="text-xs font-semibold">Approved and ready to send</p>
          <p className="mt-1 text-[10px] leading-4 text-muted-foreground">Sending is a separate action and cannot be undone.</p>
          <button type="button" onClick={() => setConfirmingSend(true)} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-gold px-3.5 py-2 text-xs font-semibold text-black"><Mail className="h-4 w-4" />Send Email</button>
        </div>
      )}

      {!sentAt && review?.status === "approved" && confirmingSend && (
        <div className="mt-4 rounded-xl border border-gold/35 bg-gold/5 p-4">
          <p className="text-xs font-semibold">Send this approved email?</p>
          <p className="mt-2 text-[10px] text-muted-foreground">To: {recipients.length ? recipients.join(", ") : "Recorded recipients"}</p>
          <p className="mt-1 text-[10px] text-muted-foreground">Subject: {subject}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={() => void send()} disabled={sending} className="inline-flex items-center gap-2 rounded-lg bg-gold px-3.5 py-2 text-xs font-semibold text-black disabled:opacity-50"><Mail className="h-4 w-4" />{sending ? "Sending..." : "Confirm Send"}</button>
            <button type="button" onClick={() => setConfirmingSend(false)} disabled={sending} className="rounded-lg border border-subtle px-3.5 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground disabled:opacity-50">Cancel</button>
          </div>
        </div>
      )}

      {sentAt && <div className="mt-4 rounded-xl border border-[oklch(0.75_0.18_155/30%)] bg-[oklch(0.75_0.18_155/8%)] p-4"><div className="flex items-center gap-2 text-[oklch(0.75_0.18_155)]"><CheckCircle2 className="h-4 w-4" /><p className="text-xs font-semibold">Email sent successfully</p></div><p className="mt-2 text-[10px] text-muted-foreground">This message was sent from the connected Gmail account.</p></div>}
    </div>
  );
}

function statusClass(status?: WorkflowReviewRecord["status"]): string {
  if (status === "approved") return "bg-[oklch(0.75_0.18_155/15%)] text-[oklch(0.75_0.18_155)]";
  if (status === "changes_requested") return "bg-gold/10 text-gold";
  if (status === "dismissed") return "bg-muted/50 text-muted-foreground";
  return "border border-subtle text-muted-foreground";
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "recently";
  return date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
