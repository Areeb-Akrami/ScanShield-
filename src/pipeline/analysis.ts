import type { AiFinding, CapturedImage, ExtractedField, ProductReference } from "./types";

/* ------------------------------------------------------------------ */
/* Date intelligence                                                   */
/* ------------------------------------------------------------------ */

export interface ParsedDate {
  raw: string;
  iso: string | null;
  precision: "DAY" | "MONTH" | null;
  error: string | null;
}

export function parseDeclaredDate(raw: string | null): ParsedDate | null {
  if (!raw) return null;
  const trimmed = raw.trim();

  const dmy = trimmed.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (dmy) {
    const d = Number(dmy[1]);
    const m = Number(dmy[2]);
    const y = Number(dmy[3]);
    if (m < 1 || m > 12) return { raw, iso: null, precision: null, error: `Month ${m} is not a calendar month.` };
    const dim = new Date(y, m, 0).getDate();
    if (d < 1 || d > dim)
      return { raw, iso: null, precision: null, error: `Day ${d} does not exist in ${m}/${y}.` };
    return { raw, iso: `${y}-${pad(m)}-${pad(d)}`, precision: "DAY", error: null };
  }

  const my = trimmed.match(/^(\d{1,2})[/\-.](\d{4})$/);
  if (my) {
    const m = Number(my[1]);
    const y = Number(my[2]);
    if (m < 1 || m > 12) return { raw, iso: null, precision: null, error: `Month ${m} is not a calendar month.` };
    return { raw, iso: `${y}-${pad(m)}-01`, precision: "MONTH", error: null };
  }

  return { raw, iso: null, precision: null, error: "Date could not be parsed into a known format." };
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function monthsBetween(aIso: string, bIso: string): number {
  const a = new Date(aIso);
  const b = new Date(bIso);
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}

/* ------------------------------------------------------------------ */
/* Analysis passes                                                     */
/* ------------------------------------------------------------------ */

function fieldValue(fields: ExtractedField[], name: string): ExtractedField | undefined {
  return fields.find((f) => f.field === name);
}

export function runAiAnalysis(
  fields: ExtractedField[],
  images: CapturedImage[],
  reference: ProductReference | null,
): AiFinding[] {
  const findings: AiFinding[] = [];

  /* --- image quality ------------------------------------------------ */
  for (const img of images) {
    if (img.quality.grade === "RESCAN_REQUIRED") {
      findings.push({
        id: `IQ_${img.key}`,
        kind: "IMAGE_QUALITY",
        title: `${img.label} needs recapture`,
        detail: `${img.quality.issues.join("; ") || "Quality below OCR threshold"}. Image quality is not a legal violation — the affected declarations are reported as unverified.`,
        confidence: null,
        evidence: [img.key],
        disposition: "MANUAL_REVIEW_REQUIRED",
      });
    }
  }

  /* --- date intelligence -------------------------------------------- */
  const mfg = parseDeclaredDate(fieldValue(fields, "manufacturing_date")?.value ?? null);
  const bb = parseDeclaredDate(fieldValue(fields, "best_before")?.value ?? null);

  for (const [label, p] of [
    ["Date of manufacture", mfg],
    ["Best before", bb],
  ] as const) {
    if (p?.error) {
      findings.push({
        id: `DATE_SYNTAX_${label}`,
        kind: "AI_ANOMALY",
        title: `${label} could not be validated`,
        detail: `Read as "${p.raw}". ${p.error}`,
        confidence: null,
        evidence: ["date"],
        disposition: "MANUAL_REVIEW_REQUIRED",
      });
    }
  }

  if (mfg?.iso && bb?.iso && bb.iso < mfg.iso) {
    findings.push({
      id: "DATE_CHRONOLOGY",
      kind: "CONSISTENCY",
      title: "Potential date inconsistency",
      detail: `Best before (${bb.raw}) precedes date of manufacture (${mfg.raw}). Inspector confirmation of the printed values is required before this is treated as established.`,
      confidence: 0.94,
      evidence: ["date"],
      disposition: "MANUAL_REVIEW_REQUIRED",
    });
  }

  /* --- shelf-life reference comparison ------------------------------ */
  if (reference && mfg?.iso && bb?.iso) {
    const declared = monthsBetween(mfg.iso, bb.iso);
    if (declared !== reference.known_shelf_life_months) {
      findings.push({
        id: "SHELF_LIFE_REF",
        kind: "REFERENCE_DISCREPANCY",
        title: "Potential product reference discrepancy",
        detail: `Declared shelf life ${declared} month(s) (${mfg.raw} → ${bb.raw}). Trusted reference for ${reference.brand} ${reference.product_name} ${reference.pack_size}: ${reference.known_shelf_life_months} month(s), source: ${reference.reference_source}, verified ${reference.verified_on}. A reference mismatch is not by itself a legal violation — manual verification required.`,
        confidence: 0.88,
        evidence: ["date", "front"],
        disposition: "MANUAL_REVIEW_REQUIRED",
      });
    }
  }

  /* --- MRP inconsistency -------------------------------------------- */
  const mrp = fieldValue(fields, "mrp");
  if (mrp?.value && /\/|\(front\)/.test(mrp.value) && mrp.value.split("₹").length > 2) {
    findings.push({
      id: "MRP_CONFLICT",
      kind: "CONSISTENCY",
      title: "Potential MRP inconsistency",
      detail: `Conflicting retail prices read across panels: ${mrp.value}. Manual verification required — no accusation is recorded on image evidence alone.`,
      confidence: 0.91,
      evidence: ["front", "mrp"],
      disposition: "MANUAL_REVIEW_REQUIRED",
    });
  }

  /* --- character size confidence ------------------------------------ */
  const ch = fieldValue(fields, "character_height");
  if (ch && (ch.confidence ?? 1) < 0.7) {
    findings.push({
      id: "FONT_CONFIDENCE",
      kind: "AI_ANOMALY",
      title: "Character-height measurement confidence too low",
      detail: `Estimated ${ch.value} at ${Math.round((ch.confidence ?? 0) * 100)}% measurement confidence, with no calibration reference in frame. Millimetre-level accuracy is not claimed; manual measurement required.`,
      confidence: ch.confidence,
      evidence: [ch.sourceImage ?? "back"],
      disposition: "MANUAL_REVIEW_REQUIRED",
    });
  }

  return findings;
}

/* ------------------------------------------------------------------ */
/* Confidence engine                                                   */
/* ------------------------------------------------------------------ */

export type ConfidenceBand = "HIGH" | "MEDIUM" | "LOW";

export function aggregateConfidence(fields: ExtractedField[]): {
  score: number;
  band: ConfidenceBand;
} {
  const vals = fields
    .filter((f) => f.confidence !== null && !f.unreadable)
    .map((f) => f.confidence as number);
  if (vals.length === 0) return { score: 0, band: "LOW" };
  const score = vals.reduce((a, b) => a + b, 0) / vals.length;
  const band: ConfidenceBand = score >= 0.85 ? "HIGH" : score >= 0.7 ? "MEDIUM" : "LOW";
  return { score, band };
}

export function readabilityVerdict(
  images: CapturedImage[],
): "READABLE" | "PARTIALLY_READABLE" | "NOT_READABLE" {
  if (images.length === 0) return "NOT_READABLE";
  if (images.some((i) => i.quality.grade === "RESCAN_REQUIRED")) return "PARTIALLY_READABLE";
  if (images.every((i) => i.quality.grade === "GOOD")) return "READABLE";
  return "PARTIALLY_READABLE";
}
