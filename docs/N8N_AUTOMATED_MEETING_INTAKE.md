# Automated Meeting Summary Intake

This is the production path for running Meeting Summary without clicking **Listen for Test Event** and without trusting n8n to choose the customer organization.

## Runtime flow

```text
Published n8n Calendar Intake workflow
  -> detects an ended meeting
  -> calls start-system-execution
  -> Supabase validates the integration and capability
  -> Supabase derives organization_id and digital_specialist_id
  -> Supabase creates workflow_executions
  -> Supabase calls the published n8n workflow router
  -> Meeting Summary runs
  -> n8n updates the registered execution
  -> Command Center refreshes through Supabase Realtime
```

The Calendar Intake workflow and workflow router must both be **Active** in n8n. Test listeners are not used in production.

## Required Supabase secrets

```text
UPSHOT_SYSTEM_TRIGGER_SECRET=<long random secret used by calendar intake>
N8N_WORKFLOW_TRIGGER_URL=https://<n8n-host>/webhook/upshot-workflow-router
N8N_WORKFLOW_TRIGGER_SECRET=<long random secret used by the router>
```

Use separate values for the system trigger secret and workflow router secret.

## Deploy the Edge Function

The automated endpoint uses its own service secret instead of a user JWT, so deploy it with JWT verification disabled:

```bash
supabase functions deploy start-system-execution --no-verify-jwt
```

The authenticated manual endpoint remains JWT protected:

```bash
supabase functions deploy start-workflow-execution
```

## Calendar Intake request

The intake workflow sends an HTTP POST request to:

```text
https://<project-ref>.supabase.co/functions/v1/start-system-execution
```

Headers:

```text
Content-Type: application/json
X-Upshot-System-Secret: <UPSHOT_SYSTEM_TRIGGER_SECRET>
```

Body:

```json
{
  "integration_id": "uuid for the connected Google integration",
  "specialist_workflow_deployment_id": "uuid for Meeting Summary capability",
  "external_event_id": "stable Google event identifier",
  "event_type": "google_calendar.meeting_ended",
  "input_payload": {
    "calendar_event_id": "google event id",
    "title": "Customer onboarding review",
    "started_at": "2026-07-18T15:00:00Z",
    "ended_at": "2026-07-18T15:30:00Z",
    "attendees": [],
    "transcript_location": null
  }
}
```

The request must not contain `organization_id`, `digital_specialist_id`, or `triggered_by_user_id`. The Edge Function derives those values from the integration.

## Recommended n8n Calendar Intake nodes

### MVP deployment

For the first customer deployments, use one active Calendar Intake workflow per connected Google credential:

1. **Schedule Trigger** every five minutes.
2. **Google Calendar** node gets meetings that ended during the lookback window.
3. **Filter** keeps confirmed events whose end time is in the past.
4. **Edit Fields** adds the Upshot `integration_id` and Meeting Summary deployment ID configured for that connection.
5. **HTTP Request** calls `start-system-execution` with the system secret header.
6. Treat HTTP `200` with `duplicate: true` as a successful no-op.
7. Log failures for operational review.

The schedule can safely overlap its lookback window because automated executions are deduplicated by:

```text
source_integration_id
+ specialist_workflow_deployment_id
+ external_event_id
```

For an ended meeting, a good stable external event value is:

```text
<google-event-id>:meeting-ended
```

Do not use the current timestamp as the external event ID because retries would create new jobs.

### Later centralized deployment

At larger scale, replace per-credential polling with Google push notifications or a centralized intake service. The same `start-system-execution` contract remains valid. The centralized service maps the verified Google channel or account to an Upshot integration ID before registering work.

## What the Edge Function verifies

Before registering a job, the function checks that:

1. The caller knows `UPSHOT_SYSTEM_TRIGGER_SECRET`.
2. The integration exists and is connected.
3. The integration is assigned to a Digital Specialist.
4. The capability deployment belongs to the integration's organization.
5. The capability deployment belongs to the same Digital Specialist.
6. The specialist and deployment are active.
7. The external event has not already produced the same execution.

Only after those checks does Supabase create the execution and send it to n8n.

## n8n workflow router requirements

The router receives a pre-registered identity:

```json
{
  "execution_id": "uuid",
  "organization_id": "uuid",
  "digital_specialist_id": "uuid",
  "specialist_workflow_deployment_id": "uuid",
  "triggered_by_user_id": null,
  "source_integration_id": "uuid",
  "external_event_id": "google-event-id:meeting-ended",
  "trigger_source": "integration",
  "event_type": "google_calendar.meeting_ended",
  "request_id": "uuid",
  "input_payload": {}
}
```

The router must load `workflow_executions` by `execution_id` and `organization_id`, verify the IDs match, and then update that existing row. It must not insert a replacement execution.

## Cutover test

1. Apply both secure execution migrations.
2. Deploy both Edge Functions.
3. Set all three secrets.
4. Activate the n8n workflow router.
5. Activate the Calendar Intake workflow.
6. Use one known Google event and run the intake twice.
7. Confirm the first request creates one execution.
8. Confirm the second request returns `duplicate: true` and creates nothing new.
9. Confirm only the owning organization's Command Center changes.
10. Disable the old workflow path that directly inserts execution rows.
