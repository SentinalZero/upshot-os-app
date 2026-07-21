create table if not exists public.organization_approval_policies (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  email_mode text not null default 'draft_only' check (email_mode in ('draft_only', 'approval_required', 'auto_send_after_approval')),
  approver_roles text[] not null default array['owner', 'admin']::text[],
  sender_roles text[] not null default array['owner', 'admin']::text[],
  updated_by_user_id uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (approver_roles <@ array['owner', 'admin', 'member']::text[]),
  check (sender_roles <@ array['owner', 'admin', 'member']::text[]),
  check (cardinality(approver_roles) > 0),
  check (cardinality(sender_roles) > 0)
);

alter table public.organization_approval_policies enable row level security;

drop policy if exists "organization members can view approval policies" on public.organization_approval_policies;
create policy "organization members can view approval policies"
  on public.organization_approval_policies for select
  using (exists (
    select 1 from public.organization_members member
    where member.organization_id = organization_approval_policies.organization_id
      and member.user_id = auth.uid()
  ));

insert into public.organization_approval_policies (organization_id)
select id from public.organizations
on conflict (organization_id) do nothing;
