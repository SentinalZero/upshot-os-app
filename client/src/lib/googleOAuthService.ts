/**
 * Google OAuth Service — Frontend-only helper.
 *
 * Calls Edge Functions for all OAuth operations.
 * Never handles tokens, secrets, or encryption directly.
 * All sensitive operations happen server-side in Edge Functions.
 */

import { supabase } from "./supabase";

const functionsBaseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

/**
 * Get the current user's JWT for authenticating Edge Function calls.
 */
async function getAccessToken(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || null;
}

/**
 * Initiate Google OAuth flow.
 * Calls google-oauth-start Edge Function which returns the consent URL.
 * The frontend then redirects the browser to that URL.
 */
export async function startGoogleOAuth(
  integrationId: string,
  organizationId: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  const token = await getAccessToken();
  if (!token) return { success: false, error: "Not authenticated" };

  try {
    const response = await fetch(`${functionsBaseUrl}/google-oauth-start`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ integration_id: integrationId, organization_id: organizationId }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.error || `HTTP ${response.status}` };
    }

    return { success: true, url: data.url };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Network error";
    return { success: false, error: message };
  }
}

/**
 * Check the status of a Google Workspace integration.
 * Calls google-oauth-status Edge Function.
 * Returns public status info only — never tokens or secrets.
 */
export interface OAuthStatusResponse {
  id: string;
  status: string;
  external_account_email: string | null;
  external_account_name: string | null;
  connected_at: string | null;
  last_verified_at: string | null;
  granted_scopes: string[] | null;
  has_tokens: boolean;
  token_expires_at: string | null;
}

export async function checkGoogleOAuthStatus(
  integrationId: string,
  organizationId: string
): Promise<{ success: boolean; data?: OAuthStatusResponse; error?: string }> {
  const token = await getAccessToken();
  if (!token) return { success: false, error: "Not authenticated" };

  try {
    const params = new URLSearchParams({
      integration_id: integrationId,
      organization_id: organizationId,
    });

    const response = await fetch(`${functionsBaseUrl}/google-oauth-status?${params}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.error || `HTTP ${response.status}` };
    }

    return { success: true, data };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Network error";
    return { success: false, error: message };
  }
}

/**
 * Disconnect a Google Workspace integration.
 * Calls google-oauth-disconnect Edge Function which:
 * - Decrypts the stored token server-side
 * - Revokes it with Google
 * - Deletes encrypted secrets
 * - Updates status to "disconnected"
 */
export async function disconnectGoogleOAuth(
  integrationId: string,
  organizationId: string
): Promise<{ success: boolean; error?: string }> {
  const token = await getAccessToken();
  if (!token) return { success: false, error: "Not authenticated" };

  try {
    const response = await fetch(`${functionsBaseUrl}/google-oauth-disconnect`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ integration_id: integrationId, organization_id: organizationId }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.error || `HTTP ${response.status}` };
    }

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Network error";
    return { success: false, error: message };
  }
}
