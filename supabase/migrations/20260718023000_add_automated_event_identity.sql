-- Add stable external event identity for automated integration triggers.
-- This prevents a Google Calendar, Gmail, or other connected-system event from
-- registering the same workflow execution more than once.

ALTER TABLE public.workflow_executions
  ADD COLUMN IF NOT EXISTS external_event_id text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'workflow_executions_external_event_id_length_check'
  ) THEN
    ALTER TABLE public.workflow_executions
      ADD CONSTRAINT workflow_executions_external_event_id_length_check
      CHECK (external_event_id IS NULL OR length(external_event_id) BETWEEN 1 AND 512);
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS workflow_executions_integration_event_uidx
  ON public.workflow_executions (
    source_integration_id,
    specialist_workflow_deployment_id,
    external_event_id
  )
  WHERE source_integration_id IS NOT NULL
    AND specialist_workflow_deployment_id IS NOT NULL
    AND external_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS workflow_executions_external_event_idx
  ON public.workflow_executions (external_event_id, created_at DESC)
  WHERE external_event_id IS NOT NULL;

COMMENT ON COLUMN public.workflow_executions.external_event_id IS
  'Stable provider event identifier used to deduplicate automated integration events.';
