-- Stateful decisions for the Upshot Command Center.
-- Only unresolved decisions belong in the active Attention Queue.

create table if not exists public.command_decisions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  specialist_id uuid references public.digital_specialists(id) on delete set null,
  capability_id uuid references public.specialist_capabilities(id) on delete set null,
  workflow_execution_id uuid references public.workflow_executions(id) on delete set null,
  source_activity_log_id uuid references public.activity_logs(id) on delete set null,
  category text not null check (category in ('approval', 'exception', 'recommendation', 'risk')),
  status text not null default 'open' check (status in ('open', 'in_review', 'approved', 'rejected', 'resolved', 'expired')),
  urgency text not null default 'normal' check (urgency in ('critical', 'high', 'normal', 'low')),
  title text not null,
  summary text not null default '',
  business_impact text not null default '',
  recommended_action text not null default '',
  requested_decision text not null default '',
  assigned_user_id uuid references auth.users(id) on delete set null,
  assigned_role text check (assigned_role is null or assigned_role in ('owner', 'admin', 'member')),
  due_at timestamptz,
  resolution_note text,
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (status in ('open', 'in_review') and resolved_at is null)
    or
    (status in ('approved', 'rejected', 'resolved', 'expired'))
  )
);

create index if not exists command_decisions_active_queue_idx
  on public.command_decisions (organization_id, status, urgency, created_at desc);

create index if not exists command_decisions_specialist_idx
  on public.command_decisions (specialist_id, status, created_at desc);

create unique index if not exists command_decisions_source_activity_unique_idx
  on public.command_decisions (source_activity_log_id)
  where source_activity_log_id is not null;

alter table public.command_decisions enable row level security;

drop policy if exists "organization members can view command decisions" on public.command_decisions;
create policy "organization members can view command decisions"
  on public.command_decisions
  for select
  using (
    exists (
      select 1
      from public.organization_members member
      where member.organization_id = command_decisions.organization_id
        and member.user_id = auth.uid()
    )
  );

drop policy if exists "organization members can create command decisions" on public.command_decisions;
create policy "organization members can create command decisions"
  on public.command_decisions
  for insert
  with check (
    exists (
      select 1
      from public.organization_members member
      where member.organization_id = command_decisions.organization_id
        and member.user_id = auth.uid()
    )
  );

drop policy if exists "authorized members can update command decisions" on public.command_decisions;
create policy "authorized members can update command decisions"
  on public.command_decisions
  for update
  using (
    exists (
      select 1
      from public.organization_members member
      where member.organization_id = command_decisions.organization_id
        and member.user_id = auth.uid()
        and (
          member.role in ('owner', 'admin')
          or command_decisions.assigned_user_id = auth.uid()
          or command_decisions.assigned_role = member.role
        )
    )
  )
  with check (
    exists (
      select 1
      from public.organization_members member
      where member.organization_id = command_decisions.organization_id
        and member.user_id = auth.uid()
        and (
          member.role in ('owner', 'admin')
          or command_decisions.assigned_user_id = auth.uid()
          or command_decisions.assigned_role = member.role
        )
    )
  );

create or replace function public.set_command_decision_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();

  if new.status in ('approved', 'rejected', 'resolved', 'expired')
     and old.status is distinct from new.status then
    new.resolved_at = coalesce(new.resolved_at, now());
    new.resolved_by = coalesce(new.resolved_by, auth.uid());
  elsif new.status in ('open', 'in_review') then
    new.resolved_at = null;
    new.resolved_by = null;
  end if;

  return new;
end;
$$;

drop trigger if exists set_command_decision_updated_at on public.command_decisions;
create trigger set_command_decision_updated_at
before update on public.command_decisions
for each row execute function public.set_command_decision_updated_at();

-- Existing administrative audit events are intentionally not backfilled.
-- New decisions should only be created when a real unresolved judgment exists.
