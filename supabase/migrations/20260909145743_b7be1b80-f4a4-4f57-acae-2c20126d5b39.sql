alter table public.profiles
  add column if not exists account_status text not null default 'active';

alter table public.profiles
  drop constraint if exists profiles_account_status_check;
alter table public.profiles
  add constraint profiles_account_status_check
  check (account_status in ('active','suspended','deactivated'));

create or replace function public.guard_role_change()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  -- auth.uid() is null for trusted server-side administration (service role),
  -- which is only reachable after the caller has been verified as an administrator.
  if new.role is distinct from old.role and auth.uid() is not null and not public.is_admin() then
    raise exception 'Only an administrator may change a user role';
  end if;
  return new;
end;
$$;