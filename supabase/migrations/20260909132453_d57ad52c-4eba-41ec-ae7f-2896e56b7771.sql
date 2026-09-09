alter table public.inspections add column if not exists payload jsonb not null default '{}'::jsonb;
alter table public.inspections add column if not exists product_name text;
alter table public.inspections add column if not exists seller_name text;
alter table public.inspections add column if not exists district text;