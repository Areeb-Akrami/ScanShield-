import type { EvidenceMap } from "@/legal/engine";
import type { InspectionClassification } from "@/legal/types";

export type ImageQualityGrade = "GOOD" | "ACCEPTABLE" | "RESCAN_REQUIRED";

export interface ImageQualityReport {
  grade: ImageQualityGrade;
  blur: number;
  glare: number;
  contrast: number;
  resolution: string;
  issues: string[];
}

export type PanelKey = "front" | "back" | "side" | "mrp" | "date" | "extra";

export interface CapturedImage {
  key: PanelKey;
  label: string;
  /** Object URL or data URL of the ORIGINAL evidence. Never overwritten. */
  original: string | null;
  /** Result of the preprocessing chain, when produced. */
  processed: string | null;
  preprocessing: string[];
  quality: ImageQualityReport;
}

export interface ExtractedField {
  field: string;
  label: string;
  value: string | null;
  confidence: number | null;
  sourceImage: PanelKey | null;
  boundingBox: { x: number; y: number; w: number; h: number } | null;
  ocrEngine: string;
  unreadable?: boolean;
  note?: string;
  inspectorValue?: string | null;
  editedAt?: string;
  editedBy?: string;
}

export type FindingKind =
  | "AI_ANOMALY"
  | "IMAGE_QUALITY"
  | "REFERENCE_DISCREPANCY"
  | "CONSISTENCY";

export interface AiFinding {
  id: string;
  kind: FindingKind;
  title: string;
  detail: string;
  confidence: number | null;
  evidence: string[];
  disposition: "MANUAL_REVIEW_REQUIRED" | "INFORMATIONAL";
}

export interface ProductReference {
  brand: string;
  product_name: string;
  variant: string | null;
  manufacturer: string;
  pack_size: string;
  barcode: string | null;
  known_shelf_life_months: number;
  reference_source: string;
  reference_url: string | null;
  verified_on: string;
  verification_status: "DEMO_REFERENCE" | "VERIFIED";
}

export interface DemoScenario {
  id: string;
  title: string;
  blurb: string;
  classification: InspectionClassification;
  images: CapturedImage[];
  fields: ExtractedField[];
  reference: ProductReference | null;
  seller: string;
}

export function toEvidenceMap(fields: ExtractedField[]): EvidenceMap {
  const map: EvidenceMap = {};
  for (const f of fields) {
    const effective = f.inspectorValue !== undefined ? f.inspectorValue : f.value;
    map[f.field] = {
      value: effective,
      confidence: f.inspectorValue !== undefined ? 1 : f.confidence,
      images: f.sourceImage ? [f.sourceImage] : [],
      unreadable: f.inspectorValue !== undefined ? false : f.unreadable,
      note: f.note,
    };
  }
  return map;
}
