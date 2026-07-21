-- Configure the first coordinated Sales Specialist capability package.
-- Applies only to existing specialists whose role or name contains "sales".

with sales_specialists as (
  select id, organization_id
  from public.digital_specialists
  where lower(coalesce(role_name, '') || ' ' || coalesce(name, '')) like '%sales%'
),
profile_upsert as (
  insert into public.specialist_role_profiles (
    specialist_id,
    organization_id,
    mission,
    operating_instructions,
    boundaries,
    status,
    metadata
  )
  select
    id,
    organization_id,
    'Keep sales opportunities moving by preparing meetings, capturing commitments, coordinating follow up, maintaining CRM hygiene, and surfacing pipeline risk.',
    'Continuously monitor assigned sales activity, use approved company knowledge, coordinate related capabilities around each opportunity, request approval for governed actions, and escalate uncertainty or risk.',
    array[
      'Do not send external communications without the organization required approval.',
      'Do not change deal stage, value, close date, or ownership without approval.',
      'Do not invent customer commitments, pricing, or product claims.',
      'Escalate when customer identity, deal association, or next steps are uncertain.'
    ]::text[],
    'active',
    jsonb_build_object('package_key', 'sales_specialist_v1')
  from sales_specialists
  on conflict (specialist_id) do update set
    mission = excluded.mission,
    operating_instructions = excluded.operating_instructions,
    boundaries = excluded.boundaries,
    metadata = specialist_role_profiles.metadata || excluded.metadata,
    updated_at = now()
  returning specialist_id
)
insert into public.specialist_capabilities (
  organization_id,
  specialist_id,
  capability_key,
  name,
  description,
  category,
  status,
  autonomy_level,
  success_definition,
  required_integrations,
  required_knowledge,
  position
)
select
  specialist.organization_id,
  specialist.id,
  capability.capability_key,
  capability.name,
  capability.description,
  capability.category,
  'active',
  capability.autonomy_level,
  capability.success_definition,
  capability.required_integrations,
  capability.required_knowledge,
  capability.position
from sales_specialists specialist
cross join (
  values
    (
      'meeting_preparation',
      'Meeting Preparation',
      'Prepare a concise account and opportunity briefing before a scheduled sales meeting.',
      'sales_enablement',
      'recommend',
      'The seller receives an accurate briefing with account context, open questions, risks, and recommended objectives before the meeting.',
      array['google_calendar', 'gmail', 'hubspot']::text[],
      array['sales_process', 'product_information', 'account_history']::text[],
      10
    ),
    (
      'meeting_intelligence',
      'Meeting Intelligence',
      'Summarize meetings and extract decisions, commitments, objections, owners, deadlines, and risks.',
      'sales_execution',
      'recommend',
      'Meeting outcomes are accurately captured and converted into structured actions without inventing details.',
      array['google_calendar', 'meeting_notes']::text[],
      array['sales_process', 'product_information']::text[],
      20
    ),
    (
      'customer_follow_up',
      'Customer Follow Up',
      'Draft personalized follow up communication based on verified meeting outcomes and account context.',
      'communication',
      'execute_with_approval',
      'A relevant follow up is prepared promptly, reflects verified commitments, and is sent only under the organization approval policy.',
      array['gmail', 'google_calendar']::text[],
      array['communication_style', 'product_information', 'sales_process']::text[],
      30
    ),
    (
      'crm_coordination',
      'CRM Coordination',
      'Recommend and apply approved CRM notes, tasks, next steps, and carefully governed opportunity updates.',
      'crm_operations',
      'execute_with_approval',
      'CRM records stay current, actionable, and traceable without unauthorized changes to sensitive opportunity fields.',
      array['hubspot']::text[],
      array['sales_process', 'crm_field_rules']::text[],
      40
    ),
    (
      'pipeline_monitoring',
      'Pipeline Monitoring',
      'Continuously detect stalled opportunities, missing next steps, overdue commitments, unanswered communication, and emerging risk.',
      'sales_operations',
      'recommend',
      'At risk opportunities are surfaced early with evidence and a clear recommended next action.',
      array['hubspot', 'gmail', 'google_calendar']::text[],
      array['sales_process', 'pipeline_rules']::text[],
      50
    )
) as capability(
  capability_key,
  name,
  description,
  category,
  autonomy_level,
  success_definition,
  required_integrations,
  required_knowledge,
  position
)
on conflict (specialist_id, capability_key) do update set
  name = excluded.name,
  description = excluded.description,
  category = excluded.category,
  status = excluded.status,
  autonomy_level = excluded.autonomy_level,
  success_definition = excluded.success_definition,
  required_integrations = excluded.required_integrations,
  required_knowledge = excluded.required_knowledge,
  position = excluded.position,
  updated_at = now();

-- Triggers
insert into public.specialist_triggers (
  organization_id,
  specialist_id,
  capability_id,
  trigger_type,
  provider_key,
  event_key,
  configuration,
  is_active
)
select
  capability.organization_id,
  capability.specialist_id,
  capability.id,
  trigger.trigger_type,
  trigger.provider_key,
  trigger.event_key,
  trigger.configuration,
  true
from public.specialist_capabilities capability
join public.digital_specialists specialist on specialist.id = capability.specialist_id
cross join lateral (
  values
    ('meeting_preparation', 'schedule', 'google_calendar', 'meeting_upcoming', jsonb_build_object('lead_time_minutes', 60)),
    ('meeting_intelligence', 'event', 'google_calendar', 'meeting_completed', '{}'::jsonb),
    ('customer_follow_up', 'event', 'upshot', 'meeting_intelligence_completed', '{}'::jsonb),
    ('crm_coordination', 'event', 'upshot', 'meeting_intelligence_completed', '{}'::jsonb),
    ('pipeline_monitoring', 'monitor', 'upshot', 'pipeline_health_check', jsonb_build_object('cadence', 'daily'))
) as trigger(capability_key, trigger_type, provider_key, event_key, configuration)
where capability.capability_key = trigger.capability_key
  and lower(coalesce(specialist.role_name, '') || ' ' || coalesce(specialist.name, '')) like '%sales%'
  and not exists (
    select 1
    from public.specialist_triggers existing
    where existing.capability_id = capability.id
      and existing.trigger_type = trigger.trigger_type
      and coalesce(existing.provider_key, '') = coalesce(trigger.provider_key, '')
      and coalesce(existing.event_key, '') = coalesce(trigger.event_key, '')
  );

-- Permissions
insert into public.specialist_permissions (
  organization_id,
  specialist_id,
  capability_id,
  action_key,
  resource_key,
  access_mode,
  approval_required,
  approver_roles,
  configuration
)
select
  capability.organization_id,
  capability.specialist_id,
  capability.id,
  permission.action_key,
  permission.resource_key,
  permission.access_mode,
  permission.approval_required,
  permission.approver_roles,
  '{}'::jsonb
from public.specialist_capabilities capability
join public.digital_specialists specialist on specialist.id = capability.specialist_id
cross join lateral (
  values
    ('meeting_preparation', 'read_calendar', 'calendar_events', 'read', false, array['owner', 'admin', 'member']::text[]),
    ('meeting_preparation', 'read_email_context', 'email_threads', 'read', false, array['owner', 'admin', 'member']::text[]),
    ('meeting_preparation', 'read_crm_context', 'crm_records', 'read', false, array['owner', 'admin', 'member']::text[]),
    ('meeting_intelligence', 'create_summary', 'meeting_summary', 'execute', false, array['owner', 'admin', 'member']::text[]),
    ('meeting_intelligence', 'recommend_actions', 'sales_actions', 'recommend', false, array['owner', 'admin', 'member']::text[]),
    ('customer_follow_up', 'draft_email', 'email_draft', 'draft', false, array['owner', 'admin', 'member']::text[]),
    ('customer_follow_up', 'send_email', 'external_email', 'execute', true, array['owner', 'admin', 'member']::text[]),
    ('crm_coordination', 'create_note', 'crm_note', 'execute', true, array['owner', 'admin', 'member']::text[]),
    ('crm_coordination', 'create_task', 'crm_task', 'execute', true, array['owner', 'admin', 'member']::text[]),
    ('crm_coordination', 'update_sensitive_fields', 'crm_opportunity', 'execute', true, array['owner', 'admin']::text[]),
    ('pipeline_monitoring', 'read_pipeline', 'crm_pipeline', 'read', false, array['owner', 'admin', 'member']::text[]),
    ('pipeline_monitoring', 'recommend_next_action', 'pipeline_recommendation', 'recommend', false, array['owner', 'admin', 'member']::text[])
) as permission(capability_key, action_key, resource_key, access_mode, approval_required, approver_roles)
where capability.capability_key = permission.capability_key
  and lower(coalesce(specialist.role_name, '') || ' ' || coalesce(specialist.name, '')) like '%sales%'
on conflict (capability_id, action_key, resource_key) do update set
  access_mode = excluded.access_mode,
  approval_required = excluded.approval_required,
  approver_roles = excluded.approver_roles,
  updated_at = now();

-- Escalation rules
insert into public.specialist_escalation_rules (
  organization_id,
  specialist_id,
  capability_id,
  condition_key,
  name,
  severity,
  route,
  recipient_roles,
  instructions,
  configuration,
  is_active
)
select
  capability.organization_id,
  capability.specialist_id,
  capability.id,
  rule.condition_key,
  rule.name,
  rule.severity,
  'command_center',
  rule.recipient_roles,
  rule.instructions,
  '{}'::jsonb,
  true
from public.specialist_capabilities capability
join public.digital_specialists specialist on specialist.id = capability.specialist_id
cross join lateral (
  values
    ('meeting_intelligence', 'low_confidence', 'Unclear meeting outcome', 'warning', array['owner', 'admin', 'member']::text[], 'Request human review when commitments, owners, deadlines, or customer intent cannot be determined confidently.'),
    ('customer_follow_up', 'recipient_uncertain', 'Uncertain email recipient', 'critical', array['owner', 'admin']::text[], 'Do not prepare a send action until the recipient and account association are verified.'),
    ('crm_coordination', 'deal_match_uncertain', 'Uncertain CRM association', 'critical', array['owner', 'admin']::text[], 'Do not update CRM records until the correct company, contact, and opportunity are confirmed.'),
    ('pipeline_monitoring', 'high_value_risk', 'High value opportunity at risk', 'critical', array['owner', 'admin']::text[], 'Surface the evidence, affected opportunity, last activity, and recommended next action immediately.')
) as rule(capability_key, condition_key, name, severity, recipient_roles, instructions)
where capability.capability_key = rule.capability_key
  and lower(coalesce(specialist.role_name, '') || ' ' || coalesce(specialist.name, '')) like '%sales%'
  and not exists (
    select 1
    from public.specialist_escalation_rules existing
    where existing.specialist_id = capability.specialist_id
      and existing.capability_id = capability.id
      and existing.condition_key = rule.condition_key
  );

-- Outcome metrics
insert into public.specialist_outcome_metrics (
  organization_id,
  specialist_id,
  capability_id,
  metric_key,
  name,
  unit,
  direction,
  measurement_window,
  is_active,
  metadata
)
select
  capability.organization_id,
  capability.specialist_id,
  capability.id,
  metric.metric_key,
  metric.name,
  metric.unit,
  metric.direction,
  metric.measurement_window,
  true,
  '{}'::jsonb
from public.specialist_capabilities capability
join public.digital_specialists specialist on specialist.id = capability.specialist_id
cross join lateral (
  values
    ('meeting_preparation', 'meetings_prepared', 'Meetings prepared', 'count', 'increase', 'monthly'),
    ('meeting_intelligence', 'commitments_captured', 'Commitments captured', 'count', 'increase', 'monthly'),
    ('customer_follow_up', 'follow_up_time_minutes', 'Average meeting to follow up time', 'minutes', 'decrease', 'rolling_30_days'),
    ('customer_follow_up', 'follow_ups_completed', 'Follow ups completed', 'count', 'increase', 'monthly'),
    ('crm_coordination', 'crm_records_updated', 'CRM records updated', 'count', 'increase', 'monthly'),
    ('pipeline_monitoring', 'stalled_deals_surfaced', 'Stalled opportunities surfaced', 'count', 'increase', 'monthly'),
    ('pipeline_monitoring', 'opportunities_with_next_step_percent', 'Opportunities with a next step', 'percent', 'increase', 'rolling_30_days')
) as metric(capability_key, metric_key, name, unit, direction, measurement_window)
where capability.capability_key = metric.capability_key
  and lower(coalesce(specialist.role_name, '') || ' ' || coalesce(specialist.name, '')) like '%sales%'
on conflict (specialist_id, metric_key) do update set
  capability_id = excluded.capability_id,
  name = excluded.name,
  unit = excluded.unit,
  direction = excluded.direction,
  measurement_window = excluded.measurement_window,
  is_active = true,
  updated_at = now();
