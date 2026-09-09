# ScanShield — moving to your own Supabase project

Target project: `qpwzsipmbxzfwbvguujw` (`https://qpwzsipmbxzfwbvguujw.supabase.co`)

Nothing in the current backend is deleted or disconnected by this process. The
existing project stays live and untouched until you confirm the new one passes
the checklist at the bottom.

---

## What is automated (already done in this repository)

| File | Contents |
| --- | --- |
| `SUPABASE_SETUP.sql` | Complete, ordered, re-runnable setup: enum types, all 15 tables, primary/foreign keys, unique constraints, indexes, grants, row level security, every policy, all database functions and triggers, the five private storage buckets and their policies. |
| `db/001_initial_schema.sql` | Types, tables, keys, indexes, grants, functions, triggers. |
| `db/002_rls_policies.sql` | Row level security policies for every public table. |
| `db/003_storage.sql` | The five private buckets plus their object policies. |
| `db/004_seed_demo_data.sql` | The verified legal corpus: 29 provisions, 6 exemptions, 1 legal source, 11 demo sellers. Copied from the live data — nothing rewritten or invented. |

`SUPABASE_SETUP.sql` is the same content as `001`–`003` in one file. Run either
the single file or the three numbered files — not both.

> The `supabase/migrations/` folder is managed automatically by the platform for
> the currently connected backend. Hand-added files there would be replayed
> against the old project, so the portable copies live in `db/` instead.

---

## Manual steps you must perform

### 1. Load the schema

1. Open your project at `https://supabase.com/dashboard/project/qpwzsipmbxzfwbvguujw`.
2. Go to **SQL Editor → New query**.
3. Paste the whole of `SUPABASE_SETUP.sql` and run it.
4. Confirm: **Table Editor** shows `profiles`, `user_roles`, `sellers`,
   `products`, `rules`, `rule_exemptions`, `legal_documents`, `inspections`,
   `ocr_results`, `rule_checks`, `decisions`, `reports`, `audit_logs`,
   `consumer_checks`, `notifications`.
5. Confirm: **Storage** shows `package-images`, `evidence`, `profile-images`,
   `reports`, `legal-documents`, all marked private.

### 2. Load the legal corpus

1. **SQL Editor → New query**, paste `db/004_seed_demo_data.sql`, run it.
2. Verify:

```sql
select count(*) from public.rules;             -- expect 29
select count(*) from public.rule_exemptions;   -- expect 6
select count(*) from public.legal_documents;   -- expect 1
select count(*) from public.sellers;           -- expect 11
```

The file is idempotent: re-running it refreshes version 1 of each rule and never
touches a later version created by an administrator.

### 3. Configure authentication

1. **Authentication → Providers → Email**: enabled. Turn on
   *Confirm email* only if you want confirmation mails; for demo speed you may
   leave it off.
2. **Authentication → URL Configuration**: add your Lovable preview and
   published URLs to *Site URL* and *Redirect URLs*, including
   `<your-url>/reset-password`.
3. Google sign-in is optional. Enable it under **Providers → Google** with your
   own OAuth client if you want it; the app already has the button.
4. Phone OTP is **not** configured and the app does not use it.

### 4. Connect the project to Lovable

In Lovable, connect your Supabase project (`qpwzsipmbxzfwbvguujw`). This is the
step that rewrites the app's connection details — it cannot be done by editing
files, because the connection file is regenerated automatically.

### 5. Create the first administrator

Sign up through the app with the email you want as admin, then run once:

```sql
insert into public.user_roles (user_id, role)
select id, 'admin' from auth.users where email = 'you@example.com'
on conflict (user_id, role) do nothing;

update public.profiles set role = 'admin'
where email = 'you@example.com';
```

Every other account defaults to `consumer`; a database trigger prevents a user
from granting themselves a role from the app.

---

## Data that cannot be copied automatically

| Data | Status |
| --- | --- |
| 29 rules, 6 exemptions, 1 legal source, demo sellers | Reproduced exactly by `db/004_seed_demo_data.sql`. |
| Auth accounts and passwords | **Not transferable.** Password hashes cannot be exported from the managed project. Everyone signs up again. |
| Uploaded package images, evidence, reports | **Not transferable from here.** Download from the old project's Storage browser and re-upload if you need them. |
| Old inspections, OCR results, rule checks, decisions, reports, audit logs, consumer checks | Reference the old user IDs, so they only carry over as a raw dump. Export with `pg_dump --data-only --table=public.inspections ...` against the old project and import into the new one, then repoint `inspector_id`/`user_id` at the new accounts. The current data set is small — the earlier test records were cleaned up. |

---

## Verification checklist

Run through this after step 4. Do not treat the migration as finished until
every line passes.

**Auth** — sign up · sign in · sign out · refresh keeps the session · password
reset mail arrives · profile loads with the right name and district.

**Admin** — dashboard loads · rules list shows 29 provisions and 6 exemptions ·
create a rule version · publish it · audit log records the change · legal
sources visible.

**Inspector** — dashboard loads · create an inspection · upload a package image ·
OCR returns fields · Legal Metrology rule checks run · results persist after
refresh · manual review works · decision saved · report generated.

**Enforcement officer** — review queue loads · open a case · see evidence ·
confirm compliant / non-compliant / request rescan · decision persists.

**Consumer** — run a package check · see the result · see own history · update
profile.

**Security** — a consumer cannot open `/admin` or `/inspector` · an inspector
cannot edit legal rules · an officer cannot manage users · no ordinary user can
change an audit row.

**Persistence** — refresh, sign out, sign back in; the records are still there.

---

## Old backend

Leave the current Lovable Cloud backend connected and untouched until every line
above passes. Only then is it safe to consider it unnecessary.
