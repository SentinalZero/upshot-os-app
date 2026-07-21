create table if not exists public.stripe_webhook_events (
  stripe_event_id text primary key,
  event_type text not null,
  organization_id uuid references public.organizations(id) on delete set null,
  processed_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb
);

alter table public.stripe_webhook_events enable row level security;

create index if not exists stripe_webhook_events_org_processed_idx
  on public.stripe_webhook_events (organization_id, processed_at desc);
