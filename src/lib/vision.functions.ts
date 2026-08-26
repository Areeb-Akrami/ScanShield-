import { createServerFn } from "@tanstack/react-start";

/**
 * Real OCR / vision extraction of packaged-commodity declarations.
 * The model is instructed to transcribe ONLY what is visibly printed on the
 * supplied photographs. It never infers, completes or invents a declaration,
 * and it never decides legal compliance — that is done by the rule engine
 * from the verified corpus.
 */

export interface VisionFieldRaw {
  field: string;
  value: string | null;
  confidence: number | null;
  source_panel: string | null;
  unreadable?: boolean;
  note?: string | null;
}

export interface VisionExtraction {
  fields: VisionFieldRaw[];
  classification: {
    product_category: string | null;
    package_type: string | null;
    origin: string | null;
  };
  observations: string[];
  model: string;
}

const FIELDS = [
  "product_name",
  "net_quantity",
  "net_quantity_unit",
  "mrp",
  "unit_sale_price",
  "manufacturer_name",
  "manufacturer_address",
  "importer_name",
  "country_of_origin",
  "manufacturing_date",
  "best_before",
  "consumer_care_phone",
  "character_height",
  "readability",
  "principal_display_panel",
  "mrp_sticker",
  "qr_code",
  "size",
  "usable_sheets",
  "package_structure",
] as const;

const SYSTEM = `You are an OCR and label-reading engine for Indian Legal Metrology packaged-commodity inspection.

ABSOLUTE RULES
- Transcribe ONLY text that is actually visible in the supplied photographs.
- Never guess, complete, translate away, normalise or invent a declaration. If a declaration is not visible, its value MUST be null.
- Distinguish "not printed on the package" (value null, unreadable false) from "printed but not legible in this photo" (value null, unreadable true).
- Never state whether the package is legally compliant. You do not apply law.
- confidence is your OCR confidence in the transcription, 0 to 1. Use null when you did not attempt the field.

FIELD SEMANTICS
- product_name: common or generic name of the commodity as printed.
- net_quantity: the declared net quantity exactly as printed, e.g. "70 g", "1 L", "5 N".
- net_quantity_unit: just the unit symbol used, e.g. "g", "kg", "ml", "L", "N", or a non-SI unit if that is what is printed.
- mrp: the maximum retail price exactly as printed, including the words/symbols around it.
- unit_sale_price: retail sale price per unit of quantity, if printed.
- manufacturer_name / manufacturer_address: name, and the full postal address including PIN code, of the manufacturer, packer or importer.
- importer_name: only if the package names an importer.
- country_of_origin: only if printed.
- manufacturing_date: date/month/year of manufacture, packing or import, as printed.
- best_before: best before / use by / expiry as printed.
- consumer_care_phone: consumer-care contact details (name, phone, e-mail) as printed.
- character_height: your visual estimate in millimetres of the height of the numerals in the net-quantity declaration, written like "2.1 mm (estimated)". Confidence must be low (<= 0.6) unless a physical scale reference is in frame.
- readability: one of READABLE, PARTIALLY_READABLE, NOT_READABLE describing whether the declarations on the package are legible in these photos.
- principal_display_panel: short description of what is on the main display panel.
- mrp_sticker: "STICKER_OBSERVED" if a price/MRP sticker, label patch or overprint is visible on top of a printed declaration, otherwise null.
- qr_code: "PRESENT" if a QR/barcode is visible, otherwise null.
- size: size or dimension declaration if printed (garments, sheets, etc.).
- usable_sheets: number of usable sheets, if printed.
- package_structure: short factual description, e.g. "single retail pack", "multi-piece pack of 4", "combination pack".

CLASSIFICATION HINTS (visual only, may be null)
- product_category: one of FOOD, EDIBLE_OIL_FAT, ELECTRONICS, GARMENT_HOSIERY, MEDICAL_DEVICE, AGRICULTURAL, COSMETICS, PAN_MASALA, OTHER.
- package_type: one of RETAIL, GROUP, COMBINATION, MULTI_PIECE, PROMOTIONAL, GIFT, WHOLESALE, IMPORTED.
- origin: DOMESTIC or IMPORTED.

Return STRICT JSON only, no markdown fence:
{"fields":[{"field":"<one of the listed fields>","value":string|null,"confidence":number|null,"source_panel":string|null,"unreadable":boolean,"note":string|null}],"classification":{"product_category":string|null,"package_type":string|null,"origin":string|null},"observations":[string]}
Include every field in the list exactly once.`;

interface Input {
  images: Array<{ key: string; label: string; dataUrl: string }>;
}

export const extractPackageFields = createServerFn({ method: "POST" })
  .inputValidator((input: Input) => {
    if (!input || !Array.isArray(input.images) || input.images.length === 0) {
      throw new Error("At least one package photograph is required.");
    }
    if (input.images.length > 6) throw new Error("At most six photographs may be submitted.");
    for (const img of input.images) {
      if (typeof img.dataUrl !== "string" || !img.dataUrl.startsWith("data:image/")) {
        throw new Error("Each photograph must be an image data URL.");
      }
      if (img.dataUrl.length > 8_000_000) throw new Error("A photograph exceeds the 6 MB limit.");
    }
    return input;
  })
  .handler(async ({ data }): Promise<VisionExtraction> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) {
      throw new Error(
        "AI extraction is not configured on this server (missing gateway key). No values were produced.",
      );
    }
    const model = "google/gemini-3.7-flash";

    const content: Array<Record<string, unknown>> = [
      {
        type: "text",
        text: `Read the following ${data.images.length} photograph(s) of one packaged commodity and transcribe the declarations. Panels supplied: ${data.images
          .map((i) => `${i.key} (${i.label})`)
          .join(", ")}. Fields to return: ${FIELDS.join(", ")}.`,
      },
    ];
    for (const img of data.images) {
      content.push({ type: "text", text: `Panel: ${img.key} — ${img.label}` });
      content.push({ type: "image_url", image_url: { url: img.dataUrl } });
    }

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      if (res.status === 429) {
        throw new Error("The extraction service is rate limited right now. Wait a moment and run extraction again.");
      }
      if (res.status === 402 || res.status === 403) {
        throw new Error(`Extraction is unavailable: ${body.slice(0, 300)}`);
      }
      throw new Error(`Extraction failed (${res.status}): ${body.slice(0, 300)}`);
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = json.choices?.[0]?.message?.content ?? "";
    const cleaned = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();

    let parsed: {
      fields?: VisionFieldRaw[];
      classification?: VisionExtraction["classification"];
      observations?: string[];
    };
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error("The extraction service returned an unreadable response. Nothing was recorded.");
    }

    const byField = new Map<string, VisionFieldRaw>();
    for (const f of parsed.fields ?? []) {
      if (typeof f?.field === "string") byField.set(f.field, f);
    }

    const fields: VisionFieldRaw[] = FIELDS.map((name) => {
      const f = byField.get(name);
      const value = typeof f?.value === "string" && f.value.trim() !== "" ? f.value.trim() : null;
      return {
        field: name,
        value,
        confidence:
          typeof f?.confidence === "number" ? Math.max(0, Math.min(1, f.confidence)) : null,
        source_panel: typeof f?.source_panel === "string" ? f.source_panel : null,
        unreadable: Boolean(f?.unreadable) && value === null,
        note: typeof f?.note === "string" && f.note.trim() !== "" ? f.note.trim() : null,
      };
    });

    return {
      fields,
      classification: {
        product_category: parsed.classification?.product_category ?? null,
        package_type: parsed.classification?.package_type ?? null,
        origin: parsed.classification?.origin ?? null,
      },
      observations: Array.isArray(parsed.observations)
        ? parsed.observations.filter((o): o is string => typeof o === "string").slice(0, 8)
        : [],
      model,
    };
  });
