create table if not exists public.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role text not null check (role in ('admin', 'member')),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked', 'expired')),
  invited_by_user_id uuid not null references auth.users(id),
  invited_at timestamptz not null default now(),
  accepted_at timestamptz,
  revoked_at timestamptz,
  expires_at timestamptz not null default (now() + interval '7 days')
);

create unique index if not exists organization_invitations_pending_email_idx
  on public.organization_invitations (organization_id, lower(email))
  where status = 'pending';

alter table public.organization_invitations enable row level security;

create policy "organization members can view invitations"
  on public.organization_invitations for select
  using (exists (
    select 1 from public.organization_members member
    where member.organization_id = organization_invitations.organization_id
      and member.user_id = auth.uid()
  ));

create or replace function public.accept_upshot_organization_invitation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  invitation_id uuid;
  invitation_record public.organization_invitations%rowtype;
begin
  begin
    invitation_id := nullif(new.raw_user_meta_data ->> 'upshot_invitation_id', '')::uuid;
  exception when others then
    invitation_id := null;
  end;

  if invitation_id is null then
    return new;
  end if;

  select * into invitation_record
  from public.organization_invitations
  where id = invitation_id
    and status = 'pending'
    and lower(email) = lower(new.email)
    and expires_at > now()
  for update;

  if not found then
    return new;
  end if;

  insert into public.organization_members (organization_id, user_id, role)
  values (invitation_record.organization_id, new.id, invitation_record.role)
  on conflict (organization_id, user_id) do update set role = excluded.role;

  update public.profiles
  set active_organization_id = coalesce(active_organization_id, invitation_record.organization_id)
  where id = new.id;

  update public.organization_invitations
  set status = 'accepted', accepted_at = now()
  where id = invitation_record.id;

  return new;
end;
$$;

drop trigger if exists accept_upshot_organization_invitation_trigger on auth.users;
create trigger accept_upshot_organization_invitation_trigger
after insert on auth.users
for each row execute function public.accept_upshot_organization_invitation();
