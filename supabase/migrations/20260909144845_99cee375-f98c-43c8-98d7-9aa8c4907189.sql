create table if not exists public.complaints (
  id uuid primary key default gen_random_uuid(),
  consumer_id uuid not null references public.profiles(id) on delete cascade,
  product text not null,
  seller text,
  issue_type text not null,
  description text not null,
  image_url text,
  status text not null default 'submitted',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert on public.complaints to authenticated;
grant update on public.complaints to authenticated;
grant all on public.complaints to service_role;

alter table public.complaints enable row level security;

create policy "complaints insert own" on public.complaints
  for insert to authenticated with check (consumer_id = auth.uid());

create policy "complaints read own or staff" on public.complaints
  for select to authenticated using (consumer_id = auth.uid() or public.is_staff());

create policy "complaints staff update" on public.complaints
  for update to authenticated using (public.is_staff()) with check (public.is_staff());

create trigger complaints_set_updated_at
  before update on public.complaints
  for each row execute function public.set_updated_at();

create index if not exists complaints_consumer_idx on public.complaints (consumer_id, created_at desc);