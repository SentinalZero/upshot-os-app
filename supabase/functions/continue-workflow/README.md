# Supabase workflow continuation

This function continues approved Upshot workflow executions without consuming n8n credits.

## How it works

1. A user approves or resolves an item in Today.
2. Upshot records the human decision and changes the linked `workflow_executions.status` to `queued`.
3. The client invokes the `continue-workflow` Supabase Edge Function.
4. The function verifies the signed-in user can read the execution through existing RLS.
5. The function claims the queued execution by changing it to `running`.
6. It POSTs the approved payload to the configured HTTPS continuation endpoint.
7. The execution is marked `successful` or `failed`, and an activity log is written.

## Deploy

From a terminal authenticated with the Supabase CLI:

```bash
supabase functions deploy continue-workflow
```

The standard Supabase function variables are provided automatically:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

An optional shared secret can be added for downstream endpoint verification:

```bash
supabase secrets set WORKFLOW_CONTINUATION_SECRET="replace-with-a-long-random-value"
```

The dispatcher sends this value as the `X-Upshot-Continuation-Secret` request header.

## Configure an execution

The execution must contain a safe HTTPS continuation URL. The dispatcher checks these locations in order:

- `workflow_executions.continuation_url`
- `workflow_executions.callback_url`
- `workflow_executions.metadata.continuation_url`
- `workflow_executions.metadata.resume_url`
- `workflow_executions.metadata.callback_url`
- `workflow_executions.metadata.webhook_url`

The recommended approach is metadata so no schema change is required:

```json
{
  "continuation_url": "https://your-api.example.com/upshot/continue",
  "continuation_payload": {
    "customer_id": "customer-123",
    "action": "send_approved_follow_up"
  }
}
```

The downstream endpoint also receives an `upshot` object containing:

- `organization_id`
- `workflow_execution_id`
- `specialist_id`
- `command_decision_id`
- `decision_status`
- `authorized_by`
- `authorized_at`

## No endpoint configured

If no safe continuation URL is present, the decision remains recorded and the execution stays `queued`. Add `metadata.continuation_url`, then retry the dispatcher. Nothing is lost and no n8n execution is consumed.

## Security behavior

- Requires a valid Supabase user session.
- Uses the current user's RLS visibility as the authorization boundary.
- Only dispatches executions currently in `queued` status.
- Uses a conditional claim to prevent duplicate dispatches.
- Accepts HTTPS endpoints only.
- Rejects localhost and common private-network destinations.
- Times out downstream requests after 20 seconds.
