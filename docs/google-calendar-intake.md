# Google Calendar Intake

The Google Calendar intake keeps OAuth tokens inside Supabase and uses n8n only as the scheduler.

## Runtime path

1. n8n runs every five minutes.
2. n8n calls `poll-google-calendar-events` with `X-Upshot-System-Secret`.
3. The Edge Function validates the Google integration and Meeting Summary deployment.
4. The Edge Function decrypts or refreshes the Google access token server-side.
5. Google Calendar events that ended during the lookback window are normalized.
6. Each meeting is sent to `start-system-execution`.
7. Existing execution idempotency prevents duplicate jobs when polling windows overlap.
8. The existing n8n router receives a pre-created, tenant-scoped execution envelope.

## Intake request

```json
{
  "integration_id": "7268fdd8-6f03-4dea-bb1b-15bea0bb9111",
  "specialist_workflow_deployment_id": "754a7dcd-fa29-46e7-82cf-636216487bfb",
  "lookback_minutes": 30,
  "include_solo_events": false,
  "dry_run": true
}
```

`dry_run` returns candidate meetings without creating workflow executions. Set it to `false` only after the first successful test.

## n8n credential

Create a Header Auth credential for the `Poll Google Calendar` node:

- Header name: `X-Upshot-System-Secret`
- Header value: the same private value stored in Supabase as `UPSHOT_SYSTEM_TRIGGER_SECRET`

Do not place the secret directly in the workflow JSON.

## Filtering rules

The MVP intake processes timed Google Calendar events that:

- ended within the configured lookback window
- are not cancelled
- are not declined by the connected user
- include another attendee or a video conference link, unless `include_solo_events` is enabled

All-day events, focus time, birthdays, out-of-office entries, working-location entries, and future meetings are ignored.

## Deployment

Run the `Deploy Supabase Edge Functions` GitHub Action after merging. The workflow deploys `poll-google-calendar-events` with JWT verification disabled because the private system header authenticates scheduler calls.

## Import

Import `n8n/Upshot_Google_Calendar_Intake.json` into n8n Cloud, assign the Header Auth credential, and run the manual test trigger before activating the schedule.
