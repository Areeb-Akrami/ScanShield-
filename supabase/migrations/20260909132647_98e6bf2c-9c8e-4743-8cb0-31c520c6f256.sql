create or replace function public.guard_role_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.has_role(auth.uid(), 'admin') then
    new.role := 'consumer';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_role_insert() from public, anon, authenticated;

drop trigger if exists profiles_guard_role_insert on public.profiles;
create trigger profiles_guard_role_insert
before insert on public.profiles
for each row execute function public.guard_role_insert();