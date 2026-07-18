# Secure n8n Workflow Trigger Contract

Upshot OS owns tenant identity. n8n executes the job but does not decide which user, organization, specialist, or deployment owns it.

## Trusted start path

1. The authenticated browser calls the `start-workflow-execution` Supabase Edge Function.
2. The Edge Function validates the JWT and reads the user's active organization from `profiles`.
3. The Edge Function verifies the user in `organization_members`.
4. The Edge Function validates the selected row in `specialist_workflow_deployments` against that organization.
5. The Edge Function derives the assigned Digital Specialist from the deployment.
6. The Edge Function creates the `workflow_executions` row before n8n starts.
7. The Edge Function sends the registered execution identity to one secured n8n router webhook.
8. n8n updates that execution by `execution_id`; it does not create a replacement execution from untrusted input.

## Required Edge Function secrets

```text
N8N_WORKFLOW_TRIGGER_URL=https://your-n8n-host/webhook/upshot-workflow-router
N8N_WORKFLOW_TRIGGER_SECRET=use-a-long-random-secret
```

Store both values as Supabase Edge Function secrets. Never expose them through Vite environment variables or frontend code.

## Request from Upshot OS to n8n

The Edge Function sends:

```json
{
  "execution_id": "uuid",
  "organization_id": "uuid",
  "digital_specialist_id": "uuid",
  "specialist_workflow_deployment_id": "uuid",
  "triggered_by_user_id": "uuid",
  "trigger_source": "manual",
  "request_id": "uuid",
  "input_payload": {}
}
```

The request includes this header:

```text
X-Upshot-Workflow-Secret: <N8N_WORKFLOW_TRIGGER_SECRET>
```

## n8n router requirements

The first n8n nodes should:

1. Reject requests whose `X-Upshot-Workflow-Secret` header does not match the n8n credential value.
2. Require `execution_id`, `organization_id`, `digital_specialist_id`, and `specialist_workflow_deployment_id`.
3. Load the existing `workflow_executions` row by both `execution_id` and `organization_id`.
4. Confirm the existing row contains the same specialist and deployment IDs.
5. Route the job using the validated deployment ID.
6. Insert `activity_logs` using the trusted organization and specialist IDs from the registered execution.
7. Update the same execution to `successful` or `failed` and set `completed_at`.

## Never trust these values from an external meeting payload

External webhooks, calendar events, email content, meeting metadata, and user supplied forms must never choose:

- `organization_id`
- `digital_specialist_id`
- `triggered_by_user_id`
- `specialist_workflow_deployment_id`
- `execution_id`

Business input may be attached to a run only after identity has been registered by Upshot OS.

## Automated integration events

Calendar, email, and other background triggers should use a separate service endpoint. That endpoint should derive the organization from a validated `integrations` record and register:

```text
trigger_source = integration
triggered_by_user_id = null
source_integration_id = validated integration UUID
```

Do not reuse the authenticated manual trigger by pretending an automated event came from a user.

## Cutover plan

1. Apply the secure execution identity migration.
2. Deploy `start-workflow-execution` with JWT verification enabled.
3. Add the two Edge Function secrets.
4. Build the secured n8n router webhook.
5. Rewire manual Upshot actions to call `startWorkflowExecution()`.
6. Confirm executions and activity appear only in the owning organization's Command Center.
7. Disable the legacy n8n path that inserts new execution rows directly.
