/**
 * poll-google-calendar-events
 *
 * Trusted scheduler entry point for Google Calendar intake. The function keeps
 * Google tokens server-side, finds recently ended meetings, normalizes each
 * event, and hands it to the existing tenant-aware system trigger.
 *
 * Deploy with JWT verification disabled. X-Upshot-System-Secret authenticates
 * the n8n scheduler call.
 */
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { decryptToken, encryptToken } from "../_shared/crypto.ts";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { getSupabaseAdmin } from "../_shared/supabase-admin.ts";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ACTIVE_STATUSES = new Set(["active", "deployed", "ready", "running"]);
const DEFAULT_LOOKBACK_MINUTES = 30;
const MAX_LOOKBACK_MINUTES = 180;
const TOKEN_REFRESH_BUFFER_MS = 2 * 60 * 1000;
const MAX_CALENDAR_PAGES = 5;

interface IntegrationRecord {
  id: string;
  organization_id: string;
  digital_specialist_id: string;
  status: string;
  provider_key: string;
  provider_name: string;
  external_account_email: string | null;
}

interface IntegrationSecretRecord {
  encrypted_access_token: string | null;
  encrypted_refresh_token: string | null;
  expires_at: string | null;
  token_type: string | null;
  granted_scopes: string[] | null;
}

interface GoogleAttendee {
  email?: string;
  displayName?: string;
  responseStatus?: string;
  self?: boolean;
  organizer?: boolean;
}

interface GoogleEvent {
  id?: string;
  iCalUID?: string;
  status?: string;
  eventType?: string;
  summary?: string;
  description?: string;
  location?: string;
  htmlLink?: string;
  hangoutLink?: string;
  start?: { dateTime?: string; date?: string; timeZone?: string };
  end?: { dateTime?: string; date?: string; timeZone?: string };
  originalStartTime?: { dateTime?: string; date?: string; timeZone?: string };
  attendees?: GoogleAttendee[];
  organizer?: { email?: string; displayName?: string; self?: boolean };
  conferenceData?: {
    conferenceId?: string;
    conferenceSolution?: { name?: string };
    entryPoints?: Array<{ entryPointType?: string; uri?: string; label?: string }>;
  };
}

function respond(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function secretsMatch(received: string, expected: string): boolean {
  const encoder = new TextEncoder();
  const left = encoder.encode(received);
  const right = encoder.encode(expected);
  if (left.length !== right.length) return false;

  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index] ^ right[index];
  }
  return difference === 0;
}

function parseLookbackMinutes(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_LOOKBACK_MINUTES;
  return Math.min(MAX_LOOKBACK_MINUTES, Math.max(5, Math.floor(parsed)));
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function eventOccurrenceKey(event: GoogleEvent): string {
  return event.originalStartTime?.dateTime
    || event.originalStartTime?.date
    || event.start?.dateTime
    || event.start?.date
    || "unknown-occurrence";
}

function getConferenceLink(event: GoogleEvent): string | null {
  if (event.hangoutLink) return event.hangoutLink;
  const videoEntry = event.conferenceData?.entryPoints?.find((entry) => entry.entryPointType === "video");
  return videoEntry?.uri || null;
}

function normalizeAttendees(attendees: GoogleAttendee[] | undefined) {
  if (!Array.isArray(attendees)) return [];
  return attendees.map((attendee) => ({
    email: attendee.email || null,
    display_name: attendee.displayName || null,
    response_status: attendee.responseStatus || null,
    is_self: attendee.self === true,
    is_organizer: attendee.organizer === true,
  }));
}

function shouldProcessEvent(
  event: GoogleEvent,
  windowStartMs: number,
  nowMs: number,
  includeSoloEvents: boolean,
): { process: boolean; reason?: string } {
  if (!event.id) return { process: false, reason: "missing_event_id" };
  if (event.status === "cancelled") return { process: false, reason: "cancelled" };
  if (event.eventType && event.eventType !== "default") return { process: false, reason: "non_meeting_event_type" };
  if (!event.start?.dateTime || !event.end?.dateTime) return { process: false, reason: "all_day_or_missing_time" };

  const endMs = Date.parse(event.end.dateTime);
  if (!Number.isFinite(endMs)) return { process: false, reason: "invalid_end_time" };
  if (endMs > nowMs) return { process: false, reason: "still_in_progress" };
  if (endMs <= windowStartMs) return { process: false, reason: "outside_lookback_window" };

  const attendees = Array.isArray(event.attendees) ? event.attendees : [];
  const selfAttendee = attendees.find((attendee) => attendee.self === true);
  if (selfAttendee?.responseStatus === "declined") return { process: false, reason: "declined" };

  const externalAttendees = attendees.filter((attendee) => attendee.self !== true && attendee.responseStatus !== "declined");
  const hasConference = Boolean(getConferenceLink(event));
  if (!includeSoloEvents && externalAttendees.length === 0 && !hasConference) {
    return { process: false, reason: "solo_calendar_event" };
  }

  return { process: true };
}

async function refreshGoogleAccessToken(
  admin: ReturnType<typeof getSupabaseAdmin>,
  integration: IntegrationRecord,
  secrets: IntegrationSecretRecord,
): Promise<string> {
  if (!secrets.encrypted_refresh_token) {
    throw new Error("Google refresh token is unavailable. Reconnect Google Workspace.");
  }

  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth client credentials are not configured.");
  }

  const refreshToken = await decryptToken(secrets.encrypted_refresh_token);
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!tokenResponse.ok) {
    const errorBody = await tokenResponse.text();
    await admin
      .from("integrations")
      .update({
        status: "error",
        last_error: `Google token refresh failed (${tokenResponse.status}). Reconnect Google Workspace.`,
        updated_at: new Date().toISOString(),
      })
      .eq("id", integration.id)
      .eq("organization_id", integration.organization_id);

    console.error("[poll-google-calendar-events] Google token refresh failed:", tokenResponse.status, errorBody.slice(0, 500));
    throw new Error("Google authorization expired. Reconnect Google Workspace.");
  }

  const tokenPayload = await tokenResponse.json();
  const accessToken = typeof tokenPayload.access_token === "string" ? tokenPayload.access_token : "";
  if (!accessToken) throw new Error("Google did not return a refreshed access token.");

  const expiresInSeconds = Number(tokenPayload.expires_in || 3600);
  const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();
  const encryptedAccessToken = await encryptToken(accessToken);
  const now = new Date().toISOString();

  const { error: secretUpdateError } = await admin
    .from("integration_secrets")
    .update({
      encrypted_access_token: encryptedAccessToken,
      token_type: tokenPayload.token_type || secrets.token_type || "Bearer",
      expires_at: expiresAt,
      updated_at: now,
    })
    .eq("integration_id", integration.id)
    .eq("organization_id", integration.organization_id);

  if (secretUpdateError) {
    throw new Error(`Could not store refreshed Google access token: ${secretUpdateError.message}`);
  }

  await admin
    .from("integrations")
    .update({
      status: "connected",
      expires_at: expiresAt,
      last_verified_at: now,
      last_error: null,
      updated_at: now,
    })
    .eq("id", integration.id)
    .eq("organization_id", integration.organization_id);

  return accessToken;
}

async function getGoogleAccessToken(
  admin: ReturnType<typeof getSupabaseAdmin>,
  integration: IntegrationRecord,
  secrets: IntegrationSecretRecord,
  forceRefresh = false,
): Promise<string> {
  const expiresAtMs = secrets.expires_at ? Date.parse(secrets.expires_at) : Number.NaN;
  const tokenStillValid = Number.isFinite(expiresAtMs) && expiresAtMs - Date.now() > TOKEN_REFRESH_BUFFER_MS;

  if (!forceRefresh && secrets.encrypted_access_token && (tokenStillValid || !Number.isFinite(expiresAtMs))) {
    return decryptToken(secrets.encrypted_access_token);
  }

  return refreshGoogleAccessToken(admin, integration, secrets);
}

async function fetchCalendarEvents(accessToken: string, timeMin: string, timeMax: string): Promise<Response> {
  const params = new URLSearchParams({
    singleEvents: "true",
    orderBy: "startTime",
    showDeleted: "false",
    maxResults: "100",
    timeMin,
    timeMax,
  });
  params.append("eventTypes", "default");

  return fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

async function listCalendarEvents(
  accessToken: string,
  timeMin: string,
  timeMax: string,
): Promise<{ events: GoogleEvent[]; responseStatus: number }> {
  const events: GoogleEvent[] = [];
  let pageToken = "";
  let responseStatus = 200;

  for (let page = 0; page < MAX_CALENDAR_PAGES; page += 1) {
    const params = new URLSearchParams({
      singleEvents: "true",
      orderBy: "startTime",
      showDeleted: "false",
      maxResults: "100",
      timeMin,
      timeMax,
    });
    params.append("eventTypes", "default");
    if (pageToken) params.set("pageToken", pageToken);

    const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    responseStatus = response.status;

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Google Calendar API returned ${response.status}: ${errorBody.slice(0, 500)}`);
    }

    const payload = await response.json();
    if (Array.isArray(payload.items)) events.push(...payload.items as GoogleEvent[]);
    pageToken = typeof payload.nextPageToken === "string" ? payload.nextPageToken : "";
    if (!pageToken) break;
  }

  return { events, responseStatus };
}

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  if (req.method !== "POST") return respond({ error: "Method not allowed" }, 405);

  try {
    const expectedSecret = Deno.env.get("UPSHOT_SYSTEM_TRIGGER_SECRET");
    const receivedSecret = req.headers.get("X-Upshot-System-Secret") || "";
    if (!expectedSecret || !receivedSecret || !secretsMatch(receivedSecret, expectedSecret)) {
      return respond({ error: "Unauthorized calendar intake" }, 401);
    }

    const body = await req.json().catch(() => ({}));
    if (!isJsonObject(body)) return respond({ error: "Request body must be a JSON object" }, 400);

    const integrationId = typeof body.integration_id === "string" ? body.integration_id : "";
    const deploymentId = typeof body.specialist_workflow_deployment_id === "string"
      ? body.specialist_workflow_deployment_id
      : "";
    const lookbackMinutes = parseLookbackMinutes(body.lookback_minutes);
    const includeSoloEvents = body.include_solo_events === true;
    const dryRun = body.dry_run === true;

    if (!UUID_PATTERN.test(integrationId)) {
      return respond({ error: "A valid integration_id is required" }, 400);
    }
    if (!UUID_PATTERN.test(deploymentId)) {
      return respond({ error: "A valid specialist_workflow_deployment_id is required" }, 400);
    }

    const admin = getSupabaseAdmin();
    const { data: integration, error: integrationError } = await admin
      .from("integrations")
      .select("id, organization_id, digital_specialist_id, status, provider_key, provider_name, external_account_email")
      .eq("id", integrationId)
      .single();

    if (integrationError || !integration) return respond({ error: "Google integration was not found" }, 404);
    if (integration.provider_key !== "google_workspace") return respond({ error: "Integration is not Google Workspace" }, 409);
    if (String(integration.status || "").toLowerCase() !== "connected") {
      return respond({ error: "Google Workspace integration is not connected" }, 409);
    }
    if (!integration.organization_id || !integration.digital_specialist_id) {
      return respond({ error: "Google Workspace integration is not assigned to a Digital Specialist" }, 409);
    }

    const typedIntegration = integration as IntegrationRecord;
    const { data: deployment } = await admin
      .from("specialist_workflow_deployments")
      .select("id, organization_id, specialist_id, status")
      .eq("id", deploymentId)
      .eq("organization_id", typedIntegration.organization_id)
      .eq("specialist_id", typedIntegration.digital_specialist_id)
      .single();

    if (!deployment) return respond({ error: "Meeting Summary capability does not match this integration" }, 404);
    if (!ACTIVE_STATUSES.has(String(deployment.status || "").toLowerCase())) {
      return respond({ error: "Meeting Summary capability is not active" }, 409);
    }

    const { data: secretRecord, error: secretError } = await admin
      .from("integration_secrets")
      .select("encrypted_access_token, encrypted_refresh_token, expires_at, token_type, granted_scopes")
      .eq("integration_id", integrationId)
      .eq("organization_id", typedIntegration.organization_id)
      .single();

    if (secretError || !secretRecord) {
      return respond({ error: "Google integration credentials are unavailable" }, 409);
    }

    const typedSecrets = secretRecord as IntegrationSecretRecord;
    const now = new Date();
    const windowStart = new Date(now.getTime() - lookbackMinutes * 60 * 1000);
    let accessToken = await getGoogleAccessToken(admin, typedIntegration, typedSecrets);
    let calendarResult: { events: GoogleEvent[]; responseStatus: number };

    try {
      calendarResult = await listCalendarEvents(accessToken, windowStart.toISOString(), now.toISOString());
    } catch (firstError) {
      const firstMessage = firstError instanceof Error ? firstError.message : String(firstError);
      if (!firstMessage.includes("returned 401")) throw firstError;

      accessToken = await getGoogleAccessToken(admin, typedIntegration, typedSecrets, true);
      calendarResult = await listCalendarEvents(accessToken, windowStart.toISOString(), now.toISOString());
    }

    const candidates: Array<Record<string, unknown>> = [];
    const skipped: Record<string, number> = {};
    const deliveryResults: Array<Record<string, unknown>> = [];

    for (const event of calendarResult.events) {
      const decision = shouldProcessEvent(event, windowStart.getTime(), now.getTime(), includeSoloEvents);
      if (!decision.process) {
        const reason = decision.reason || "filtered";
        skipped[reason] = (skipped[reason] || 0) + 1;
        continue;
      }

      const occurrenceKey = eventOccurrenceKey(event);
      const externalEventId = `google-calendar:${integrationId}:${event.id}:${occurrenceKey}`.slice(0, 512);
      const normalizedAttendees = normalizeAttendees(event.attendees);
      const inputPayload = {
        calendar_event_id: event.id,
        calendar_ical_uid: event.iCalUID || null,
        title: event.summary || "Untitled meeting",
        description: event.description || null,
        meeting_notes: event.description || null,
        location: event.location || null,
        started_at: event.start?.dateTime || null,
        ended_at: event.end?.dateTime || null,
        time_zone: event.start?.timeZone || event.end?.timeZone || null,
        attendees: normalizedAttendees,
        organizer: {
          email: event.organizer?.email || null,
          display_name: event.organizer?.displayName || null,
          is_self: event.organizer?.self === true,
        },
        calendar_link: event.htmlLink || null,
        conference_link: getConferenceLink(event),
        conference_id: event.conferenceData?.conferenceId || null,
        conference_provider: event.conferenceData?.conferenceSolution?.name || null,
        source_provider: "google_workspace",
        source_account_email: typedIntegration.external_account_email,
      };

      candidates.push({ external_event_id: externalEventId, input_payload: inputPayload });
      if (dryRun) continue;

      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      if (!supabaseUrl) throw new Error("SUPABASE_URL is not configured");

      const startResponse = await fetch(`${supabaseUrl}/functions/v1/start-system-execution`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Upshot-System-Secret": expectedSecret,
        },
        body: JSON.stringify({
          integration_id: integrationId,
          specialist_workflow_deployment_id: deploymentId,
          external_event_id: externalEventId,
          event_type: "google_calendar.meeting_ended",
          input_payload: inputPayload,
        }),
      });

      const responseText = await startResponse.text();
      let responseBody: Record<string, unknown> = {};
      try {
        responseBody = responseText ? JSON.parse(responseText) : {};
      } catch {
        responseBody = { raw_response: responseText.slice(0, 500) };
      }

      deliveryResults.push({
        calendar_event_id: event.id,
        external_event_id: externalEventId,
        http_status: startResponse.status,
        accepted: startResponse.ok,
        duplicate: responseBody.duplicate === true,
        execution_id: typeof responseBody.execution_id === "string" ? responseBody.execution_id : null,
        error: typeof responseBody.error === "string" ? responseBody.error : null,
      });
    }

    const nowIso = new Date().toISOString();
    const failedDeliveries = deliveryResults.filter((result) => result.accepted !== true);
    await admin
      .from("integrations")
      .update({
        last_verified_at: nowIso,
        last_error: failedDeliveries.length > 0
          ? `${failedDeliveries.length} calendar event${failedDeliveries.length === 1 ? "" : "s"} could not be routed.`
          : null,
        updated_at: nowIso,
      })
      .eq("id", integrationId)
      .eq("organization_id", typedIntegration.organization_id);

    const started = deliveryResults.filter((result) => result.http_status === 202).length;
    const duplicates = deliveryResults.filter((result) => result.duplicate === true).length;

    return respond({
      integration_id: integrationId,
      specialist_workflow_deployment_id: deploymentId,
      account_email: typedIntegration.external_account_email,
      lookback_minutes: lookbackMinutes,
      window_start: windowStart.toISOString(),
      window_end: now.toISOString(),
      calendar_events_returned: calendarResult.events.length,
      candidate_meetings: candidates.length,
      executions_started: started,
      duplicates,
      failed_deliveries: failedDeliveries.length,
      dry_run: dryRun,
      skipped,
      candidates: dryRun ? candidates : undefined,
      delivery_results: dryRun ? undefined : deliveryResults,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("[poll-google-calendar-events] Unexpected error:", message);
    return respond({ error: message }, 500);
  }
});
