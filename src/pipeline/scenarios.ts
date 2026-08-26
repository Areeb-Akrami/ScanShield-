import type {
  CapturedImage,
  DemoScenario,
  ExtractedField,
  ImageQualityReport,
  PanelKey,
} from "./types";

/**
 * Controlled demo scenarios. Every value here is DEMO DATA and is badged as
 * such throughout the UI and in generated reports. No scenario asserts a legal
 * conclusion — the rule engine derives that at runtime.
 */

const OCR = "tesseract-v5 (demo adapter)";

function quality(
  key: PanelKey,
  label: string,
  grade: ImageQualityReport["grade"],
  overrides: Partial<ImageQualityReport> = {},
): CapturedImage {
  const base: ImageQualityReport = {
    grade,
    blur: 0.08,
    glare: 0.05,
    contrast: 0.82,
    resolution: "2048 × 1536",
    issues: [],
    ...overrides,
  };
  return {
    key,
    label,
    original: null,
    processed: null,
    preprocessing: ["deskew", "perspective-correction", "contrast-normalise", "text-region-enhance"],
    quality: base,
  };
}

function f(
  field: string,
  label: string,
  value: string | null,
  confidence: number | null,
  sourceImage: PanelKey | null,
  extra: Partial<ExtractedField> = {},
): ExtractedField {
  return {
    field,
    label,
    value,
    confidence,
    sourceImage,
    boundingBox: value
      ? {
          x: 0.1 + Math.random() * 0.2,
          y: 0.15 + Math.random() * 0.5,
          w: 0.35,
          h: 0.07,
        }
      : null,
    ocrEngine: OCR,
    ...extra,
  };
}

const STANDARD_PANELS = [
  quality("front", "Front label", "GOOD"),
  quality("back", "Back label", "GOOD"),
  quality("mrp", "MRP area", "GOOD"),
  quality("date", "Date area", "GOOD"),
];

const today = "2026-08-26";

function baseFields(over: Partial<Record<string, ExtractedField>> = {}): ExtractedField[] {
  const defaults: ExtractedField[] = [
    f("product_name", "Product name", "Masala Instant Noodles", 0.97, "front"),
    f("net_quantity", "Net quantity", "70 g", 0.95, "front"),
    f("mrp", "Maximum retail price", "₹14.00", 0.96, "mrp"),
    f("unit_sale_price", "Unit sale price", "₹0.20 per gram", 0.9, "back"),
    f("manufacturer_name", "Manufacturer / packer", "Demo Foods Pvt Ltd, Plot 22, MIDC Nashik 422007", 0.93, "back"),
    f("importer_name", "Importer", null, 0.9, null),
    f("country_of_origin", "Country of origin", null, 0.9, null),
    f("manufacturing_date", "Date of manufacture", "06/2026", 0.94, "date"),
    f("best_before", "Best before", "10/2026", 0.92, "date"),
    f("consumer_care_phone", "Consumer care", "1800-000-111 · care@demofoods.example", 0.89, "back"),
    f("character_height", "Character height", "2.1 mm (estimated)", 0.61, "back", {
      note: "Character-height estimate has 61% measurement confidence — no calibration reference in frame. Millimetre-level accuracy is not claimed.",
    }),
    f("readability", "Declaration legibility", "READABLE", 0.91, "back"),
    f("qr_code", "QR code", null, 0.88, null),
    f("size", "Size declaration", null, 0.85, null),
  ];
  return defaults.map((d) => over[d.field] ?? d);
}

export const SCENARIOS: DemoScenario[] = [
  {
    id: "S1",
    title: "Fully compliant retail food package",
    blurb: "All applicable declarations present on readable imagery.",
    seller: "Shree Kirana Stores, Nashik",
    classification: {
      product_category: "FOOD",
      package_type: "RETAIL",
      transaction_context: "RETAIL",
      origin: "DOMESTIC",
      inspection_date: today,
    },
    images: STANDARD_PANELS,
    fields: baseFields(),
    reference: null,
  },
  {
    id: "S2",
    title: "Missing declaration",
    blurb: "Consumer-care details absent from readable back panel.",
    seller: "Anand Super Bazaar, Pune",
    classification: {
      product_category: "FOOD",
      package_type: "RETAIL",
      transaction_context: "RETAIL",
      origin: "DOMESTIC",
      inspection_date: today,
    },
    images: STANDARD_PANELS,
    fields: baseFields({
      consumer_care_phone: f("consumer_care_phone", "Consumer care", null, 0.93, "back", {
        note: "No consumer-care contact detected on any captured panel. Back panel graded GOOD, so absence is not attributable to image quality.",
      }),
    }),
    reference: null,
  },
  {
    id: "S3",
    title: "Invalid / inconsistent date",
    blurb: "Best-before precedes date of manufacture.",
    seller: "Nova Mart, Nagpur",
    classification: {
      product_category: "FOOD",
      package_type: "RETAIL",
      transaction_context: "RETAIL",
      origin: "DOMESTIC",
      inspection_date: today,
    },
    images: STANDARD_PANELS,
    fields: baseFields({
      manufacturing_date: f("manufacturing_date", "Date of manufacture", "10/08/2026", 0.95, "date"),
      best_before: f("best_before", "Best before", "05/08/2026", 0.93, "date", {
        note: "Declared best-before (05/08/2026) precedes the declared date of manufacture (10/08/2026).",
      }),
    }),
    reference: null,
  },
  {
    id: "S4",
    title: "Conflicting MRP across panels",
    blurb: "Front and MRP-area captures disagree.",
    seller: "Value Point, Thane",
    classification: {
      product_category: "FOOD",
      package_type: "RETAIL",
      transaction_context: "RETAIL",
      origin: "DOMESTIC",
      inspection_date: today,
    },
    images: STANDARD_PANELS,
    fields: baseFields({
      mrp: f("mrp", "Maximum retail price", "₹14.00 (front) / ₹18.00 (MRP panel)", 0.91, "mrp", {
        note: "Two different retail prices read from two panels. Recorded as a potential inconsistency for inspector verification, not as a confirmed violation.",
      }),
    }),
    reference: null,
  },
  {
    id: "S5",
    title: "Unreadable MRP — glare",
    blurb: "Image-quality failure, explicitly not a legal violation.",
    seller: "Corner Store, Aurangabad",
    classification: {
      product_category: "FOOD",
      package_type: "RETAIL",
      transaction_context: "RETAIL",
      origin: "DOMESTIC",
      inspection_date: today,
    },
    images: [
      quality("front", "Front label", "GOOD"),
      quality("back", "Back label", "ACCEPTABLE", { contrast: 0.61, issues: ["low contrast"] }),
      quality("mrp", "MRP area", "RESCAN_REQUIRED", {
        glare: 0.74,
        blur: 0.31,
        issues: ["strong specular glare over price region", "partial motion blur"],
      }),
      quality("date", "Date area", "GOOD"),
    ],
    fields: baseFields({
      mrp: f("mrp", "Maximum retail price", null, 0.24, "mrp", {
        unreadable: true,
        note: "MRP region detected but obscured by strong glare. Unable to verify MRP — capture another image at an angle away from the light source. This is not recorded as a missing declaration.",
      }),
    }),
    reference: null,
  },
  {
    id: "S6",
    title: "Potential shelf-life discrepancy",
    blurb: "Declared shelf life exceeds trusted product reference.",
    seller: "Grand Bazaar, Mumbai",
    classification: {
      product_category: "FOOD",
      package_type: "RETAIL",
      transaction_context: "RETAIL",
      origin: "DOMESTIC",
      inspection_date: today,
    },
    images: STANDARD_PANELS,
    fields: baseFields({
      manufacturing_date: f("manufacturing_date", "Date of manufacture", "01/06/2026", 0.96, "date"),
      best_before: f("best_before", "Best before", "01/10/2026", 0.94, "date"),
    }),
    reference: {
      brand: "Demo Foods",
      product_name: "Masala Instant Noodles",
      variant: "70 g single pack",
      manufacturer: "Demo Foods Pvt Ltd",
      pack_size: "70 g",
      barcode: "8901234567890",
      known_shelf_life_months: 3,
      reference_source: "ScanShield demo product reference set",
      reference_url: null,
      verified_on: "2026-05-02",
      verification_status: "DEMO_REFERENCE",
    },
  },
  {
    id: "S7",
    title: "Repeat-violation seller",
    blurb: "Same seller as prior non-compliant inspections — drives the risk engine.",
    seller: "Anand Super Bazaar, Pune",
    classification: {
      product_category: "FOOD",
      package_type: "MULTI_PIECE",
      transaction_context: "RETAIL",
      origin: "DOMESTIC",
      inspection_date: today,
    },
    images: STANDARD_PANELS,
    fields: baseFields({
      net_quantity: f("net_quantity", "Net quantity", null, 0.92, "front", {
        note: "No net-quantity declaration detected on the outer multi-piece package.",
      }),
    }),
    reference: null,
  },
  {
    id: "S8",
    title: "Imported package",
    blurb: "Importer and country-of-origin provisions become applicable.",
    seller: "Global Foods Depot, Delhi",
    classification: {
      product_category: "FOOD",
      package_type: "IMPORTED",
      transaction_context: "RETAIL",
      origin: "IMPORTED",
      inspection_date: today,
    },
    images: STANDARD_PANELS,
    fields: baseFields({
      product_name: f("product_name", "Product name", "Olive Oil Crackers", 0.96, "front"),
      importer_name: f("importer_name", "Importer", "Demo Imports LLP, Andheri East, Mumbai 400069", 0.9, "back"),
      country_of_origin: f("country_of_origin", "Country of origin", "Italy", 0.93, "back"),
    }),
    reference: null,
  },
  {
    id: "S9",
    title: "E-commerce imported listing",
    blurb: "Listing-level origin filter provision — dated 1 July 2026.",
    seller: "Marketplace listing · SKU DM-99213",
    classification: {
      product_category: "FOOD",
      package_type: "IMPORTED",
      transaction_context: "ECOMMERCE",
      origin: "IMPORTED",
      inspection_date: today,
    },
    images: [quality("front", "Listing screenshot", "GOOD")],
    fields: baseFields({
      country_of_origin: f("country_of_origin", "Country of origin", "Spain", 0.91, "front"),
      importer_name: f("importer_name", "Importer", "Demo Imports LLP, Mumbai", 0.88, "front"),
    }),
    reference: null,
  },
  {
    id: "S10",
    title: "Electronic product with QR declarations",
    blurb: "QR route applies; specified information must still appear on-pack.",
    seller: "Techno Retail, Bengaluru",
    classification: {
      product_category: "ELECTRONICS",
      package_type: "RETAIL",
      transaction_context: "RETAIL",
      origin: "DOMESTIC",
      inspection_date: today,
    },
    images: STANDARD_PANELS,
    fields: baseFields({
      product_name: f("product_name", "Product name", "Wireless Earbuds Model DX-2", 0.95, "front"),
      net_quantity: f("net_quantity", "Net quantity", "1 N", 0.94, "front"),
      mrp: f("mrp", "Maximum retail price", "₹2,499.00", 0.96, "mrp"),
      qr_code: f("qr_code", "QR code", "https://demo.example/product/dx2 (scannable)", 0.97, "back"),
      best_before: f("best_before", "Best before", null, 0.9, null),
    }),
    reference: null,
  },
  {
    id: "S11",
    title: "Garment / hosiery",
    blurb: "Category-specific declaration set activates.",
    seller: "Fashion Hub, Surat",
    classification: {
      product_category: "GARMENT_HOSIERY",
      package_type: "RETAIL",
      transaction_context: "RETAIL",
      origin: "DOMESTIC",
      inspection_date: today,
    },
    images: STANDARD_PANELS,
    fields: baseFields({
      product_name: f("product_name", "Product name", "Cotton Crew Socks (pack of 3)", 0.94, "front"),
      net_quantity: f("net_quantity", "Net quantity", "3 N", 0.92, "front"),
      size: f("size", "Size declaration", null, 0.9, "back", {
        note: "No size declaration detected on the captured panels.",
      }),
      best_before: f("best_before", "Best before", null, 0.9, null),
    }),
    reference: null,
  },
  {
    id: "S12",
    title: "Special-category exemption (pan masala)",
    blurb: "Dated exclusion resolves to NOT APPLICABLE, not PASS.",
    seller: "Chandan Traders, Kanpur",
    classification: {
      product_category: "PAN_MASALA",
      package_type: "RETAIL",
      transaction_context: "RETAIL",
      origin: "DOMESTIC",
      inspection_date: today,
    },
    images: STANDARD_PANELS,
    fields: baseFields({
      product_name: f("product_name", "Product name", "Demo Pan Masala", 0.93, "front"),
      unit_sale_price: f("unit_sale_price", "Unit sale price", null, 0.9, null),
    }),
    reference: null,
  },
];

export function scenarioById(id: string): DemoScenario | undefined {
  return SCENARIOS.find((s) => s.id === id);
}
