-- ScanShield — full Supabase setup
-- Apply in order against a fresh project, then run db/004_seed_demo_data.sql for the verified legal corpus.

-- ===== supabase/migrations/20260909132023_e788ed6c-779f-490e-aef1-7a1a1654e4b9.sql =====
create extension if not exists "pgcrypto";

do $$ begin
  create type public.user_role as enum ('admin', 'inspector', 'enforcement_officer', 'consumer');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.inspection_status as enum
    ('pending', 'compliant', 'non_compliant', 'manual_review', 'rescan_required', 'partially_verified', 'insufficient_evidence');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.rule_status as enum ('draft', 'in_force', 'superseded', 'future', 'archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.rule_check_result as enum ('pass', 'fail', 'manual_review', 'not_applicable', 'rescan_required', 'insufficient_evidence');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.decision_type as enum
    ('confirm_compliant', 'confirm_non_compliant', 'request_rescan', 'mark_not_applicable', 'send_for_review');
exception when duplicate_object then null; end $$;

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key,
  full_name text,
  email text,
  phone text,
  role public.user_role not null default 'consumer',
  employee_id text,
  department text,
  district text,
  profile_photo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create index if not exists profiles_role_idx on public.profiles (role);
drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role public.user_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create index if not exists user_roles_user_idx on public.user_roles (user_id);

create or replace function public.has_role(_user_id uuid, _role public.user_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role);
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select public.has_role(auth.uid(), 'admin'); $$;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles
    where user_id = auth.uid() and role in ('admin', 'inspector', 'enforcement_officer'));
$$;

create or replace function public.is_reviewer()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles
    where user_id = auth.uid() and role in ('admin', 'enforcement_officer'));
$$;

create or replace function public.sync_user_role()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.user_roles where user_id = new.id and role <> new.role;
  insert into public.user_roles (user_id, role) values (new.id, new.role)
  on conflict (user_id, role) do nothing;
  return new;
end;
$$;
drop trigger if exists profiles_sync_role on public.profiles;
create trigger profiles_sync_role after insert or update of role on public.profiles
for each row execute function public.sync_user_role();

create or replace function public.guard_role_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'Only an administrator may change a user role';
  end if;
  return new;
end;
$$;
drop trigger if exists profiles_guard_role on public.profiles;
create trigger profiles_guard_role before update on public.profiles
for each row execute function public.guard_role_change();

create table if not exists public.sellers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  district text,
  state text,
  contact_phone text,
  risk_score numeric not null default 0,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (name, district)
);
grant select, insert, update on public.sellers to authenticated;
grant all on public.sellers to service_role;
alter table public.sellers enable row level security;
create index if not exists sellers_district_idx on public.sellers (district);
drop trigger if exists sellers_set_updated_at on public.sellers;
create trigger sellers_set_updated_at before update on public.sellers
for each row execute function public.set_updated_at();

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  product_name text not null,
  brand text,
  category text,
  manufacturer text,
  package_type text,
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.products to authenticated;
grant all on public.products to service_role;
alter table public.products enable row level security;
create index if not exists products_name_idx on public.products (product_name);
drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at before update on public.products
for each row execute function public.set_updated_at();

create table if not exists public.rules (
  id uuid primary key default gen_random_uuid(),
  rule_key text not null,
  rule_number text not null,
  sub_rule text,
  title text not null,
  description text,
  legal_requirement text,
  source_document text,
  source_url text,
  effective_from date not null,
  effective_to date,
  status public.rule_status not null default 'in_force',
  version integer not null default 1,
  category text,
  field text,
  severity text,
  machine_checkability text,
  human_review_required boolean not null default false,
  required_evidence jsonb not null default '[]'::jsonb,
  applicability jsonb not null default '{}'::jsonb,
  provenance text,
  amendment_note text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (rule_key, version)
);
grant select on public.rules to anon;
grant select, insert, update on public.rules to authenticated;
grant all on public.rules to service_role;
alter table public.rules enable row level security;
create index if not exists rules_key_idx on public.rules (rule_key);
create index if not exists rules_status_idx on public.rules (status);
create index if not exists rules_effective_idx on public.rules (effective_from, effective_to);
drop trigger if exists rules_set_updated_at on public.rules;
create trigger rules_set_updated_at before update on public.rules
for each row execute function public.set_updated_at();

create table if not exists public.rule_exemptions (
  id uuid primary key default gen_random_uuid(),
  exemption_key text not null unique,
  title text not null,
  explanation text,
  rule_keys jsonb not null default '[]'::jsonb,
  conditions jsonb not null default '{}'::jsonb,
  source_document text,
  effective_from date not null,
  effective_to date,
  created_at timestamptz not null default now()
);
grant select on public.rule_exemptions to anon, authenticated;
grant all on public.rule_exemptions to service_role;
alter table public.rule_exemptions enable row level security;

create table if not exists public.legal_documents (
  id uuid primary key default gen_random_uuid(),
  source_id text not null unique,
  title text not null,
  document_url text,
  gazette_reference text,
  published_on date,
  ingested boolean not null default false,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
grant select on public.legal_documents to anon, authenticated;
grant all on public.legal_documents to service_role;
alter table public.legal_documents enable row level security;

create table if not exists public.inspections (
  id uuid primary key default gen_random_uuid(),
  local_id text unique,
  product_id uuid references public.products(id) on delete set null,
  seller_id uuid references public.sellers(id) on delete set null,
  inspector_id uuid references public.profiles(id) on delete set null,
  status public.inspection_status not null default 'pending',
  system_status public.inspection_status,
  confidence numeric,
  latitude numeric,
  longitude numeric,
  location_accuracy numeric,
  package_image_url text,
  classification jsonb not null default '{}'::jsonb,
  is_demo boolean not null default false,
  inspection_date timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.inspections to authenticated;
grant all on public.inspections to service_role;
alter table public.inspections enable row level security;
create index if not exists inspections_inspector_idx on public.inspections (inspector_id);
create index if not exists inspections_status_idx on public.inspections (status);
create index if not exists inspections_date_idx on public.inspections (inspection_date desc);
create index if not exists inspections_seller_idx on public.inspections (seller_id);
drop trigger if exists inspections_set_updated_at on public.inspections;
create trigger inspections_set_updated_at before update on public.inspections
for each row execute function public.set_updated_at();

create table if not exists public.ocr_results (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references public.inspections(id) on delete cascade,
  field_name text not null,
  detected_value text,
  confidence numeric,
  evidence_url text,
  bounding_box jsonb,
  status text,
  created_at timestamptz not null default now(),
  unique (inspection_id, field_name)
);
grant select, insert, update, delete on public.ocr_results to authenticated;
grant all on public.ocr_results to service_role;
alter table public.ocr_results enable row level security;
create index if not exists ocr_results_inspection_idx on public.ocr_results (inspection_id);

create table if not exists public.rule_checks (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references public.inspections(id) on delete cascade,
  rule_id uuid references public.rules(id) on delete set null,
  rule_key text,
  rule_version integer,
  result public.rule_check_result not null,
  reason text,
  confidence numeric,
  evidence text,
  created_at timestamptz not null default now(),
  unique (inspection_id, rule_key)
);
grant select, insert, update, delete on public.rule_checks to authenticated;
grant all on public.rule_checks to service_role;
alter table public.rule_checks enable row level security;
create index if not exists rule_checks_inspection_idx on public.rule_checks (inspection_id);
create index if not exists rule_checks_rule_idx on public.rule_checks (rule_id);

create table if not exists public.decisions (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references public.inspections(id) on delete cascade,
  officer_id uuid references public.profiles(id) on delete set null,
  decision public.decision_type not null,
  note text,
  created_at timestamptz not null default now()
);
grant select, insert on public.decisions to authenticated;
grant all on public.decisions to service_role;
alter table public.decisions enable row level security;
create index if not exists decisions_inspection_idx on public.decisions (inspection_id);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references public.inspections(id) on delete cascade,
  report_number text unique,
  report_url text,
  generated_at timestamptz not null default now(),
  generated_by uuid references public.profiles(id) on delete set null
);
grant select, insert on public.reports to authenticated;
grant all on public.reports to service_role;
alter table public.reports enable row level security;
create index if not exists reports_inspection_idx on public.reports (inspection_id);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  inspection_id uuid references public.inspections(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb,
  created_at timestamptz not null default now()
);
grant select, insert on public.audit_logs to authenticated;
grant all on public.audit_logs to service_role;
alter table public.audit_logs enable row level security;
create index if not exists audit_logs_created_idx on public.audit_logs (created_at desc);
create index if not exists audit_logs_user_idx on public.audit_logs (user_id);

create table if not exists public.consumer_checks (
  id uuid primary key default gen_random_uuid(),
  consumer_id uuid references public.profiles(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text,
  package_image_url text,
  status text,
  confidence numeric,
  findings jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
grant select, insert, delete on public.consumer_checks to authenticated;
grant all on public.consumer_checks to service_role;
alter table public.consumer_checks enable row level security;
create index if not exists consumer_checks_consumer_idx on public.consumer_checks (consumer_id, created_at desc);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text,
  message text,
  type text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.notifications to authenticated;
grant all on public.notifications to service_role;
alter table public.notifications enable row level security;
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);

create or replace function public.create_rule_version(
  _rule_key text,
  _title text,
  _rule_number text,
  _legal_requirement text,
  _description text,
  _effective_from date,
  _source_document text default null,
  _amendment_note text default null
)
returns public.rules
language plpgsql security definer set search_path = public as $$
declare
  prev public.rules;
  created public.rules;
begin
  if not public.is_admin() then
    raise exception 'Only an administrator may create a rule version';
  end if;

  select * into prev from public.rules where rule_key = _rule_key order by version desc limit 1;
  if prev.id is null then
    raise exception 'Unknown rule_key %', _rule_key;
  end if;

  update public.rules
     set effective_to = (_effective_from - interval '1 day')::date,
         status = 'superseded'
   where id = prev.id;

  insert into public.rules (
    rule_key, rule_number, sub_rule, title, description, legal_requirement,
    source_document, source_url, effective_from, effective_to, status, version,
    category, field, severity, machine_checkability, human_review_required,
    required_evidence, applicability, provenance, amendment_note, created_by
  ) values (
    _rule_key, _rule_number, prev.sub_rule, _title, _description, _legal_requirement,
    coalesce(_source_document, prev.source_document), prev.source_url,
    _effective_from, null,
    case when _effective_from > current_date then 'future'::public.rule_status else 'in_force'::public.rule_status end,
    prev.version + 1,
    prev.category, prev.field, prev.severity, prev.machine_checkability, prev.human_review_required,
    prev.required_evidence, prev.applicability, prev.provenance, _amendment_note, auth.uid()
  ) returning * into created;

  insert into public.audit_logs (user_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'rule_updated', 'rules', created.id,
          jsonb_build_object('rule_key', _rule_key, 'from_version', prev.version, 'to_version', created.version));

  return created;
end;
$$;

grant execute on function public.create_rule_version(text, text, text, text, text, date, text, text) to authenticated;
-- ===== supabase/migrations/20260909132117_d5cb11e8-db45-49f4-b3ff-17a4cd071102.sql =====
revoke execute on function public.has_role(uuid, public.user_role) from anon, public;
revoke execute on function public.is_admin() from anon, public;
revoke execute on function public.is_staff() from anon, public;
revoke execute on function public.is_reviewer() from anon, public;
revoke execute on function public.sync_user_role() from anon, authenticated, public;
revoke execute on function public.guard_role_change() from anon, authenticated, public;
revoke execute on function public.set_updated_at() from anon, authenticated, public;
revoke execute on function public.create_rule_version(text, text, text, text, text, date, text, text) from anon, public;
grant execute on function public.has_role(uuid, public.user_role) to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_staff() to authenticated;
grant execute on function public.is_reviewer() to authenticated;
grant execute on function public.create_rule_version(text, text, text, text, text, date, text, text) to authenticated;

drop policy if exists "profiles read own" on public.profiles;
create policy "profiles read own" on public.profiles
for select to authenticated using (id = auth.uid() or public.is_staff());

drop policy if exists "profiles insert own" on public.profiles;
create policy "profiles insert own" on public.profiles
for insert to authenticated with check (id = auth.uid());

drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own" on public.profiles
for update to authenticated using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());

drop policy if exists "user_roles read own" on public.user_roles;
create policy "user_roles read own" on public.user_roles
for select to authenticated using (user_id = auth.uid() or public.is_admin());

drop policy if exists "rules public read" on public.rules;
create policy "rules public read" on public.rules
for select to anon, authenticated using (true);

drop policy if exists "rules admin insert" on public.rules;
create policy "rules admin insert" on public.rules
for insert to authenticated with check (public.is_admin());

drop policy if exists "rules admin update" on public.rules;
create policy "rules admin update" on public.rules
for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "exemptions public read" on public.rule_exemptions;
create policy "exemptions public read" on public.rule_exemptions
for select to anon, authenticated using (true);

drop policy if exists "legal documents public read" on public.legal_documents;
create policy "legal documents public read" on public.legal_documents
for select to anon, authenticated using (true);

drop policy if exists "legal documents admin write" on public.legal_documents;
create policy "legal documents admin write" on public.legal_documents
for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "sellers staff read" on public.sellers;
create policy "sellers staff read" on public.sellers
for select to authenticated using (public.is_staff());

drop policy if exists "sellers staff insert" on public.sellers;
create policy "sellers staff insert" on public.sellers
for insert to authenticated with check (public.is_staff());

drop policy if exists "sellers staff update" on public.sellers;
create policy "sellers staff update" on public.sellers
for update to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists "products read" on public.products;
create policy "products read" on public.products
for select to authenticated using (true);

drop policy if exists "products insert" on public.products;
create policy "products insert" on public.products
for insert to authenticated with check (true);

drop policy if exists "products staff update" on public.products;
create policy "products staff update" on public.products
for update to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists "inspections read" on public.inspections;
create policy "inspections read" on public.inspections
for select to authenticated using (inspector_id = auth.uid() or public.is_reviewer());

drop policy if exists "inspections insert" on public.inspections;
create policy "inspections insert" on public.inspections
for insert to authenticated with check (public.is_staff() and inspector_id = auth.uid());

drop policy if exists "inspections update" on public.inspections;
create policy "inspections update" on public.inspections
for update to authenticated
using (inspector_id = auth.uid() or public.is_reviewer())
with check (inspector_id = auth.uid() or public.is_reviewer());

drop policy if exists "ocr read via inspection" on public.ocr_results;
create policy "ocr read via inspection" on public.ocr_results
for select to authenticated using (exists (
  select 1 from public.inspections i where i.id = inspection_id
    and (i.inspector_id = auth.uid() or public.is_reviewer())));

drop policy if exists "ocr write via inspection" on public.ocr_results;
create policy "ocr write via inspection" on public.ocr_results
for all to authenticated
using (exists (select 1 from public.inspections i where i.id = inspection_id
  and (i.inspector_id = auth.uid() or public.is_reviewer())))
with check (exists (select 1 from public.inspections i where i.id = inspection_id
  and (i.inspector_id = auth.uid() or public.is_reviewer())));

drop policy if exists "rule checks read via inspection" on public.rule_checks;
create policy "rule checks read via inspection" on public.rule_checks
for select to authenticated using (exists (
  select 1 from public.inspections i where i.id = inspection_id
    and (i.inspector_id = auth.uid() or public.is_reviewer())));

drop policy if exists "rule checks write via inspection" on public.rule_checks;
create policy "rule checks write via inspection" on public.rule_checks
for all to authenticated
using (exists (select 1 from public.inspections i where i.id = inspection_id
  and (i.inspector_id = auth.uid() or public.is_reviewer())))
with check (exists (select 1 from public.inspections i where i.id = inspection_id
  and (i.inspector_id = auth.uid() or public.is_reviewer())));

drop policy if exists "decisions read" on public.decisions;
create policy "decisions read" on public.decisions
for select to authenticated using (exists (
  select 1 from public.inspections i where i.id = inspection_id
    and (i.inspector_id = auth.uid() or public.is_reviewer())));

drop policy if exists "decisions insert" on public.decisions;
create policy "decisions insert" on public.decisions
for insert to authenticated with check (
  officer_id = auth.uid() and exists (
    select 1 from public.inspections i where i.id = inspection_id
      and (i.inspector_id = auth.uid() or public.is_reviewer())));

drop policy if exists "reports read" on public.reports;
create policy "reports read" on public.reports
for select to authenticated using (exists (
  select 1 from public.inspections i where i.id = inspection_id
    and (i.inspector_id = auth.uid() or public.is_reviewer())));

drop policy if exists "reports insert" on public.reports;
create policy "reports insert" on public.reports
for insert to authenticated with check (
  generated_by = auth.uid() and exists (
    select 1 from public.inspections i where i.id = inspection_id
      and (i.inspector_id = auth.uid() or public.is_reviewer())));

drop policy if exists "audit read" on public.audit_logs;
create policy "audit read" on public.audit_logs
for select to authenticated using (public.is_admin() or user_id = auth.uid());

drop policy if exists "audit append" on public.audit_logs;
create policy "audit append" on public.audit_logs
for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "consumer checks own" on public.consumer_checks;
create policy "consumer checks own" on public.consumer_checks
for select to authenticated using (consumer_id = auth.uid() or public.is_admin());

drop policy if exists "consumer checks insert own" on public.consumer_checks;
create policy "consumer checks insert own" on public.consumer_checks
for insert to authenticated with check (consumer_id = auth.uid());

drop policy if exists "consumer checks delete own" on public.consumer_checks;
create policy "consumer checks delete own" on public.consumer_checks
for delete to authenticated using (consumer_id = auth.uid());

drop policy if exists "notifications own" on public.notifications;
create policy "notifications own" on public.notifications
for select to authenticated using (user_id = auth.uid());

drop policy if exists "notifications update own" on public.notifications;
create policy "notifications update own" on public.notifications
for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "notifications insert" on public.notifications;
create policy "notifications insert" on public.notifications
for insert to authenticated with check (public.is_staff() or user_id = auth.uid());

drop policy if exists "notifications delete own" on public.notifications;
create policy "notifications delete own" on public.notifications
for delete to authenticated using (user_id = auth.uid());
-- ===== storage buckets (private) =====
insert into storage.buckets (id, name, public) values
  ('package-images','package-images', false),
  ('evidence','evidence', false),
  ('profile-images','profile-images', false),
  ('reports','reports', false),
  ('legal-documents','legal-documents', false)
on conflict (id) do nothing;

-- ===== supabase/migrations/20260909132209_657386db-2560-4e66-84ee-2b7d76f07f4d.sql =====
drop policy if exists "package images owner write" on storage.objects;
create policy "package images owner write" on storage.objects
for insert to authenticated
with check (bucket_id = 'package-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "package images read" on storage.objects;
create policy "package images read" on storage.objects
for select to authenticated
using (bucket_id = 'package-images' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_staff()));

drop policy if exists "package images owner delete" on storage.objects;
create policy "package images owner delete" on storage.objects
for delete to authenticated
using (bucket_id = 'package-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "evidence owner write" on storage.objects;
create policy "evidence owner write" on storage.objects
for insert to authenticated
with check (bucket_id = 'evidence' and public.is_staff() and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "evidence staff read" on storage.objects;
create policy "evidence staff read" on storage.objects
for select to authenticated
using (bucket_id = 'evidence' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_reviewer()));

drop policy if exists "profile images own" on storage.objects;
create policy "profile images own" on storage.objects
for all to authenticated
using (bucket_id = 'profile-images' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'profile-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "reports owner write" on storage.objects;
create policy "reports owner write" on storage.objects
for insert to authenticated
with check (bucket_id = 'reports' and public.is_staff() and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "reports read" on storage.objects;
create policy "reports read" on storage.objects
for select to authenticated
using (bucket_id = 'reports' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_reviewer()));

drop policy if exists "legal documents read" on storage.objects;
create policy "legal documents read" on storage.objects
for select to authenticated using (bucket_id = 'legal-documents');

drop policy if exists "legal documents admin write" on storage.objects;
create policy "legal documents admin write" on storage.objects
for all to authenticated
using (bucket_id = 'legal-documents' and public.is_admin())
with check (bucket_id = 'legal-documents' and public.is_admin());
-- ===== supabase/migrations/20260909132453_d57ad52c-4eba-41ec-ae7f-2896e56b7771.sql =====
alter table public.inspections add column if not exists payload jsonb not null default '{}'::jsonb;
alter table public.inspections add column if not exists product_name text;
alter table public.inspections add column if not exists seller_name text;
alter table public.inspections add column if not exists district text;
-- ===== supabase/migrations/20260909132530_6da5d40f-d936-46f5-852c-60d26c24eae4.sql =====
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
-- ===== supabase/migrations/20260909132647_98e6bf2c-9c8e-4743-8cb0-31c520c6f256.sql =====
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

-- ===== next step =====
-- Run db/004_seed_demo_data.sql to load the verified Legal Metrology corpus
-- (29 provisions, 6 exemptions, 1 legal source, demo sellers) into this project.
