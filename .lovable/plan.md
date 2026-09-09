# Move ScanShield onto your own Supabase project

Goal: your project `qpwzsipmbxzfwbvguujw` becomes the primary backend, with zero change to the UI, the Legal Metrology rules, or the existing workflows.

## What I checked first

- The backend connection details (project URL and key) live in an auto-generated configuration file that Lovable Cloud writes. I cannot hand-edit it to point at another project — it gets rewritten.
- The complete database setup already exists as files: `SUPABASE_SETUP.sql` (689 lines: tables, keys, indexes, functions, triggers, access rules, storage rules) and `db/004_seed_demo_data.sql` (the verified 29 rules, 6 exemptions, 1 legal source, demo sellers).
- Your project's admin/service credentials are not available here, so I cannot connect to your project directly, run SQL in it, or copy user accounts into it.

## Honest split of the work

**What I do in this project**

1. Refresh `SUPABASE_SETUP.sql` so it is a single, ordered, re-runnable script that recreates everything: types, all tables (profiles, roles, sellers, products, rules, exemptions, legal documents, inspections, OCR results, rule checks, decisions, reports, audit logs, consumer checks, notifications), relationships, indexes, permissions, access rules, functions and triggers.
2. Add a storage script section that creates the five buckets (package-images, evidence, profile-images, reports, legal-documents) as private, with the same access rules as today.
3. Keep `db/004_seed_demo_data.sql` as the legal-data loader — the same rules, numbers, descriptions, exemptions, versions and dates already in use. Nothing invented, nothing replaced.
4. Add a short `MIGRATION.md` with the exact click-by-click steps and the verification checklist (your points 1–22).
5. No UI changes, no workflow changes, no rule-engine changes, no new dependencies. The offline cache and sync queue stay exactly as they are and keep writing to whichever backend is connected.

**What only you can do (two steps, in your browser)**

1. Run `SUPABASE_SETUP.sql`, then `db/004_seed_demo_data.sql`, in your project's SQL editor. That gives you the full structure plus the legal corpus.
2. In Lovable, disconnect Cloud and connect your own Supabase project. That is what rewrites the connection details so the app talks to your database, your sign-in and your storage. Once it is connected, I can run the end-to-end tests against it in the next turn.

## Data that cannot be copied automatically

- **User accounts and passwords** — sign-in accounts cannot be exported from the managed project or written into yours from here. Everyone signs up again on the new backend; the first admin is granted by you with one SQL line I will include.
- **Uploaded images, evidence and report files** — file contents cannot be streamed between the two projects from here.
- **Existing inspections, OCR results, rule checks, decisions, reports, audit logs, consumer checks** — these reference the old user accounts, so they carry over only if you want a raw data dump; I will note the exact export command in `MIGRATION.md`. The current data set is small (the earlier test records were cleaned up).
- **Fully reproduced automatically:** the 29 rules, 6 exemptions, the legal source document, and the demo sellers/products.

## Safety

Nothing is deleted or disconnected on the current backend. The old project stays live and untouched until you confirm the new one passes the checklist.
