/**
 * Content validators for rules whose legal requirement can be checked
 * against the extracted text itself (not just its presence).
 *
 * Registry keyed by rule_id. A validator runs only after the generic
 * evidence gates (applicability, readability, confidence floor) pass.
 */

export interface ContentVerdict {
  outcome: "PASS" | "FAIL" | "MANUAL_REVIEW_REQUIRED";
  reason: string;
}

type Validator = (value: string) => ContentVerdict;

/* ------------------------------------------------------------------ */
/* MRP "inclusive of all taxes" wording                                */
/* ------------------------------------------------------------------ */

function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[₹$€£]/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ") // strip punctuation (incl., ₹, etc.)
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Legally equivalent positive forms of "inclusive of all taxes".
 * Matches after normalisation, so punctuation and casing never matter.
 * Covers: "inclusive of all taxes", "incl of all taxes", "incl all taxes",
 * "including all taxes", "incl of taxes", "inclusive of taxes",
 * "taxes included", "all taxes included", "price inclusive of all taxes".
 */
const TAX_INCLUSIVE_PATTERNS: RegExp[] = [
  /\bincl(?:usive|uding|ud)?\s+(?:of\s+)?all\s+taxes\b/,
  /\bincl(?:usive|uding|ud)?\s+(?:of\s+)?taxes\b/,
  /\ball\s+taxes\s+(?:are\s+)?included\b/,
  /\btaxes\s+(?:are\s+)?included\b/,
];

/**
 * Clear contrary indicators — the declared price expressly excludes tax.
 * Only these justify an automatic FAIL.
 */
const TAX_EXCLUSIVE_PATTERNS: RegExp[] = [
  /\bexcl(?:usive|uding)?\s+(?:of\s+)?(?:all\s+)?taxes\b/,
  /\btaxes\s+extra\b/,
  /\bplus\s+(?:all\s+)?taxes\b/,
  /\btaxes\s+(?:will\s+be\s+)?charged\s+extra\b/,
  /\btaxes\s+as\s+applicable\s+extra\b/,
];

/**
 * The MRP declaration must state the price is inclusive of all taxes.
 * - Contrary wording  -> FAIL (expressly excludes tax).
 * - Equivalent wording -> PASS.
 * - No tax wording at all -> MANUAL_REVIEW_REQUIRED: the printed price may
 *   still be tax-inclusive in fact; absence of the phrase on a possibly
 *   partial OCR read is ambiguous and must not auto-fail.
 */
export function validateMrpTaxInclusion(value: string): ContentVerdict {
  const t = normalise(value);

  for (const p of TAX_EXCLUSIVE_PATTERNS) {
    if (p.test(t)) {
      return {
        outcome: "FAIL",
        reason: `Detected wording "${value.trim()}" states the price excludes tax (e.g. "exclusive of taxes" / "taxes extra"). The MRP must be declared inclusive of all taxes.`,
      };
    }
  }
  for (const p of TAX_INCLUSIVE_PATTERNS) {
    if (p.test(t)) {
      return {
        outcome: "PASS",
        reason: "Declaration states the retail price is inclusive of all taxes (accepted equivalent wording).",
      };
    }
  }
  return {
    outcome: "MANUAL_REVIEW_REQUIRED",
    reason:
      "MRP value is present, but no tax-inclusion wording was detected on the captured panels. Wording may be partially read or located on another panel — routed to manual review rather than automatic failure.",
  };
}

/* ------------------------------------------------------------------ */
/* Registry                                                            */
/* ------------------------------------------------------------------ */

const VALIDATORS: Record<string, Validator> = {
  PCR_DECL_MRP: validateMrpTaxInclusion,
  PCR_MRP_FORM: validateMrpTaxInclusion,
};

export function validatorFor(ruleId: string): Validator | undefined {
  return VALIDATORS[ruleId];
}
