# ScanShield — move to your own backend, then build out the portals

Two things are being asked at once: (1) point the app at the Supabase project you created, and (2) a large feature/UI expansion. They have to happen in that order, and step 1 has a part only you can do.

## Reality check on the switchover

The connection details (project URL and key) live in an auto-generated configuration file that Lovable writes when a backend is connected. I cannot hand-edit it to point at `qpwzsipmbxzfwbvguujw` — it gets rewritten. I also have no admin credentials for your project, so I cannot run SQL inside it, create buckets in it, or copy accounts into it from here.

So the switchover is: I prepare everything as files, you run them and connect the project, then I test against it.

## Stage 1 — Switchover files (I do this)

1. `SUPABASE_SETUP.sql` — one ordered, re-runnable script: enum types, all 15 tables, keys, foreign keys, unique constraints, indexes, grants, row-level security, every policy, all 9 database functions and 9 triggers, and the storage policies for the five buckets.
2. `supabase/migrations/` — the same content split into `001_initial_schema.sql`, `002_rls_policies.sql`, `003_storage.sql`, `004_seed_demo_data.sql`.
3. `db/004_seed_demo_data.sql` stays the legal loader: the existing 29 provisions, 6 exemptions, 1 legal source, demo sellers/products — copied byte-for-byte from what is live now. Nothing rewritten, nothing invented.
4. `MIGRATION.md` — click-by-click steps, split into "automated" and "you must do this", plus the 49-point test checklist and the admin-grant SQL line.

## Stage 2 — You (two steps, in the browser)

1. Run `SUPABASE_SETUP.sql` then `db/004_seed_demo_data.sql` in your project's SQL editor.
2. In Lovable, connect your own Supabase project. This is what rewrites the connection details.

The current backend is left completely untouched until you confirm the new one passes.

## Stage 3 — Verify (I do this, next turn, after connection)

Sign-up, sign-in, session persistence after refresh, password reset, each of the four roles, a full scan → OCR → rule check → decision → report cycle, consumer isolation, and that a consumer cannot reach inspector or admin data. I report pass/fail per item — no "done" without a result.

## Stage 4 — Feature build (only after Stage 3 passes)

New:
- `/officer` portal: dashboard (pending cases, non-compliant, high-risk sellers, recent decisions), review queue, cases, sellers, reports, analytics, notifications, profile. Decisions write to the existing decisions + audit tables.
- Admin sections: **Inspectors & Officers** (tabbed, create staff via a server-side admin call that makes a real auth account plus profile — never a detached row), **Customers** (separate page, list + detail with check/complaint history, suspend/restore/deactivate), **Legal Sources** (upload into the existing legal-documents bucket), **Notifications**, **Settings**, **Analytics**.
- Consumer account: profile, settings, password change, notifications, deactivate.
- Inspector: manual review, map, rules, notifications pages added to the existing sidebar.

Schema additions needed for this: an account status column on profiles (active/suspended/deactivated) and a complaints table. Everything else uses tables that already exist.

Unchanged: the legal engine, OCR/vision pipeline, rule evaluation, offline cache and sync queue, existing rule wording and versions.

## Stage 5 — UI polish (last)

Landing page (headline, workflow visual, four role cards, "Check a Package" / "Sign In", subtle demo-environment note, no demo passwords) and a pass over the four portals: Inter typography, light blue-gray surfaces, deep navy, blue accent, green/amber/red status colours, rounded cards, clean tables, Lucide icons.

## Honest gaps

- **User accounts and passwords** cannot be exported from the managed project or written into yours from here. Everyone signs up again; you grant the first admin with one SQL line I provide.
- **Uploaded images, evidence, report files** cannot be streamed between the two projects from here.
- **Existing inspections, OCR results, rule checks, decisions, reports, audit logs, consumer checks** reference the old accounts, so they carry over only as a raw dump; the export command goes in `MIGRATION.md`.
- Reproduced automatically: the 29 rules, 6 exemptions, the legal source, demo sellers/products.

## Scope note

Stages 4 and 5 are much larger than the switchover. If you want to keep spend low, approve Stages 1–3 now and I will stop after verification; then approve Stage 4, then Stage 5.
