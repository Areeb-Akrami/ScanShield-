# ScanGuard Pro

SCANSHIELD

AI-Powered Packaged Commodity Compliance Verification System

Smart India Hackathon 2026 — Problem Statement SIH26034

Build a complete, functional, end-to-end application called ScanShield for checking compliance of packaged commodities under the Legal Metrology (Packaged Commodities) Rules, 2011, using the official legal documents supplied in this project.

The application must be suitable for a Smart India Hackathon 2026 demonstration and must look and behave like a serious GovTech / enforcement platform, not a generic OCR demo or a collection of static UI screens.

1. PROJECT OBJECTIVE

Build a unified system that can:

Scan packaged commodity labels and packaging

Accept product images

Accept e-commerce/product listing information where applicable

Extract declarations using OCR and computer vision

Detect required declarations

Validate declaration formats

Analyze readability and visible text size where technically possible

Identify missing or potentially non-compliant declarations

Check dates and date consistency

Check MRP

Check net quantity declarations

Check unit sale price

Check manufacturer/packer/importer information

Check country of origin where applicable

Check consumer-care details

Check applicable QR-code declarations

Check package type and product category

Apply official Legal Metrology rules through a deterministic rule engine

Use AI/reference intelligence for additional consistency checks

Generate compliance and violation reports

Capture geo-tagged evidence for field inspections

Maintain searchable inspection history

Calculate seller risk

Support offline field inspection

Provide a government/enforcement dashboard

Provide role-based authentication

Maintain audit logs

Support PDF and editable reports

The core principle is:

AI extracts and analyses evidence.

The official rule engine determines legal applicability/compliance.

The inspector makes the final human decision when required.

2. VERY IMPORTANT — LEGAL SOURCE OF TRUTH

A folder named:

/legal_sources/

exists in this project.

It contains the complete legal documents supplied for this project.

Before implementing compliance logic, read and ingest EVERY file in /legal_sources/.

This includes:

Principal Legal Metrology (Packaged Commodities) Rules, 2011

2021 amendments

2022 amendments

2023 amendments

2023 corrigenda

2025 amendments

2026 amendments

Implementation guidelines

Category-specific documents

Edible oil/fat net-quantity SOP

Other supplied Legal Metrology Packaged Commodities material

Treat these documents as the authoritative legal corpus.

Do NOT invent legal requirements.

Do NOT rely on generic model knowledge for legal rules when the supplied source material can be used.

Do NOT silently simplify or omit difficult provisions.

Do NOT apply every rule to every product.

3. LEGAL CORPUS INGESTION MUST HAPPEN FIRST

Before building the compliance UI or legal validation workflow, create:

/legal_engine/
    rules.json
    rule_versions.json
    exemptions.json
    product_categories.json
    rule_sources.json
    RULE_CATALOGUE.md


The application must use these generated files as the legal-rule layer.

4. CONSOLIDATED RULE DATABASE

For every legal provision that may affect packaged-commodity compliance, create a structured rule record.

Suggested structure:

{
  "rule_id": "PCR_R6_001",
  "source_document": "Legal Metrology (Packaged Commodities) Rules, 2011",
  "notification_number": "G.S.R. ...",
  "rule_number": "Rule 6",
  "sub_rule": "6(1)(a)",
  "title": "Mandatory declaration",
  "exact_requirement": "...",
  "category": "MANDATORY_DECLARATION",
  "applicability": {
    "product_categories": [],
    "package_types": [],
    "imported": null,
    "ecommerce": null,
    "retail": null
  },
  "effective_from": "YYYY-MM-DD",
  "effective_to": null,
  "status": "CURRENT",
  "amended_by": [],
  "severity": "HIGH",
  "machine_checkability": "AI_ASSISTED",
  "human_review_required": false,
  "required_evidence": [
    "package_image"
  ],
  "source_page": 0,
  "source_reference": "..."
}


5. AMENDMENT MANAGEMENT

Never treat amendments as isolated documents only.

Determine what each amendment does:

Inserts a provision

Replaces a provision

Deletes a provision

Changes wording

Changes applicability

Changes an exemption

Adds a new exemption

Changes an effective date

Adds a new product category

Adds a new package category

Adds a QR-code provision

Adds an e-commerce provision

Adds documentary requirements

Changes an existing declaration requirement

Merge amendments into the consolidated legal representation while preserving historical versions.

6. EFFECTIVE-DATE ENGINE

This is mandatory.

Every rule version must have:

Effective from

Effective to, if applicable

Current/superseded/future status

The engine must determine which rule version applies to an inspection based on the relevant date.

NEVER apply a future rule before its effective date.

For example, the supplied February 2026 amendment adds an imported-product e-commerce country-of-origin filter effective from 1 July 2026.

The supplied April 2026 amendment contains a later effective date of 1 July 2027, so it must not overwrite the 2026 requirement before that date.

The legal engine must therefore support:

CURRENT
FUTURE
SUPERSEDED
NOT_APPLICABLE


7. EXEMPTION ENGINE

Create:

/legal_engine/exemptions.json

For each exemption store:

Exemption ID

Rule

Applicable category

Applicable package type

Conditions

Effective date

Source

Explanation

An exemption result must be:

NOT_APPLICABLE

not:

PASS

This distinction must appear in the UI and reports.

8. PRODUCT / PACKAGE CLASSIFICATION

Before applying rules, classify the inspection.

Possible dimensions:

Product category

Food

Electronics

Garments/hosiery

Medical devices

Agricultural products

Edible oils/fats

Other packaged commodity

Package type

Ordinary retail package

Group package

Combination package

Multi-piece package

Promotional package

Gift package

Imported package

Other configured package type

Transaction context

Retail

Wholesale

E-commerce

Imported

Domestic

Do not invent classifications that are not supported by the source corpus.

9. LEGAL CHECK CATEGORIES

Create a rule catalogue covering, where applicable:

General applicability

Definitions

Package classification

Mandatory declarations

MRP

Net quantity

Unit sale price

Manufacturer details

Packer details

Importer details

Country of origin

Date declarations

Best-before/use-by

Consumer-care details

Dimensions

Character/font requirements

Readability

Visibility

Placement

QR-code provisions

E-commerce provisions

Group packages

Combination packages

Multi-piece packages

Promotional packages

Special exemptions

Medical devices

Garments/hosiery

Agricultural packages

Edible oils/fats

Registration/documentary requirements

Other applicable provisions

Do not omit a legal provision merely because it cannot be automatically verified from an image.

Mark it appropriately as:

HUMAN_INSPECTION_REQUIRED

or

DOCUMENTARY_CHECK_REQUIRED

10. MACHINE-CHECKABILITY CLASSIFICATION

Each legal provision must be classified as one of:

FULLY_MACHINE_CHECKABLE
AI_ASSISTED
PARTIALLY_MACHINE_CHECKABLE
HUMAN_INSPECTION_REQUIRED
DOCUMENTARY_CHECK_REQUIRED
NOT_RELEVANT_TO_IMAGE_SCAN


Examples:

OCR / Image suitable

Declaration present

Product name

Manufacturer name

Address

MRP

Net quantity

Date

Country of origin

Phone

Email

QR code

Computer Vision suitable

Readability

Approximate character size

Visibility

Glare

Blur

Obstruction

Placement

Text-region detection

Requires trusted reference data

Product-specific shelf-life comparison

Product identity validation

Product-reference mismatch

Requires physical/documentary inspection

Actual physical net quantity

Certain registration requirements

Business/legal documentation

Information not inferable from an image

11. CORE AI ARCHITECTURE

Use separate components:

1. Image Preprocessing
2. OCR
3. Computer Vision
4. Declaration Extraction
5. Product Classification
6. Rule Applicability Engine
7. Legal Rule Engine
8. Product Reference Intelligence
9. Anomaly Detection
10. Confidence Scoring
11. Human Review


Never collapse legal rule logic into an LLM prompt.

12. IMAGE CAPTURE

Field inspector should be able to:

Open camera

Capture front label

Capture back label

Capture side label

Capture MRP area

Capture date area

Capture additional evidence

Upload existing images

Capture supporting video where required

Provide camera guidance:

Move closer

Avoid glare

Improve lighting

Hold steady

Keep label inside frame

Capture all necessary panels

13. IMAGE PREPROCESSING

Apply where appropriate:

Deskew

Perspective correction

Crop

Glare reduction

Noise reduction

Sharpening

Contrast adjustment

Rotation

Text-region enhancement

Keep:

Original image

Processed image

Never overwrite original evidence.

14. IMAGE QUALITY CHECK

Before OCR:

GOOD
ACCEPTABLE
RESCAN REQUIRED


Detect:

Blur

Glare

Reflection

Low contrast

Obstruction

Cropping

Perspective distortion

Insufficient resolution

IMPORTANT:

Poor image quality is NOT automatically a legal violation.

Example:

Unable to verify MRP
Reason: strong glare
Action: capture another image


NOT:

MRP violation


15. OCR

Use an OCR abstraction layer supporting:

Tesseract

Google Vision

Future OCR providers

Every extracted field must store:

value
confidence
source_image
bounding_box
ocr_engine


Support multilingual OCR where practical.

Do not hallucinate missing information.

Use:

NOT_DETECTED

instead of guessing.

16. STRUCTURED DECLARATION EXTRACTION

Extract structured fields such as:

product_name
generic_name
manufacturer_name
manufacturer_address
packer_name
packer_address
importer_name
importer_address
country_of_origin
net_quantity
net_quantity_unit
mrp
unit_sale_price
manufacturing_date
packing_date
import_date
best_before
use_by
expiry
consumer_care_phone
consumer_care_email
dimensions
size
barcode
qr_code


Only populate a field when evidence exists.

17. MANUAL CORRECTION

After OCR, provide a verification screen.

Inspector can edit extracted information.

Example:

MRP
₹120.00
Confidence 96%

[Edit]


Manual modifications must be logged.

Show:

AI Value
Inspector Value
Modification Time
Inspector


18. MRP ENGINE

Check:

Presence

Value

Indian currency

Readability

Visibility

Applicable format

Multiple conflicting values

Potential inconsistency

If two images contain different MRPs:

Potential MRP inconsistency
Manual verification required


Do not make an accusation without evidence.

19. NET QUANTITY ENGINE

Extract:

Value

Unit

Number

Length

Weight

Volume

Dimension where relevant

Normalize units internally.

Examples:

500 g
1 kg
500 ml
1 litre


Support rule-driven validation.

IMPORTANT:

A package image alone cannot prove actual physical quantity.

For physical quantity verification, provide a separate inspector workflow allowing actual measurement.

20. UNIT SALE PRICE ENGINE

Implement official unit-sale-price rules from the supplied corpus.

Support configured formats including:

₹X per gram
₹X per kilogram
₹X per centimetre
₹X per metre
₹X per number
₹X per millilitre
₹X per litre


The supplied 2021 amendment explicitly specifies these categories.

Determine applicable format from:

Net quantity

Quantity unit

Commodity type

Rule version

Exemption

Do not blindly require unit sale price where the legal corpus says it is not applicable.

21. MANUFACTURER / PACKER / IMPORTER ENGINE

Detect:

Name

Address

Role

For imported products additionally evaluate country-of-origin requirements applicable at the inspection/listing date.

22. COUNTRY OF ORIGIN

Extract:

country_of_origin


For e-commerce:

Support product listing analysis.

For imported products, support:

Listing-level origin information

Searchable filter requirement

Sortable filter requirement

Package declaration where applicable

The February 2026 amendment must be represented with its effective date of 1 July 2026.

The April 2026 amendment must retain its separate 1 July 2027 effective date.

23. DATE INTELLIGENCE ENGINE

This is a core feature.

Extract:

Manufacturing date

Packing date

Import date where relevant

Best-before

Use-by

Expiry

Normalize dates.

Perform:

Date syntax validation

Can the date be parsed?

Calendar validation

Detect impossible dates.

Chronological validation

Example:

Manufacturing:
10/08/2026

Best Before:
05/08/2026

Result:
Potential date inconsistency


Cross-image comparison

Compare dates visible on front/back/side panels.

Declaration validation

Check whether applicable date declarations exist and comply with the current rule version.

24. PRODUCT-SPECIFIC SHELF-LIFE INTELLIGENCE

Do NOT assume that every product has a universal shelf life.

Create a trusted product-reference layer.

Fields:

brand
product_name
variant
manufacturer
pack_size
barcode
known_shelf_life
reference_source
reference_url
verified_on
verification_status


Only compare shelf life when the exact product has reliable reference data.

Example:

Manufactured:
01/06/2026

Best Before:
01/10/2026

Declared shelf life:
4 months

Reference:
3 months

Result:
POTENTIAL SHELF-LIFE DISCREPANCY

Confidence:
88%

Final:
MANUAL REVIEW REQUIRED


Never automatically call this a confirmed legal violation without sufficient authoritative evidence.

25. PRODUCT CONSISTENCY ENGINE

Compare information from different package panels:

Product name

Variant

Quantity

MRP

Dates

Manufacturer

Country of origin

Consumer-care information

Example:

Front: 500 g
Back: 450 g

Result:
PRODUCT INFORMATION INCONSISTENCY


26. FONT-SIZE / CHARACTER-SIZE ENGINE

Use computer vision to estimate:

Character height

Character width

Relative text size

Visibility

Compare with the applicable legal requirement from the current rule version.

Output:

Required
Estimated
Measurement confidence
PASS / FAIL / MANUAL REVIEW


Do not claim millimetre-level accuracy unless the image/camera calibration supports it.

When measurement confidence is insufficient:

MANUAL REVIEW REQUIRED

27. READABILITY ENGINE

Detect:

Blur

Low contrast

Glare

Reflections

Occlusion

Tiny text

Distortion

Cropping

Return:

READABLE
PARTIALLY READABLE
NOT READABLE


28. VISIBILITY / PLACEMENT ENGINE

Where the official rule has applicable visibility or placement requirements, evaluate:

Declaration visibility

Obstruction

Cropping

Location

Presence on required area

Potential overlap

Do not invent placement restrictions.

Use only the legal corpus.

29. QR-CODE ENGINE

Detect:

QR

QR contents

QR instructions

Information available via QR

For provisions applicable to electronic products, support the relevant QR-code logic.

The supplied July 2022 amendment provides specific QR-based handling for certain electronic-product information and still requires particular information on-package in specified circumstances.

Show:

QR PRESENT
QR SCANNABLE
QR LEGALLY RELEVANT
REQUIRED ON-PACK INFORMATION
INFORMATION AVAILABLE THROUGH QR


Do not automatically trust QR data as authentic.

Treat it as evidence.

30. PACKAGE TYPE ENGINE

Identify and support:

Ordinary package

Promotional package

Group package

Combination package

Multi-piece package

Gift package

The 2023 amendment introduces definitions including combination, group and multi-piece packages.

For packages with multiple individual retail packages:

allow inspection of:

Outer package

Each inner package

31. SPECIAL CATEGORY RULES

Create separate configurable rule sets for:

Food

Use packaged-commodity rules and relevant applicability conditions.

Electronics

Support QR-related provisions and electronic-product conditions.

Garments/hosiery

Support the category-specific declaration requirements supplied in the corpus.

The supplied 2022 amendment includes garment/hosiery-specific provisions including manufacturer/marketer/brand-owner/importer details, country of origin for imported products, consumer-care information, sizing and MRP.

Medical devices

Where medical devices are involved, use the applicable Medical Devices Rules provisions where the supplied amendments direct that framework to apply.

Do not blindly use generic package rules for those provisions.

The supplied 2025 amendment specifically distinguishes medical-device declaration and character-size treatment.

Agricultural packages

Activate supplied agricultural-package provisions where applicable.

Edible oils/fats

Support the supplied official net-quantity SOP as a physical-inspection workflow.

The SOP is specifically intended for determination of net quantity in edible oils/fats packages and uses measurement equipment/work standards rather than image-only estimation.

32. PAN MASALA / SPECIAL EXEMPTIONS

Represent product-specific exemptions through the rule engine.

For example, the supplied December 2025 amendment states that a specified provision does not apply to pan masala from 1 February 2026.

Never hard-code this into a generic product check.

Represent it as an effective-date rule/exemption.

33. IMPORT / BONDED-WAREHOUSE LOGIC

Support applicable 2026 provisions concerning qualifying Authorised Economic Operator Tier-2/Tier-3 bonded warehouses.

Where applicable, represent declaration timing correctly.

The supplied 29 May 2026 amendment states that mandatory declarations may be made at qualifying bonded warehouses, but retail packages must carry all mandatory declarations before leaving those warehouses.

This may be a documentary/enforcement check rather than an image-only check.

34. AI CONFIDENCE

Every AI-derived observation must include:

Confidence

Evidence

Source image

Bounding box

Processing method

Confidence states:

HIGH
MEDIUM
LOW


Low confidence must trigger manual review or rescan where appropriate.

35. HUMAN-IN-THE-LOOP

Inspector actions:

CONFIRM
REJECT
EDIT
REQUEST RESCAN
MARK NOT APPLICABLE


Every action is audited.

36. FINAL STATUS

Support:

COMPLIANT
NON-COMPLIANT
PARTIALLY VERIFIED
MANUAL REVIEW REQUIRED
RESCAN REQUIRED
INSUFFICIENT EVIDENCE
NOT APPLICABLE


Never force uncertain cases into compliant/non-compliant.

37. CRITICAL DISTINCTION

The UI must clearly distinguish:

Confirmed legal violation

from

Potential AI anomaly

from

Insufficient evidence

from

Image-quality failure

from

Not applicable

Examples:

Unreadable MRP
≠
Missing MRP


OCR uncertainty
≠
Missing declaration


Potential shelf-life mismatch
≠
Confirmed violation


38. INSPECTOR MOBILE APP

Build the Flutter mobile application.

Primary navigation:

Home
Inspections
Scan
Reports
Profile


Inspector workflow:

Login
→ Dashboard
→ New Inspection
→ GPS
→ Seller
→ Product Capture
→ Image Quality
→ OCR
→ Extracted Fields
→ Manual Verification
→ Rule Validation
→ AI/Reference Analysis
→ Result
→ Violation Details
→ Evidence
→ Inspector Decision
→ Report
→ Save
→ Sync


39. GEO-TAGGED EVIDENCE

For every field inspection capture:

Latitude

Longitude

Timestamp

Inspector ID

Inspection ID

Device identifier where permitted

Evidence images

Optional video

Do not fake GPS coordinates.

If location permission is denied:

explain clearly and provide an appropriate workflow.

40. OFFLINE MODE

The inspector app must work in low-connectivity environments.

Support:

Cached rules

Local inspection creation

Local image storage

Local OCR if available

Local validation using cached rules

Local report preparation

Sync queue

Statuses:

OFFLINE
PENDING SYNC
SYNCING
SYNCED
SYNC FAILED


Never silently lose inspection data.

41. INSPECTOR DASHBOARD

Show:

Today's inspections

Completed

Pending

Non-compliant

Manual review

High-risk sellers

Offline/sync state

Quick Start Inspection

42. CONSUMER APP

Consumer role:

REGISTER
LOGIN
SCAN
VIEW RESULT
VIEW DECLARATIONS
VIEW ISSUES
REPORT PRODUCT
VIEW REPORT HISTORY
PROFILE


Consumer UI should explain results in simple language.

Example:

3 issues found

1. Required declaration not detected
2. Date could not be verified
3. MRP image unreadable


Do not expose sensitive inspector/government information.

43. ROLE-BASED AUTHENTICATION

Support:

CONSUMER
FIELD_INSPECTOR
ENFORCEMENT_OFFICER
SUPERVISOR
ADMIN


Use:

OAuth2/JWT

Secure password hashing

Role-based authorization

Session expiry

Logout

Secure token storage

Inspectors must not access admin-only functions.

44. SELLER PROFILE

Store:

Seller/business name

Address

Location

Inspection history

Compliance history

Violation count

Recent violations

Risk score

Last inspection

Number of inspections

45. RISK ENGINE

Calculate risk from configurable factors such as:

Repeated violations

Violation severity

Frequency

Recurrence

Recent non-compliance

Output:

LOW
MEDIUM
HIGH


Always explain the reason for the risk score.

Example:

HIGH RISK

3 violations in last 5 inspections
2 repeated declaration violations
1 recent high-severity violation


Do not use a hidden arbitrary score.

46. GOVERNMENT / ADMIN DASHBOARD

Build a web dashboard.

Sections:

Dashboard
Inspections
Violations
Sellers
Inspectors
Rules
Reports
Analytics
Map
Users
Audit Logs
Settings


47. DASHBOARD ANALYTICS

Show:

Total inspections

Compliant

Non-compliant

Pending

Manual review

Violations

High-risk sellers

Charts:

Inspection trend

Compliance trend

Violation trend

Top violation types

District distribution

State distribution

Category distribution

Risk distribution

Dashboard data must come from the actual inspection database.

48. MAP

Show inspection locations.

Filter by:

Date

District

State

Status

Risk

Inspector

Protect sensitive inspector information.

49. SEARCH

Search by:

Inspection ID

Seller

Product

Barcode

Inspector

District

State

Date

Violation

Compliance status

Product category

50. REPORTING

Generate:

Compliance Report

Violation Report

Include:

ScanShield branding

Inspection ID

Inspector

Seller

Product

Date/time

GPS coordinates

Original images

Processed images where useful

OCR results

Extracted declarations

Rule checks

Violations

Evidence

AI confidence

Reference comparison

Inspector decision

Final status

Rule/version references

Audit information

Export:

PDF

Editable report

51. AUDIT LOG

Record:

Login

Logout

Inspection creation

Image upload

OCR

Field editing

Validation

Rule execution

Rule version

Inspector decision

Report generation

Rule modification

User modification

Sync events

Record:

user
action
timestamp
entity
entity_id
before_value
after_value


where applicable.

52. ADMIN RULE MANAGEMENT

Admin should be able to:

View rules

View rule version

View source

View effective date

Add future rule

Enable/disable rule

View amendment history

IMPORTANT:

Do not allow arbitrary rule editing without audit logging.

Rule updates must preserve history.

53. GOVERNMENT DATA INTEGRATION

Create adapter interfaces:

GovernmentDataProvider
ProductReferenceProvider
RuleProvider
InspectionRepository


Do not fabricate government API data.

For demonstrations use:

DEMO DATA


and visibly distinguish demo/reference information from official data.

54. DATABASE

Use PostgreSQL.

Suggested entities:

User
Role
InspectorProfile
ConsumerProfile
Seller
Product
ProductReference
Inspection
InspectionImage
InspectionVideo
OCRResult
ExtractedField
ValidationResult
Violation
Rule
RuleVersion
Exemption
ComplianceReport
Evidence
RiskScore
Notification
AuditLog
SyncQueue


Use proper relationships.

Do not create one giant table.

55. SEARCH

Use PostgreSQL for transactional data and Elasticsearch/OpenSearch where useful for:

Full-text search

Inspection history

Seller search

Product search

Violation search

56. API

Build REST APIs such as:

POST /auth/register
POST /auth/login
POST /auth/refresh
POST /auth/logout

POST /inspections
GET /inspections
GET /inspections/{id}
PUT /inspections/{id}

POST /inspections/{id}/images
POST /inspections/{id}/process
GET /inspections/{id}/ocr
GET /inspections/{id}/validation

POST /inspections/{id}/validate
POST /inspections/{id}/review
POST /inspections/{id}/report

GET /products
GET /products/{id}

GET /sellers
GET /sellers/{id}

GET /rules
GET /rules/{id}
GET /rule-versions

GET /violations
GET /dashboard/analytics


Use consistent validation and error handling.

57. ERROR STATES

Handle:

Camera permission denied

Location permission denied

No internet

OCR failure

Poor image

Unsupported image

AI service unavailable

Server timeout

Sync failure

Authentication failure

Invalid file

Show human-readable errors.

Never show raw stack traces to users.

58. SECURITY

Implement:

JWT/OAuth2

Secure password hashing

Role-based authorization

API authorization

File validation

File-size limits

Secure upload

HTTPS-ready architecture

Audit logs

Rate limiting

Session expiry

Secure storage

Never place credentials in code.

Use environment variables.

59. OFFLINE SYNC ARCHITECTURE

Use an outbox/sync-queue pattern.

Each offline inspection should have:

local_id
server_id
sync_status
created_at
updated_at
retry_count
last_error


When online:

PENDING
→ UPLOADING
→ PROCESSING
→ SYNCED


Failed uploads should be retryable.

60. DEMO MODE

The SIH prototype must work even without paid external AI services.

Provide sample/demo data and sample package images.

Create controlled demo scenarios:

Scenario 1

Fully compliant product

Scenario 2

Missing declaration

Scenario 3

Invalid date

Scenario 4

Conflicting MRP

Scenario 5

Unreadable/glare image

Scenario 6

Potential shelf-life discrepancy

Scenario 7

Repeated seller violations

Scenario 8

Imported product

Scenario 9

E-commerce imported product

Scenario 10

Electronic product with QR information

Scenario 11

Garment/hosiery category

Scenario 12

Special-category exemption

Demo data must be explicitly marked.

61. MAGGI-STYLE DATE DEMONSTRATION

Include a product-intelligence demo similar to the following concept.

The user scans a package.

The system detects:

Manufacturing:
01/06/2026

Best Before:
01/10/2026

Declared shelf life:
4 months


The system identifies the exact product.

A trusted reference contains:

Reference shelf life:
3 months


System output:

POTENTIAL PRODUCT REFERENCE DISCREPANCY

Declared:
4 months

Reference:
3 months

Confidence:
88%

Status:
MANUAL VERIFICATION REQUIRED


Do NOT show:

CONFIRMED LEGAL VIOLATION

unless the legal rule and authoritative evidence establish that conclusion.

62. AI MUST NEVER

The AI must never:

Invent missing declarations

Invent a legal rule

Invent a rule number

Invent a government dataset

Invent product-reference information

Guess a missing date

Treat low OCR confidence as a violation

Treat bad image quality as a legal violation

Automatically accuse a seller based only on an AI anomaly

Apply future rules before their effective date

Apply category-specific rules to unrelated products

Ignore exemptions

When evidence is insufficient:

INSUFFICIENT EVIDENCE


or:

MANUAL REVIEW REQUIRED


63. STITCH UI INTEGRATION

I will separately provide Stitch-generated UI screens.

Use them ONLY as a design reference.

Do NOT copy them pixel-for-pixel.

Do NOT clone their exact components or layout.

Use the Stitch designs to understand:

Screen hierarchy

Navigation

Information architecture

Spacing ideas

Component ideas

Visual direction

User flows

Data presentation

Create an original ScanShield interface inspired by those ideas.

The final design must be:

Professional

Modern

Clean

Government-grade

Accessible

Data-focused

Evidence-oriented

The Stitch design is not the legal or functional source of truth.

The legal corpus is the source of truth for legal behaviour.

64. MOBILE NAVIGATION

Inspector

Home
Inspections
Scan
Reports
Profile


Consumer

Home
Scan
History
Reports
Profile


Adapt to the supplied Stitch design where appropriate.

65. ADMIN NAVIGATION

Dashboard
Inspections
Violations
Sellers
Inspectors
Rules
Reports
Analytics
Map
Users
Audit Logs
Settings


66. UI RESULT DESIGN

For a compliant result:

✓ COMPLIANT

Legal Checks
12 Passed

AI Verification
High Confidence

Human Review
Not Required


For non-compliant:

✕ NON-COMPLIANT

2 Legal Checks Failed

3 AI Findings

1 Manual Review Required


For uncertainty:

⚠ MANUAL REVIEW REQUIRED

Reason:
Font measurement confidence too low


For image problem:

↻ RESCAN REQUIRED

Reason:
MRP area obscured by glare


67. EVIDENCE VIEWER

For every finding allow inspector to:

View original image

View processed image

Highlight detected text

Highlight bounding box

Zoom

Compare extracted value with visual evidence

Example:

MRP: ₹120

[Highlighted MRP region]


68. COMPLIANCE SCORE

Do not use a single unexplained AI percentage as the legal result.

Instead show:

Legal checks:
12 PASS
2 FAIL
3 NOT APPLICABLE

AI confidence:
92%

Manual review:
1

Final:
NON-COMPLIANT


Legal status comes from legal checks, not AI confidence.

69. LEGAL EXPLANATION

Every failure should answer:

What was detected?

What was expected?

Why did it fail?

Which rule applies?

Which source document?

What evidence supports the finding?

Does human verification remain necessary?

Example:

Rule:
Rule 6 (...)

Finding:
Required declaration not detected

Evidence:
Back-label image

OCR confidence:
94%

Final:
Manual confirmation required


70. PERFORMANCE

Use:

Image compression

Caching

Background processing

Lazy loading

Pagination

Local storage

Efficient APIs

Async AI processing

Do not freeze the application during image analysis.

71. ACCESSIBILITY

Use:

Good contrast

Readable fonts

Large touch targets

Clear labels

Clear error messages

Accessible status indicators

72. CODE STRUCTURE

Use modular architecture.

Avoid:

Giant components

Hard-coded legal rules in UI

Duplicate code

Hard-coded secrets

Fake backend calls hidden inside UI

Use:

Services

Repositories

Models

API clients

Rule engine

AI adapters

Storage adapters

73. ENVIRONMENT VARIABLES

Use:

DATABASE_URL
JWT_SECRET
OAUTH_CLIENT_ID
OAUTH_CLIENT_SECRET
GOOGLE_VISION_KEY
ELASTICSEARCH_URL
STORAGE_BUCKET
API_BASE_URL


Provide:

.env.example

Never commit actual secrets.

74. DEVELOPMENT ORDER

Follow this sequence.

PHASE 0 — LEGAL CORPUS

Read every /legal_sources/ document

Extract provisions

Consolidate amendments

Create rule versions

Create exemptions

Create category applicability

Create source mapping

Create RULE_CATALOGUE.md

Validate generated legal database

STOP and report the legal-corpus statistics before proceeding.

PHASE 1 — ARCHITECTURE

Set up:

Flutter mobile

Web dashboard

Backend

PostgreSQL

Authentication

Storage

Search

PHASE 2 — AUTHENTICATION

Build:

Register

Login

Logout

Refresh

Role routing

Password reset

Profile

PHASE 3 — INSPECTION

Build:

New inspection

GPS

Seller

Product

Image capture

Image upload

Evidence

PHASE 4 — AI EXTRACTION

Build:

Image preprocessing

OCR

Computer vision

Field extraction

Confidence

Manual corrections

PHASE 5 — LEGAL ENGINE

Implement:

Product classification

Package classification

Rule applicability

Effective-date selection

Exemption handling

Validation

PHASE 6 — ADVANCED AI

Implement:

Date intelligence

Product matching

Shelf-life reference comparison

Consistency detection

MRP inconsistency

Font/readability analysis

PHASE 7 — HUMAN REVIEW

Implement:

Confirm

Reject

Edit

Rescan

Not applicable

PHASE 8 — REPORTS

Implement:

Compliance report

Violation report

PDF

Editable format

Evidence

PHASE 9 — OFFLINE

Implement:

Offline storage

Sync queue

Retry

Conflict handling

PHASE 10 — CONSUMER

Implement:

Consumer scan

Simplified compliance result

Product report

Complaint/report workflow

PHASE 11 — ADMIN

Implement:

Dashboard

Inspections

Violations

Sellers

Inspectors

Rules

Analytics

Map

Search

Audit logs

75. FINAL END-TO-END DEMO

The complete SIH demonstration must work as follows:

FIELD INSPECTOR LOGIN
        ↓
INSPECTOR DASHBOARD
        ↓
NEW INSPECTION
        ↓
GPS + TIMESTAMP
        ↓
SELLER
        ↓
CAPTURE PRODUCT
        ↓
IMAGE QUALITY CHECK
        ↓
OCR + COMPUTER VISION
        ↓
EXTRACT DECLARATIONS
        ↓
MANUAL VERIFICATION
        ↓
PRODUCT / PACKAGE CLASSIFICATION
        ↓
APPLICABLE RULE VERSION
        ↓
LEGAL RULE ENGINE
        ↓
EXEMPTIONS
        ↓
AI / PRODUCT REFERENCE ANALYSIS
        ↓
CONFIDENCE
        ↓
COMPLIANCE RESULT
        ↓
VIOLATION / EVIDENCE
        ↓
INSPECTOR DECISION
        ↓
REPORT GENERATION
        ↓
SAVE INSPECTION
        ↓
SYNC
        ↓
GOVERNMENT DASHBOARD
        ↓
SEARCH / ANALYTICS / RISK


76. FINAL ARCHITECTURE

The system should ultimately behave like:

                 PRODUCT / PACKAGE
                         ↓
                 IMAGE / LISTING
                         ↓
              IMAGE PREPROCESSING
                         ↓
              OCR + COMPUTER VISION
                         ↓
              STRUCTURED EXTRACTION
                         ↓
             PRODUCT/PACKAGE CLASSIFIER
                         ↓
            ┌────────────┴─────────────┐
            ↓                          ↓
      OFFICIAL RULE ENGINE       AI / REFERENCE
            ↓                          ↓
      APPLICABILITY              CONSISTENCY
      EFFECTIVE DATE             ANOMALIES
      EXEMPTIONS                 SHELF-LIFE
      VALIDATION                 PRODUCT MATCH
            └────────────┬─────────────┘
                         ↓
                 CONFIDENCE ENGINE
                         ↓
                  HUMAN REVIEW
                         ↓
              FINAL INSPECTION STATUS
                         ↓
              EVIDENCE + REPORT
                         ↓
               CENTRAL REPOSITORY
                         ↓
               GOVERNMENT DASHBOARD


77. FINAL LEGAL SAFETY PRINCIPLE

The application must never claim:

“AI has legally determined this product is unlawful.”

Instead, the system should say:

“Based on the applicable configured Legal Metrology rule, the observed package appears non-compliant.”

or:

“Potential non-compliance detected — inspector verification required.”

This keeps the system evidence-based and human-supervised.

78. FINAL QUALITY REQUIREMENT

Do not deliver a prototype that only has attractive screens.

The final system must have:

Real navigation

Real authentication

Real data models

Real APIs

Real inspection records

Real rule-engine execution

Real evidence storage

Real report generation

Real dashboard aggregation

Offline handling

Error states

Audit history

The legal corpus must be ingested before the compliance engine is implemented.

When the project is finished, provide:

Project structure

Setup instructions

Database migration instructions

Environment variable documentation

Demo credentials

Demo data

Legal corpus ingestion statistics

Rule-engine statistics

AI pipeline description

End-to-end demo instructions

START NOW

Start with:

PHASE 0 — LEGAL CORPUS INGESTION

Read every file in /legal_sources/.

Generate:

/legal_engine/rules.json
/legal_engine/rule_versions.json
/legal_engine/exemptions.json
/legal_engine/product_categories.json
/legal_engine/rule_sources.json
/legal_engine/RULE_CATALOGUE.md


Validate them.

Then report:

Number of source documents

Number of provisions extracted

Number of current rules

Number of future rules

Number of superseded rules

Number of exemptions

Number of machine-checkable rules

Number of AI-assisted rules

Number of human/documentary checks

Number of product categories

Number of package types

After this validation, continue with the application implementation.

Do not skip the legal-corpus phase.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/6c1aea78-d644-4869-8615-177d1a8a1c87).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
