import { supabase } from "./supabase";

export interface GmailDraftEditResult {
  success: boolean;
  subject: string | null;
  body: string | null;
  editedAt: string | null;
  error: string | null;
}

export async function updateGmailDraft(
  organizationId: string,
  executionId: string,
  subject: string,
  body: string,
): Promise<GmailDraftEditResult> {
  if (!supabase) return { success: false, subject: null, body: null, editedAt: null, error: "Supabase is not configured." };

  const { data, error } = await supabase.functions.invoke("update-google-gmail-draft", {
    body: {
      organization_id: organizationId,
      execution_id: executionId,
      subject: subject.trim(),
      body: body.trim(),
    },
  });

  if (error) {
    const context = (error as { context?: { json?: () => Promise<unknown> } }).context;
    if (context?.json) {
      try {
        const response = await context.json() as { error?: string };
        if (response.error) return { success: false, subject: null, body: null, editedAt: null, error: response.error };
      } catch {
        // Fall through to the client error.
      }
    }
    return { success: false, subject: null, body: null, editedAt: null, error: error.message || "The Gmail draft could not be updated." };
  }

  return {
    success: data?.success === true,
    subject: typeof data?.subject === "string" ? data.subject : null,
    body: typeof data?.body === "string" ? data.body : null,
    editedAt: typeof data?.edited_at === "string" ? data.edited_at : null,
    error: data?.success === true ? null : String(data?.error || "The Gmail draft could not be updated."),
  };
}
