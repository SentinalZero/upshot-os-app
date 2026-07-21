create table if not exists public.organization_subscriptions (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  plan_key text not null default 'starter' check (plan_key in ('starter')),
  status text not null default 'trialing' check (status in ('trialing', 'active', 'past_due', 'paused', 'canceled')),
  monthly_price_cents integer not null default 9900 check (monthly_price_cents >= 0),
  workflow_run_limit integer not null default 500 check (workflow_run_limit > 0),
  retention_days integer not null default 30 check (retention_days > 0),
  trial_ends_at timestamptz not null default (now() + interval '14 days'),
  current_period_start timestamptz not null default date_trunc('month', now()),
  current_period_end timestamptz not null default (date_trunc('month', now()) + interval '1 month'),
  external_customer_id text,
  external_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.organization_subscriptions enable row level security;

drop policy if exists "organization members can view subscriptions" on public.organization_subscriptions;
create policy "organization members can view subscriptions"
  on public.organization_subscriptions for select
  using (exists (
    select 1 from public.organization_members member
    where member.organization_id = organization_subscriptions.organization_id
      and member.user_id = auth.uid()
  ));

insert into public.organization_subscriptions (organization_id)
select id from public.organizations
on conflict (organization_id) do nothing;

create index if not exists workflow_executions_org_created_idx
  on public.workflow_executions (organization_id, created_at desc);
