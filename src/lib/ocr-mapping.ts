import type {
  InspectionClassification,
  OriginContextId,
  PackageTypeId,
  ProductCategoryId,
} from "@/legal/types";
import type { ExtractedField, PanelKey } from "@/pipeline/types";
import type { VisionExtraction } from "@/lib/vision.functions";

export const FIELD_LABELS: Record<string, string> = {
  product_name: "Product / generic name",
  net_quantity: "Net quantity",
  net_quantity_unit: "Net quantity unit",
  mrp: "Maximum retail price",
  unit_sale_price: "Unit sale price",
  manufacturer_name: "Manufacturer / packer",
  manufacturer_address: "Manufacturer address",
  importer_name: "Importer",
  country_of_origin: "Country of origin",
  manufacturing_date: "Date of manufacture / packing",
  best_before: "Best before / use by",
  consumer_care_phone: "Consumer care",
  character_height: "Character height",
  readability: "Declaration legibility",
  principal_display_panel: "Principal display panel",
  mrp_sticker: "MRP sticker / overprint",
  qr_code: "QR / barcode",
  size: "Size declaration",
  usable_sheets: "Usable sheets",
  package_structure: "Package structure",
};

export const CATEGORIES: ProductCategoryId[] = [
  "FOOD",
  "EDIBLE_OIL_FAT",
  "ELECTRONICS",
  "GARMENT_HOSIERY",
  "MEDICAL_DEVICE",
  "AGRICULTURAL",
  "COSMETICS",
  "PAN_MASALA",
  "OTHER",
];
export const PACKAGE_TYPES: PackageTypeId[] = [
  "RETAIL",
  "GROUP",
  "COMBINATION",
  "MULTI_PIECE",
  "PROMOTIONAL",
  "GIFT",
  "WHOLESALE",
  "IMPORTED",
];
export const ORIGINS: OriginContextId[] = ["DOMESTIC", "IMPORTED"];

export function mapVisionFields(result: VisionExtraction, panels: Set<string>): ExtractedField[] {
  return result.fields.map((f) => {
    const src = f.source_panel && panels.has(f.source_panel) ? (f.source_panel as PanelKey) : null;
    return {
      field: f.field,
      label: FIELD_LABELS[f.field] ?? f.field,
      value: f.value,
      confidence: f.confidence,
      sourceImage: src,
      boundingBox: null,
      ocrEngine: `${result.model} vision OCR`,
      unreadable: Boolean(f.unreadable),
      ...(f.note ? { note: f.note } : {}),
    };
  });
}

export function mapVisionClassification(result: VisionExtraction): InspectionClassification {
  return {
    product_category: (CATEGORIES as string[]).includes(result.classification.product_category ?? "")
      ? (result.classification.product_category as ProductCategoryId)
      : "OTHER",
    package_type: (PACKAGE_TYPES as string[]).includes(result.classification.package_type ?? "")
      ? (result.classification.package_type as PackageTypeId)
      : "RETAIL",
    transaction_context: "RETAIL",
    origin: result.classification.origin === "IMPORTED" ? "IMPORTED" : "DOMESTIC",
    inspection_date: new Date().toISOString().slice(0, 10),
  };
}

export function productNameOf(fields: ExtractedField[]): string {
  const f = fields.find((x) => x.field === "product_name");
  return (f?.inspectorValue ?? f?.value) || "Unidentified product";
}
