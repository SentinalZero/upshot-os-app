import { useMemo, useState } from "react";
import { CheckCircle2, MessageSquareText, XCircle } from "lucide-react";
import { reviewWorkflowOutput, type WorkflowReviewAction, type WorkflowReviewRecord } from "@/lib/workflowReviewService";

interface DraftReviewActionsProps {
  organizationId: string;
  executionId: string;
  initialReview?: WorkflowReviewRecord | null;
}

export function DraftReviewActions({ organizationId, executionId, initialReview }: DraftReviewActionsProps) {
  const [review, setReview] = useState<WorkflowReviewRecord | null>(initialReview || null);
  const [note, setNote] = useState(initialReview?.note || "");
  const [loading, setLoading] = useState<WorkflowReviewAction | null>(null);
  const [error, setError] = useState<string | null>(null);

  const statusLabel = useMemo(() => {
    if (!review) return "Ready for review";
    if (review.status === "approved") return "Approved";
    if (review.status === "changes_requested") return "Changes requested";
    return "Dismissed";
  }, [review]);

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
  };

  return (
    <div className="mt-5 border-t border-subtle pt-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Human Review</p>
          <p className="mt-1 text-xs font-semibold">{statusLabel}</p>
          {review?.reviewed_at && (
            <p className="mt-1 text-[10px] text-muted-foreground">Updated {formatDateTime(review.reviewed_at)}</p>
          )}
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[9px] font-mono font-semibold uppercase tracking-wider ${statusClass(review?.status)}`}>
          {statusLabel}
        </span>
      </div>

      <label className="mt-4 block text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
        Reviewer note
      </label>
      <textarea
        value={note}
        onChange={event => setNote(event.target.value)}
        rows={3}
        placeholder="Add context for approval or requested changes"
        className="mt-2 w-full resize-none rounded-lg border border-subtle bg-background/40 px-3 py-2.5 text-xs leading-5 outline-none transition-colors focus:border-gold"
      />

      {error && <p className="mt-3 text-xs text-[oklch(0.75_0.18_25)]">{error}</p>}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void submit("approve")}
          disabled={loading !== null}
          className="inline-flex items-center gap-2 rounded-lg bg-[oklch(0.75_0.18_155)] px-3.5 py-2 text-xs font-semibold text-black transition-opacity disabled:opacity-50"
        >
          <CheckCircle2 className="h-4 w-4" />
          {loading === "approve" ? "Approving..." : "Approve Draft"}
        </button>
        <button
          type="button"
          onClick={() => void submit("request_changes")}
          disabled={loading !== null}
          className="inline-flex items-center gap-2 rounded-lg border border-gold/35 px-3.5 py-2 text-xs font-semibold text-gold transition-colors hover:bg-gold/8 disabled:opacity-50"
        >
          <MessageSquareText className="h-4 w-4" />
          {loading === "request_changes" ? "Saving..." : "Request Changes"}
        </button>
        <button
          type="button"
          onClick={() => void submit("dismiss")}
          disabled={loading !== null}
          className="inline-flex items-center gap-2 rounded-lg border border-subtle px-3.5 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
        >
          <XCircle className="h-4 w-4" />
          {loading === "dismiss" ? "Saving..." : "Dismiss"}
        </button>
      </div>

      <p className="mt-3 text-[10px] leading-4 text-muted-foreground">
        Approval records the decision only. It does not send the email.
      </p>
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
