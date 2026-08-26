# ScanShield legal engine — rule catalogue

## Corpus state: INGESTED

| Field | Value |
| --- | --- |
| Source document | The Legal Metrology (Packaged Commodities) Rules, 2011 |
| Notification | G.S.R. 202(E), dated 7 March 2011 |
| Gazette | The Gazette of India, Extraordinary, Part II — Section 3 — Sub-section (i), No. 124, 9 March 2011 |
| Ministry | Consumer Affairs, Food and Public Distribution (Department of Consumer Affairs) |
| Commencement | 1 April 2011 |
| Pages in gazette | 83 (Hindi pages 1–36, English pages 37–83) |
| Text ingested | English text, pages 37–83 |

The English notification was extracted from the supplied PDF (the gazette scan has no text
layer; pages 37–50 were parsed with document OCR and pages 51–83 with Tesseract at 300 dpi).
Every rule record carries a verbatim excerpt in `exact_requirement`, together with the printed
rule number and sub-rule.

**No amendment notification after 2011 has been supplied.** The engine therefore applies the
principal rules exactly as published. `rule_versions.json` is intentionally empty: when an
amendment gazette is ingested, the amended provision is appended as a later chain entry with
its own effective window and the earlier version is given an `effective_to` date, never deleted.

## Files

| File | Purpose |
| --- | --- |
| `rule_sources.json` | The ingested source document and its gazette metadata. |
| `rules.json` | Structured provisions with verbatim text, rule numbers, applicability, severity, evidence and machine-checkability. |
| `exemptions.json` | Rule 3 and rule 26 exclusions and the scope limits inherent in rules 6(1)(a) and Chapter II. An exemption resolves to `NOT_APPLICABLE`, never to `PASS`. |
| `rule_versions.json` | Amendment chains (currently empty — no amendment ingested). |
| `product_categories.json` | Product categories, package types, transaction contexts and origin contexts used for applicability matching. |

## Provisions encoded (29)

Rules 2(m), 3, 4, 5, 6(1)(a)–(f), 6(2), 6(3), 6(5), 7(2)–(3) with Tables I and II, 8(1), 9(1),
10(1)–(2), 11(1)–(2), 13(2)–(5), 14, 16, 18(1), 18(2), 18(5)–(6), 25, 27(1) and 31(1).

## Machine-checkability classes

| Class | Meaning |
| --- | --- |
| `FULLY_MACHINE_CHECKABLE` | Decidable from the extracted declaration alone (date consistency, MRP wording, SI units). |
| `AI_ASSISTED` | Presence and content of a declaration read from the package image, subject to a confidence floor. |
| `PARTIALLY_MACHINE_CHECKABLE` | Image gives an indication; a measurement or officer judgement decides (character height, legibility, panel layout). |
| `HUMAN_INSPECTION_REQUIRED` | Needs physical measurement of the goods (net-quantity verification). |
| `DOCUMENTARY_CHECK_REQUIRED` | Needs invoices, registration records or import papers (sale above MRP, registration, export packages). |

## Effective-date behaviour

A provision applies only when the inspection date falls inside its effective window. A provision
that has not commenced returns `NOT_APPLICABLE` with its commencement date, and a superseded
version returns `NOT_APPLICABLE` citing the version that governs instead. All provisions here
commence on 1 April 2011.
