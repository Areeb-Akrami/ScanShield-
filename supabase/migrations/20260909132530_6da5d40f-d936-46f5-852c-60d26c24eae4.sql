create or replace function public.is_admin() returns boolean
language sql stable security invoker set search_path = public as $$
  select public.has_role(auth.uid(), 'admin')
$$;

create or replace function public.is_reviewer() returns boolean
language sql stable security invoker set search_path = public as $$
  select public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'enforcement_officer')
$$;

create or replace function public.is_staff() returns boolean
language sql stable security invoker set search_path = public as $$
  select public.has_role(auth.uid(), 'admin')
      or public.has_role(auth.uid(), 'enforcement_officer')
      or public.has_role(auth.uid(), 'inspector')
$$;