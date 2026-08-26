export type Provenance = "PROVISIONAL_UNVERIFIED" | "VERIFIED_FROM_SOURCE";

export type MachineCheckability =
  | "FULLY_MACHINE_CHECKABLE"
  | "AI_ASSISTED"
  | "PARTIALLY_MACHINE_CHECKABLE"
  | "HUMAN_INSPECTION_REQUIRED"
  | "DOCUMENTARY_CHECK_REQUIRED"
  | "NOT_RELEVANT_TO_IMAGE_SCAN";

export type Severity = "HIGH" | "MEDIUM" | "LOW";

export type RuleTemporalStatus = "CURRENT" | "FUTURE" | "SUPERSEDED" | "NOT_APPLICABLE";

export type ProductCategoryId =
  | "FOOD"
  | "EDIBLE_OIL_FAT"
  | "ELECTRONICS"
  | "GARMENT_HOSIERY"
  | "MEDICAL_DEVICE"
  | "AGRICULTURAL"
  | "COSMETICS"
  | "PAN_MASALA"
  | "OTHER";

export type PackageTypeId =
  | "RETAIL"
  | "GROUP"
  | "COMBINATION"
  | "MULTI_PIECE"
  | "PROMOTIONAL"
  | "GIFT"
  | "WHOLESALE"
  | "IMPORTED";

export type TransactionContextId = "RETAIL" | "WHOLESALE" | "ECOMMERCE";
export type OriginContextId = "DOMESTIC" | "IMPORTED";

export interface Applicability {
  product_categories: string[];
  package_types: string[];
  transaction_contexts: string[];
  origin: string | null;
}

export interface LegalRule {
  rule_id: string;
  source_id: string;
  rule_number: string | null;
  sub_rule: string | null;
  title: string;
  exact_requirement: string | null;
  working_summary: string;
  category: string;
  field: string;
  applicability: Applicability;
  effective_from: string;
  effective_to: string | null;
  severity: Severity;
  machine_checkability: MachineCheckability;
  human_review_required: boolean;
  required_evidence: string[];
  provenance: Provenance;
}

export interface Exemption {
  exemption_id: string;
  rule_ids: string[];
  title: string;
  explanation: string;
  source_id: string;
  conditions: Applicability;
  effective_from: string;
  effective_to: string | null;
}

export interface VersionEntry {
  rule_id: string;
  version: number;
  source_id: string;
  effective_from: string;
  effective_to: string | null;
  amendment_action: string;
  note?: string;
}

export interface VersionChain {
  chain_id: string;
  title: string;
  entries: VersionEntry[];
}

/** Classification of the package under inspection. */
export interface InspectionClassification {
  product_category: ProductCategoryId;
  package_type: PackageTypeId;
  transaction_context: TransactionContextId;
  origin: OriginContextId;
  inspection_date: string; // ISO yyyy-mm-dd
}

export type CheckOutcome =
  | "PASS"
  | "FAIL"
  | "MANUAL_REVIEW_REQUIRED"
  | "RESCAN_REQUIRED"
  | "INSUFFICIENT_EVIDENCE"
  | "NOT_APPLICABLE";

export interface RuleCheckResult {
  rule: LegalRule;
  outcome: CheckOutcome;
  temporal_status: RuleTemporalStatus;
  detected: string | null;
  expected: string;
  reason: string;
  evidence: string[];
  confidence: number | null;
  exemption?: Exemption;
  requires_human: boolean;
}
