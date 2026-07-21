-- Shared role and capability model for Digital Specialists.
-- Existing specialist_workflow_deployments remain the executable workflow layer.

create table if not exists public.specialist_role_profiles (
  specialist_id uuid primary key references public.digital_specialists(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  mission text not null default '',
  operating_instructions text not null default '',
  boundaries text[] not null default '{}'::text[],
  status text not null default 'draft' check (status in ('draft', 'ready', 'active', 'paused', 'retired')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.specialist_capabilities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  specialist_id uuid not null references public.digital_specialists(id) on delete cascade,
  workflow_deployment_id uuid references public.specialist_workflow_deployments(id) on delete set null,
  capability_key text not null,
  name text not null,
  description text not null default '',
  category text not null default 'operations',
  status text not null default 'draft' check (status in ('draft', 'ready', 'active', 'paused', 'retired')),
  autonomy_level text not null default 'recommend' check (autonomy_level in ('observe', 'draft', 'recommend', 'execute_with_approval', 'execute')),
  success_definition text not null default '',
  required_integrations text[] not null default '{}'::text[],
  required_knowledge text[] not null default '{}'::text[],
  input_schema jsonb not null default '{}'::jsonb,
  output_schema jsonb not null default '{}'::jsonb,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (specialist_id, capability_key)
);

create table if not exists public.specialist_triggers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  specialist_id uuid not null references public.digital_specialists(id) on delete cascade,
  capability_id uuid not null references public.specialist_capabilities(id) on delete cascade,
  trigger_type text not null check (trigger_type in ('manual', 'event', 'schedule', 'monitor')),
  provider_key text,
  event_key text,
  configuration jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.specialist_permissions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  specialist_id uuid not null references public.digital_specialists(id) on delete cascade,
  capability_id uuid not null references public.specialist_capabilities(id) on delete cascade,
  action_key text not null,
  resource_key text not null,
  access_mode text not null check (access_mode in ('read', 'draft', 'recommend', 'execute')),
  approval_required boolean not null default true,
  approver_roles text[] not null default array['owner', 'admin']::text[],
  configuration jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (approver_roles <@ array['owner', 'admin', 'member']::text[]),
  unique (capability_id, action_key, resource_key)
);

create table if not exists public.specialist_escalation_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  specialist_id uuid not null references public.digital_specialists(id) on delete cascade,
  capability_id uuid references public.specialist_capabilities(id) on delete cascade,
  condition_key text not null,
  name text not null,
  severity text not null default 'warning' check (severity in ('info', 'warning', 'critical')),
  route text not null default 'command_center' check (route in ('command_center', 'email', 'slack')),
  recipient_roles text[] not null default array['owner', 'admin']::text[],
  instructions text not null default '',
  configuration jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (recipient_roles <@ array['owner', 'admin', 'member']::text[])
);

create table if not exists public.specialist_knowledge_sources (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  specialist_id uuid not null references public.digital_specialists(id) on delete cascade,
  title text not null,
  source_type text not null check (source_type in ('document', 'url', 'manual', 'integration')),
  external_reference text,
  status text not null default 'pending' check (status in ('pending', 'active', 'error', 'disabled')),
  configuration jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.specialist_outcome_metrics (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  specialist_id uuid not null references public.digital_specialists(id) on delete cascade,
  capability_id uuid references public.specialist_capabilities(id) on delete cascade,
  metric_key text not null,
  name text not null,
  unit text not null default 'count',
  target_value numeric,
  direction text not null default 'increase' check (direction in ('increase', 'decrease', 'maintain')),
  measurement_window text not null default 'monthly' check (measurement_window in ('daily', 'weekly', 'monthly', 'rolling_30_days')),
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (specialist_id, metric_key)
);

create index if not exists specialist_capabilities_org_specialist_idx
  on public.specialist_capabilities (organization_id, specialist_id, status, position);
create index if not exists specialist_triggers_capability_idx
  on public.specialist_triggers (capability_id, is_active);
create index if not exists specialist_permissions_capability_idx
  on public.specialist_permissions (capability_id);
create index if not exists specialist_escalations_specialist_idx
  on public.specialist_escalation_rules (specialist_id, is_active, severity);
create index if not exists specialist_knowledge_specialist_idx
  on public.specialist_knowledge_sources (specialist_id, status);
create index if not exists specialist_metrics_specialist_idx
  on public.specialist_outcome_metrics (specialist_id, is_active);

alter table public.specialist_role_profiles enable row level security;
alter table public.specialist_capabilities enable row level security;
alter table public.specialist_triggers enable row level security;
alter table public.specialist_permissions enable row level security;
alter table public.specialist_escalation_rules enable row level security;
alter table public.specialist_knowledge_sources enable row level security;
alter table public.specialist_outcome_metrics enable row level security;

drop policy if exists "organization members can view specialist role profiles" on public.specialist_role_profiles;
create policy "organization members can view specialist role profiles"
  on public.specialist_role_profiles for select
  using (exists (select 1 from public.organization_members member where member.organization_id = specialist_role_profiles.organization_id and member.user_id = auth.uid()));

drop policy if exists "organization members can view specialist capabilities" on public.specialist_capabilities;
create policy "organization members can view specialist capabilities"
  on public.specialist_capabilities for select
  using (exists (select 1 from public.organization_members member where member.organization_id = specialist_capabilities.organization_id and member.user_id = auth.uid()));

drop policy if exists "organization members can view specialist triggers" on public.specialist_triggers;
create policy "organization members can view specialist triggers"
  on public.specialist_triggers for select
  using (exists (select 1 from public.organization_members member where member.organization_id = specialist_triggers.organization_id and member.user_id = auth.uid()));

drop policy if exists "organization members can view specialist permissions" on public.specialist_permissions;
create policy "organization members can view specialist permissions"
  on public.specialist_permissions for select
  using (exists (select 1 from public.organization_members member where member.organization_id = specialist_permissions.organization_id and member.user_id = auth.uid()));

drop policy if exists "organization members can view specialist escalation rules" on public.specialist_escalation_rules;
create policy "organization members can view specialist escalation rules"
  on public.specialist_escalation_rules for select
  using (exists (select 1 from public.organization_members member where member.organization_id = specialist_escalation_rules.organization_id and member.user_id = auth.uid()));

drop policy if exists "organization members can view specialist knowledge sources" on public.specialist_knowledge_sources;
create policy "organization members can view specialist knowledge sources"
  on public.specialist_knowledge_sources for select
  using (exists (select 1 from public.organization_members member where member.organization_id = specialist_knowledge_sources.organization_id and member.user_id = auth.uid()));

drop policy if exists "organization members can view specialist outcome metrics" on public.specialist_outcome_metrics;
create policy "organization members can view specialist outcome metrics"
  on public.specialist_outcome_metrics for select
  using (exists (select 1 from public.organization_members member where member.organization_id = specialist_outcome_metrics.organization_id and member.user_id = auth.uid()));
