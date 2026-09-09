-- ScanShield — 003_storage.sql
-- Private buckets and their access policies. Run after 001. Re-runnable.

insert into storage.buckets (id, name, public) values
  ('package-images','package-images', false),
  ('evidence','evidence', false),
  ('profile-images','profile-images', false),
  ('reports','reports', false),
  ('legal-documents','legal-documents', false)
on conflict (id) do nothing;

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
