import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, Clock3, ListChecks, MailCheck, X } from "lucide-react";
import type { WorkflowExecutionDetail } from "@/lib/executionDetailService";
import { DraftReviewActions } from "@/components/DraftReviewActions";
import { GmailDraftEditor } from "@/components/GmailDraftEditor";
import type { WorkflowReviewRecord } from "@/lib/workflowReviewService";

interface ExecutionDetailModalProps {
  detail: WorkflowExecutionDetail | null;
  loading: boolean;
  error: string | null;
  activityTitle: string;
  specialistName?: string;
  onClose: () => void;
}

export function ExecutionDetailModal({ detail, loading, error, activityTitle, specialistName, onClose }: ExecutionDetailModalProps) {
  const [emailOpen, setEmailOpen] = useState(true);
  const [reviewReset, setReviewReset] = useState(false);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const output = detail?.output_summary || {};
  const input = detail?.input_payload || {};
  const metadata = detail?.trigger_metadata || {};
  const keyPoints = stringList(output.key_points);
  const actionItems = stringList(output.action_items);
  const meetingTitle = stringValue(output.meeting_title) || stringValue(input.title) || activityTitle;
  const isSuccessful = detail?.status?.toLowerCase() === "successful";
  const isFailed = detail?.status?.toLowerCase() === "failed";
  const followUpEmail = objectValue(output.follow_up_email);
  const gmailDraft = objectValue(output.gmail_draft);
  const gmailRecipients = stringList(gmailDraft.recipients).length > 0 ? stringList(gmailDraft.recipients) : stringList(metadata.gmail_draft_recipients);
  const gmailSubject = stringValue(metadata.gmail_draft_subject) || stringValue(gmailDraft.subject) || stringValue(followUpEmail.subject);
  const gmailBody = stringValue(metadata.gmail_draft_body) || stringValue(followUpEmail.body) || stringValue(gmailDraft.body);
  const gmailDraftId = stringValue(gmailDraft.draft_id) || stringValue(metadata.gmail_draft_id);
  const gmailCreatedAt = stringValue(metadata.gmail_draft_created_at);
  const gmailSentAt = stringValue(metadata.gmail_sent_at);
  const hasGmailDraft = Boolean(gmailDraftId || gmailSubject || gmailRecipients.length > 0 || gmailBody);
  const reviewCandidate = objectValue(metadata.human_review);
  const storedReview = isReviewRecord(reviewCandidate) ? reviewCandidate : null;
  const initialReview = reviewReset ? null : storedReview;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-6" onMouseDown={onClose}>
      <section role="dialog" aria-modal="true" aria-label="Workflow execution details" className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl border border-subtle bg-background shadow-2xl sm:max-w-3xl sm:rounded-2xl" onMouseDown={event => event.stopPropagation()}>
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-subtle bg-background/95 p-5 backdrop-blur-xl sm:p-6">
          <div className="min-w-0">
            <p className="text-[10px] font-mono uppercase tracking-wider text-gold">Job Details</p>
            <h2 className="mt-1 truncate font-display text-xl font-semibold sm:text-2xl">{meetingTitle}</h2>
            <p className="mt-1 text-xs text-muted-foreground">{specialistName || "Digital Specialist"}{detail?.completed_at ? ` · Completed ${formatDateTime(detail.completed_at)}` : ""}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg border border-subtle p-2 text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground" aria-label="Close job details"><X className="h-4 w-4" /></button>
        </header>

        <div className="space-y-6 p-5 sm:p-6">
          {loading && <div className="flex min-h-48 flex-col items-center justify-center gap-3"><div className="h-7 w-7 animate-spin rounded-full border-2 border-gold border-t-transparent" /><p className="text-xs font-mono text-muted-foreground">Loading the completed work...</p></div>}
          {!loading && error && <div className="rounded-xl border border-[oklch(0.62_0.22_25/40%)] bg-[oklch(0.62_0.22_25/8%)] p-4"><div className="flex items-center gap-2 text-[oklch(0.75_0.18_25)]"><AlertTriangle className="h-4 w-4" /><p className="text-sm font-semibold">Could not load this job</p></div><p className="mt-2 text-xs text-muted-foreground">{error}</p></div>}

          {!loading && detail && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={detail.status} successful={isSuccessful} failed={isFailed} />
                {detail.trigger_source && <DetailPill label={detail.trigger_source.replaceAll("_", " ")} />}
                {detail.n8n_execution_id && <DetailPill label="n8n verified" />}
                {hasGmailDraft && <DetailPill label={gmailSentAt ? "Email sent" : "Gmail draft created"} />}
                {initialReview && !gmailSentAt && <DetailPill label={initialReview.status.replaceAll("_", " ")} />}
                {reviewReset && <DetailPill label="review required" />}
              </div>

              <section className="rounded-xl border border-subtle bg-surface p-5">
                <p className="mb-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Executive Summary</p>
                <p className="text-sm leading-7 text-foreground/90">{detail.summary || detail.error_message || "No written summary was recorded for this job."}</p>
              </section>

              {(keyPoints.length > 0 || actionItems.length > 0) && <div className="grid grid-cols-1 gap-4 md:grid-cols-2"><OutputList title="Key Points" items={keyPoints} icon="check" /><OutputList title="Action Items" items={actionItems} icon="action" /></div>}

              {hasGmailDraft && (
                <section className="overflow-hidden rounded-xl border border-[oklch(0.75_0.18_155/30%)] bg-[oklch(0.75_0.18_155/7%)]">
                  <button type="button" onClick={() => setEmailOpen(value => !value)} className="flex w-full items-start gap-3 p-5 text-left transition-colors hover:bg-[oklch(0.75_0.18_155/5%)]" aria-expanded={emailOpen}>
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[oklch(0.75_0.18_155/15%)] text-[oklch(0.75_0.18_155)]"><MailCheck className="h-4 w-4" /></div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div><p className="text-[10px] font-mono uppercase tracking-wider text-[oklch(0.75_0.18_155)]">Customer Follow Up</p><h3 className="mt-1 text-sm font-semibold">{gmailSentAt ? "Email sent" : "Review email draft"}</h3></div>
                        <div className="flex items-center gap-2"><span className="rounded-full bg-[oklch(0.75_0.18_155/15%)] px-2.5 py-1 text-[9px] font-mono font-semibold uppercase tracking-wider text-[oklch(0.75_0.18_155)]">{gmailSentAt ? "Sent" : initialReview ? initialReview.status.replaceAll("_", " ") : "Ready for review"}</span><ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${emailOpen ? "rotate-180" : ""}`} /></div>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">{gmailSentAt ? `Sent ${formatDateTime(gmailSentAt)}` : "Review and revise what Upshot prepared before sending."}</p>
                    </div>
                  </button>

                  {emailOpen && (
                    <div className="border-t border-[oklch(0.75_0.18_155/20%)] p-5">
                      <dl className="grid grid-cols-1 gap-4 text-xs sm:grid-cols-2">
                        <DetailRow label="Recipients" value={gmailRecipients.length > 0 ? gmailRecipients.join(", ") : "Not recorded"} />
                        <DetailRow label={gmailSentAt ? "Sent" : "Prepared"} value={formatDateTime(gmailSentAt || gmailCreatedAt || detail.completed_at)} />
                      </dl>
                      {!gmailSentAt && <GmailDraftEditor organizationId={detail.organization_id} executionId={detail.id} initialSubject={gmailSubject || "Follow up email"} initialBody={gmailBody} approved={initialReview?.status === "approved"} onSaved={() => setReviewReset(true)} />}
                      <DraftReviewActions key={reviewReset ? "revised-draft" : gmailSentAt || initialReview?.reviewed_at || "unreviewed-draft"} organizationId={detail.organization_id} executionId={detail.id} initialReview={initialReview} recipients={gmailRecipients} subject={gmailSubject || "Follow up email"} initialSentAt={gmailSentAt || null} />
                    </div>
                  )}
                </section>
              )}

              <section className="rounded-xl border border-subtle bg-surface p-5"><p className="mb-4 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Run Details</p><dl className="grid grid-cols-1 gap-4 text-xs sm:grid-cols-2"><DetailRow label="Status" value={detail.status} /><DetailRow label="Trigger" value={detail.trigger_source || "Unknown"} /><DetailRow label="Started" value={formatDateTime(detail.started_at || detail.created_at)} /><DetailRow label="Completed" value={formatDateTime(detail.completed_at)} /><DetailRow label="Execution ID" value={detail.id} mono /><DetailRow label="External Event" value={detail.external_event_id || "Not provided"} mono /></dl></section>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

function StatusBadge({ status, successful, failed }: { status: string; successful: boolean; failed: boolean }) {
  const Icon = successful ? CheckCircle2 : failed ? AlertTriangle : Clock3;
  const classes = successful ? "bg-[oklch(0.75_0.18_155/15%)] text-[oklch(0.75_0.18_155)]" : failed ? "bg-[oklch(0.62_0.22_25/15%)] text-[oklch(0.75_0.18_25)]" : "bg-gold/10 text-gold";
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-mono font-semibold capitalize ${classes}`}><Icon className="h-3 w-3" />{status}</span>;
}

function DetailPill({ label }: { label: string }) { return <span className="rounded-full border border-subtle px-3 py-1 text-[10px] font-mono capitalize text-muted-foreground">{label}</span>; }
function OutputList({ title, items, icon }: { title: string; items: string[]; icon: "check" | "action" }) { const Icon = icon === "check" ? CheckCircle2 : ListChecks; return <section className="rounded-xl border border-subtle bg-surface p-5"><div className="mb-3 flex items-center gap-2"><Icon className="h-4 w-4 text-gold" /><p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{title}</p></div><div className="space-y-3">{items.map((item, index) => <div key={`${title}-${index}`} className="flex gap-2 text-xs leading-5 text-foreground/85"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" /><p>{item}</p></div>)}</div></section>; }
function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) { return <div className="min-w-0"><dt className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</dt><dd className={`mt-1 break-words capitalize text-foreground/85 ${mono ? "font-mono text-[10px] normal-case" : ""}`}>{value}</dd></div>; }
function objectValue(value: unknown): Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function stringList(value: unknown): string[] { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : []; }
function stringValue(value: unknown): string { return typeof value === "string" ? value.trim() : ""; }
function isReviewRecord(value: Record<string, unknown>): value is WorkflowReviewRecord { return ["approved", "changes_requested", "dismissed"].includes(String(value.status || "")) && typeof value.reviewed_at === "string" && typeof value.reviewed_by_user_id === "string" && typeof value.reviewed_by_role === "string"; }
function formatDateTime(value?: string | null): string { if (!value) return "Not recorded"; const date = new Date(value); if (Number.isNaN(date.getTime())) return "Not recorded"; return date.toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }); }
