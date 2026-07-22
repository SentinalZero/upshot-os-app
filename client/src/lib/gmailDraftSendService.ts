import { supabase } from "@/lib/supabase";

export interface GmailDraftSendResult {
  success: boolean;
  sentAt?: string;
  messageId?: string | null;
  threadId?: string | null;
  error?: string;
}

export async function sendApprovedGmailDraft(organizationId: string, executionId: string): Promise<GmailDraftSendResult> {
  try {
    if (!supabase) return { success: false, error: "Supabase is not configured." };
    const client = supabase;
    const { data, error } = await client.functions.invoke("send-approved-gmail-draft", {
      body: { organization_id: organizationId, execution_id: executionId },
    });
    if (error) return { success: false, error: error.message || "The approved email could not be sent." };
    if (!data?.success) return { success: false, error: data?.error || "The approved email could not be sent." };
    return {
      success: true,
      sentAt: typeof data.sent_at === "string" ? data.sent_at : undefined,
      messageId: typeof data.message_id === "string" ? data.message_id : null,
      threadId: typeof data.thread_id === "string" ? data.thread_id : null,
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "The approved email could not be sent." };
  }
}
