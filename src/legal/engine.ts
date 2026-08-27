import { EXEMPTIONS, RULES, chainForRule } from "./corpus";
import { validatorFor } from "./validators";
import type {
  CheckOutcome,
  Exemption,
  InspectionClassification,
  LegalRule,
  RuleCheckResult,
  RuleTemporalStatus,
} from "./types";

/* ------------------------------------------------------------------ */
/* Effective-date engine                                               */
/* ------------------------------------------------------------------ */

export function temporalStatus(rule: LegalRule, asOf: string): RuleTemporalStatus {
  if (rule.effective_from > asOf) return "FUTURE";
  if (rule.effective_to && rule.effective_to < asOf) return "SUPERSEDED";

  // A chain member can be displaced by a later version whose window has opened.
  const chain = chainForRule(rule.rule_id);
  if (chain) {
    const own = chain.entries.find((e) => e.rule_id === rule.rule_id);
    if (own && own.effective_to && own.effective_to < asOf) return "SUPERSEDED";
  }
  return "CURRENT";
}

/* ------------------------------------------------------------------ */
/* Applicability engine                                                */
/* ------------------------------------------------------------------ */

function matchesDimension(allowed: string[], value: string): boolean {
  // An empty list means "no restriction on this dimension".
  return allowed.length === 0 || allowed.includes(value);
}

export function isApplicable(rule: LegalRule, c: InspectionClassification): boolean {
  const a = rule.applicability;
  if (!matchesDimension(a.product_categories, c.product_category)) return false;
  if (!matchesDimension(a.package_types, c.package_type)) return false;
  if (!matchesDimension(a.transaction_contexts, c.transaction_context)) return false;
  if (a.origin !== null && a.origin !== c.origin) return false;
  return true;
}

/* ------------------------------------------------------------------ */
/* Exemption engine                                                    */
/* ------------------------------------------------------------------ */

export function findExemption(
  rule: LegalRule,
  c: InspectionClassification,
): Exemption | undefined {
  return EXEMPTIONS.find((ex) => {
    if (!ex.rule_ids.includes(rule.rule_id)) return false;
    if (ex.effective_from > c.inspection_date) return false;
    if (ex.effective_to && ex.effective_to < c.inspection_date) return false;
    const cond = ex.conditions;
    if (!matchesDimension(cond.product_categories, c.product_category)) return false;
    if (!matchesDimension(cond.package_types, c.package_type)) return false;
    if (!matchesDimension(cond.transaction_contexts, c.transaction_context)) return false;
    if (cond.origin !== null && cond.origin !== c.origin) return false;
    return true;
  });
}

/* ------------------------------------------------------------------ */
/* Evidence contract supplied by the AI pipeline                       */
/* ------------------------------------------------------------------ */

export interface FieldEvidence {
  /** Normalised value, or null when nothing was detected. */
  value: string | null;
  /** 0-1. Null when the field was never attempted. */
  confidence: number | null;
  /** Source image keys backing the observation. */
  images: string[];
  /** True when the region exists but could not be read (glare, blur, crop). */
  unreadable?: boolean;
  /** Free-text note surfaced in the finding. */
  note?: string;
}

export type EvidenceMap = Record<string, FieldEvidence | undefined>;

const CONFIDENCE_FLOOR = 0.7;

/* ------------------------------------------------------------------ */
/* Rule evaluation                                                     */
/* ------------------------------------------------------------------ */

function evaluateRule(
  rule: LegalRule,
  c: InspectionClassification,
  evidence: EvidenceMap,
): RuleCheckResult {
  const status = temporalStatus(rule, c.inspection_date);

  const base = {
    rule,
    temporal_status: status,
    detected: null as string | null,
    evidence: [] as string[],
    confidence: null as number | null,
    requires_human: rule.human_review_required,
    expected: rule.working_summary,
  };

  if (status === "FUTURE") {
    return {
      ...base,
      outcome: "NOT_APPLICABLE",
      reason: `Provision commences on ${rule.effective_from}. It is not in force on the inspection date (${c.inspection_date}) and is therefore not applied.`,
    };
  }
  if (status === "SUPERSEDED") {
    return {
      ...base,
      outcome: "NOT_APPLICABLE",
      reason: `This version was superseded on ${rule.effective_to}. A later version in the same chain governs this inspection date.`,
    };
  }
  if (!isApplicable(rule, c)) {
    return {
      ...base,
      outcome: "NOT_APPLICABLE",
      reason: "Provision does not attach to this product category / package type / transaction context.",
    };
  }

  const exemption = findExemption(rule, c);
  if (exemption) {
    return {
      ...base,
      outcome: "NOT_APPLICABLE",
      exemption,
      reason: `Exempt under ${exemption.title}. ${exemption.explanation}`,
    };
  }

  // Provisions that cannot be settled from an image are never auto-failed.
  if (rule.machine_checkability === "HUMAN_INSPECTION_REQUIRED") {
    return {
      ...base,
      outcome: "MANUAL_REVIEW_REQUIRED",
      requires_human: true,
      reason: `Physical inspection required. Evidence needed: ${rule.required_evidence.join(", ")}. This cannot be established from package imagery.`,
    };
  }
  if (rule.machine_checkability === "DOCUMENTARY_CHECK_REQUIRED") {
    return {
      ...base,
      outcome: "MANUAL_REVIEW_REQUIRED",
      requires_human: true,
      reason: `Documentary verification required. Evidence needed: ${rule.required_evidence.join(", ")}.`,
    };
  }

  const ev = evidence[rule.field];

  if (!ev) {
    return {
      ...base,
      outcome: "INSUFFICIENT_EVIDENCE",
      reason: "No observation was produced for this declaration. Capture additional panels covering it.",
    };
  }

  base.evidence = ev.images;
  base.confidence = ev.confidence;
  base.detected = ev.value;

  if (ev.unreadable) {
    return {
      ...base,
      outcome: "RESCAN_REQUIRED",
      reason:
        ev.note ??
        "The declaration region was located but could not be read. Image quality — not the declaration — is the limiting factor. This is not recorded as a violation.",
    };
  }

  if (ev.value === null) {
    // Not detected, with a readable image: a candidate violation, still confidence-gated.
    if ((ev.confidence ?? 0) < CONFIDENCE_FLOOR) {
      return {
        ...base,
        outcome: "MANUAL_REVIEW_REQUIRED",
        requires_human: true,
        reason: `Declaration not detected, but extraction confidence (${pct(ev.confidence)}) is below the ${pct(CONFIDENCE_FLOOR)} threshold. Low OCR confidence is not treated as a missing declaration.`,
      };
    }
    return {
      ...base,
      outcome: "FAIL",
      reason:
        ev.note ??
        "Required declaration was not detected on any captured panel, on imagery assessed as readable.",
    };
  }

  if ((ev.confidence ?? 1) < CONFIDENCE_FLOOR) {
    return {
      ...base,
      outcome: "MANUAL_REVIEW_REQUIRED",
      requires_human: true,
      reason: `Value read as "${ev.value}" at ${pct(ev.confidence)} confidence, below the ${pct(CONFIDENCE_FLOOR)} threshold. Inspector confirmation required.`,
    };
  }

  if (ev.note) {
    return {
      ...base,
      outcome: rule.machine_checkability === "PARTIALLY_MACHINE_CHECKABLE" ? "MANUAL_REVIEW_REQUIRED" : "FAIL",
      requires_human: rule.machine_checkability === "PARTIALLY_MACHINE_CHECKABLE",
      reason: ev.note,
    };
  }

  // Content validators: check the requirement against the extracted text
  // itself. Ambiguity always routes to manual review, never auto-fail.
  const validate = validatorFor(rule.rule_id);
  if (validate) {
    const verdict = validate(ev.value);
    return {
      ...base,
      outcome: verdict.outcome,
      requires_human: verdict.outcome === "MANUAL_REVIEW_REQUIRED" ? true : base.requires_human,
      reason: verdict.reason,
    };
  }

  return {
    ...base,
    outcome: "PASS",
    reason: `Declaration present and read at ${pct(ev.confidence)} confidence.`,
  };
}

function pct(v: number | null | undefined): string {
  if (v === null || v === undefined) return "n/a";
  return `${Math.round(v * 100)}%`;
}

/* ------------------------------------------------------------------ */
/* Public entry point                                                  */
/* ------------------------------------------------------------------ */

export interface LegalEvaluation {
  results: RuleCheckResult[];
  tally: Record<CheckOutcome, number>;
  rulesConsidered: number;
  rulesInForce: number;
}

export function evaluateCompliance(
  c: InspectionClassification,
  evidence: EvidenceMap,
): LegalEvaluation {
  const results = RULES.map((rule) => evaluateRule(rule, c, evidence));
  const tally: Record<CheckOutcome, number> = {
    PASS: 0,
    FAIL: 0,
    MANUAL_REVIEW_REQUIRED: 0,
    RESCAN_REQUIRED: 0,
    INSUFFICIENT_EVIDENCE: 0,
    NOT_APPLICABLE: 0,
  };
  for (const r of results) tally[r.outcome] += 1;

  return {
    results,
    tally,
    rulesConsidered: results.length,
    rulesInForce: results.filter((r) => r.temporal_status === "CURRENT").length,
  };
}

export type FinalStatus =
  | "COMPLIANT"
  | "NON_COMPLIANT"
  | "PARTIALLY_VERIFIED"
  | "MANUAL_REVIEW_REQUIRED"
  | "RESCAN_REQUIRED"
  | "INSUFFICIENT_EVIDENCE";

/**
 * Legal status derives from legal checks only — never from an AI confidence
 * percentage. Uncertain cases are never forced into compliant/non-compliant.
 */
export function deriveFinalStatus(tally: Record<CheckOutcome, number>): FinalStatus {
  if (tally.FAIL > 0) return "NON_COMPLIANT";
  if (tally.RESCAN_REQUIRED > 0) return "RESCAN_REQUIRED";
  if (tally.MANUAL_REVIEW_REQUIRED > 0) return "MANUAL_REVIEW_REQUIRED";
  if (tally.INSUFFICIENT_EVIDENCE > 0) return "INSUFFICIENT_EVIDENCE";
  if (tally.PASS > 0) return "COMPLIANT";
  return "PARTIALLY_VERIFIED";
}
