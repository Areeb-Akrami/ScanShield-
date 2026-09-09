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