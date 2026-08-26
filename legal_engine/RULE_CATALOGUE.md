# ScanShield — Rule Catalogue

**Corpus state: `AWAITING_INGESTION`**

`/legal_sources/` was not present in this project when the legal engine was scaffolded.
No official text has been ingested. Every record in `legal_engine/` therefore carries
`provenance: "PROVISIONAL_UNVERIFIED"`, and `exact_requirement` is `null` on every rule.

This is deliberate. The build spec forbids inventing legal requirements, rule numbers or
notification numbers, so none appear here. What exists is the **structure**: the record
schema, the amendment/version chains, the exemption model, the applicability dimensions
and the machine-checkability classification. Dropping the official documents into
`/legal_sources/` and running Phase 0 ingestion populates the text and flips provenance
to `VERIFIED_FROM_SOURCE` without touching any application code.

## Files

| File | Purpose |
|---|---|
| `rules.json` | Consolidated rule records with applicability, effective dates, severity, machine-checkability |
| `rule_versions.json` | Amendment chains preserving history (`INSERT`, `REPLACE`, `SUBSTITUTE`, `CARVE_OUT`, `PRINCIPAL`) |
| `exemptions.json` | Dated exemptions; resolve to `NOT_APPLICABLE`, never `PASS` |
| `product_categories.json` | Product categories, package types, transaction contexts, origin contexts |
| `rule_sources.json` | Expected source documents and their ingestion state |

## Effective-date engine

Each rule has `effective_from` / `effective_to`. Against an inspection date the engine
returns one of `CURRENT`, `FUTURE`, `SUPERSEDED`, `NOT_APPLICABLE`. A future rule is
never applied before its commencement date. The two e-commerce origin provisions
(`2026-07-01` and `2027-07-01`) are modelled as one chain with non-overlapping windows
precisely so the later one cannot overwrite the earlier one prematurely.

## Machine-checkability classification

| Class | Meaning |
|---|---|
| `FULLY_MACHINE_CHECKABLE` | Determinable from extracted values alone (e.g. date chronology) |
| `AI_ASSISTED` | OCR/CV evidence + rule logic, confidence-gated |
| `PARTIALLY_MACHINE_CHECKABLE` | Measurable only within calibration limits (character height, legibility) |
| `HUMAN_INSPECTION_REQUIRED` | Physical inspection (actual net quantity, inner packages) |
| `DOCUMENTARY_CHECK_REQUIRED` | Registration, warehouse records, listing evidence |
| `NOT_RELEVANT_TO_IMAGE_SCAN` | Not inferable from a package image |

## Scaffold statistics

- Source documents expected: **13**, ingested: **0**
- Provisional rule records: **22**
- Version chains: **4**
- Exemptions: **5**
- Product categories: **9** · Package types: **8** · Transaction contexts: **3**

Counts by machine-checkability: `FULLY_MACHINE_CHECKABLE` 1 · `AI_ASSISTED` 10 ·
`PARTIALLY_MACHINE_CHECKABLE` 2 · `HUMAN_INSPECTION_REQUIRED` 3 ·
`DOCUMENTARY_CHECK_REQUIRED` 6.

Live counts are computed at runtime and shown on the **Rules** screen in the admin console.
