# continue-meeting-follow-up

Sends an approved meeting follow-up through the organization's connected Google Workspace account without n8n.

## Deploy

```bash
supabase functions deploy continue-meeting-follow-up
```

This function requires the same Supabase secrets already used by Google OAuth plus the continuation secret:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `TOKEN_ENCRYPTION_KEY`
- `WORKFLOW_CONTINUATION_SECRET`

The `WORKFLOW_CONTINUATION_SECRET` value must match the secret used by `continue-workflow`.

## Execution metadata

Configure the approved workflow execution with this continuation endpoint and payload:

```json
{
  "continuation_url": "https://ocfjmrnftggmaqyyhzmf.supabase.co/functions/v1/continue-meeting-follow-up",
  "continuation_payload": {
    "integration_id": "GOOGLE_INTEGRATION_UUID",
    "to": ["customer@example.com"],
    "subject": "Thank you for today's meeting",
    "body": "Hi ..."
  }
}
```

Optional payload fields:

- `cc`
- `bcc`

The generic `continue-workflow` dispatcher adds the trusted `upshot` context and calls this function after a human selects **Approve and continue**.

## Behavior

- Requires the internal continuation secret.
- Confirms the workflow execution belongs to the organization and is currently `running`.
- Confirms the selected integration is a connected Google Workspace integration.
- Decrypts the Google access token only inside the Edge Function.
- Refreshes an expired token when a refresh token is available.
- Sends the approved plain-text email with Gmail API `users.messages.send`.
- Records success or failure in `activity_logs`.
- Returns a non-2xx response on failure so `continue-workflow` marks the execution failed instead of reporting a false success.

The existing Google OAuth scope `gmail.compose` supports sending messages through Gmail API.
