-- Add authenticated tenant and trigger identity to workflow executions.
-- This migration is additive so existing n8n runs continue to work while the
-- secure trigger path is introduced.

ALTER TABLE public.workflow_executions
  ADD COLUMN IF NOT EXISTS triggered_by_user_id uuid,
  ADD COLUMN IF NOT EXISTS specialist_workflow_deployment_id uuid,
  ADD COLUMN IF NOT EXISTS source_integration_id uuid,
  ADD COLUMN IF NOT EXISTS trigger_source text,
  ADD COLUMN IF NOT EXISTS request_id uuid,
  ADD COLUMN IF NOT EXISTS input_payload jsonb,
  ADD COLUMN IF NOT EXISTS trigger_metadata jsonb;

-- Preserve any legacy trigger_source value that does not match the new source
-- vocabulary, then classify the historical row as a system-triggered run.
UPDATE public.workflow_executions
SET
  trigger_metadata = COALESCE(trigger_metadata, '{}'::jsonb)
    || jsonb_build_object('legacy_trigger_source', trigger_source),
  trigger_source = 'system'
WHERE trigger_source IS NULL
   OR trigger_source NOT IN ('manual', 'schedule', 'webhook', 'integration', 'system');

UPDATE public.workflow_executions
SET request_id = gen_random_uuid()
WHERE request_id IS NULL;

UPDATE public.workflow_executions
SET input_payload = '{}'::jsonb
WHERE input_payload IS NULL;

UPDATE public.workflow_executions
SET trigger_metadata = '{}'::jsonb
WHERE trigger_metadata IS NULL;

ALTER TABLE public.workflow_executions
  ALTER COLUMN trigger_source SET DEFAULT 'manual',
  ALTER COLUMN trigger_source SET NOT NULL,
  ALTER COLUMN request_id SET DEFAULT gen_random_uuid(),
  ALTER COLUMN request_id SET NOT NULL,
  ALTER COLUMN input_payload SET DEFAULT '{}'::jsonb,
  ALTER COLUMN input_payload SET NOT NULL,
  ALTER COLUMN trigger_metadata SET DEFAULT '{}'::jsonb,
  ALTER COLUMN trigger_metadata SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'workflow_executions_triggered_by_user_id_fkey'
  ) THEN
    ALTER TABLE public.workflow_executions
      ADD CONSTRAINT workflow_executions_triggered_by_user_id_fkey
      FOREIGN KEY (triggered_by_user_id)
      REFERENCES auth.users(id)
      ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'workflow_executions_specialist_deployment_id_fkey'
  ) THEN
    ALTER TABLE public.workflow_executions
      ADD CONSTRAINT workflow_executions_specialist_deployment_id_fkey
      FOREIGN KEY (specialist_workflow_deployment_id)
      REFERENCES public.specialist_workflow_deployments(id)
      ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'workflow_executions_source_integration_id_fkey'
  ) THEN
    ALTER TABLE public.workflow_executions
      ADD CONSTRAINT workflow_executions_source_integration_id_fkey
      FOREIGN KEY (source_integration_id)
      REFERENCES public.integrations(id)
      ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'workflow_executions_trigger_source_check'
  ) THEN
    ALTER TABLE public.workflow_executions
      ADD CONSTRAINT workflow_executions_trigger_source_check
      CHECK (trigger_source IN ('manual', 'schedule', 'webhook', 'integration', 'system'));
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS workflow_executions_org_request_uidx
  ON public.workflow_executions (organization_id, request_id);

CREATE INDEX IF NOT EXISTS workflow_executions_triggered_by_user_idx
  ON public.workflow_executions (triggered_by_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS workflow_executions_specialist_deployment_idx
  ON public.workflow_executions (specialist_workflow_deployment_id, created_at DESC);

CREATE INDEX IF NOT EXISTS workflow_executions_source_integration_idx
  ON public.workflow_executions (source_integration_id, created_at DESC);

COMMENT ON COLUMN public.workflow_executions.triggered_by_user_id IS
  'Authenticated user who initiated a manual run. Null for system or integration events.';
COMMENT ON COLUMN public.workflow_executions.specialist_workflow_deployment_id IS
  'Validated capability deployment that owns this execution.';
COMMENT ON COLUMN public.workflow_executions.source_integration_id IS
  'Validated integration that produced an automated event, when applicable.';
COMMENT ON COLUMN public.workflow_executions.request_id IS
  'Tenant-scoped idempotency key used to prevent duplicate workflow starts.';
COMMENT ON COLUMN public.workflow_executions.input_payload IS
  'Original business input after tenant identity has been derived server-side.';
COMMENT ON COLUMN public.workflow_executions.trigger_metadata IS
  'Server-controlled trigger routing and delivery metadata.';
