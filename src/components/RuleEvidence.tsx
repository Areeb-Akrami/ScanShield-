import type { RuleCheckResult } from "@/legal/types";
import type { CapturedImage, ExtractedField, PanelKey } from "@/pipeline/types";

interface Props {
  result: RuleCheckResult;
  images: CapturedImage[];
  fields: ExtractedField[];
}

/** Evidence preview for a single rule check: captured panel, OCR extraction, detected text, region. */
export function RuleEvidence({ result, images, fields }: Props) {
  const field = fields.find((f) => f.field === result.rule.field) ?? null;
  const panelKeys = new Set<PanelKey>();
  for (const e of result.evidence) panelKeys.add(e as PanelKey);
  if (field?.sourceImage) panelKeys.add(field.sourceImage);
  const panels = images.filter((img) => panelKeys.has(img.key));
  const shown = panels.length > 0 ? panels : images.slice(0, 1);
  const detected = field ? (field.inspectorValue !== undefined ? field.inspectorValue : field.value) : result.detected;
  const box = field?.boundingBox ?? null;

  return (
    <div className="mt-3 space-y-3 rounded border border-border bg-muted/30 p-3">
      <div>
        <p className="label-caps">Captured evidence</p>
        {shown.length === 0 ? (
          <p className="mt-1 text-[11px] text-review-foreground">No image is stored for this check.</p>
        ) : (
          <ul className="mt-1.5 grid gap-2 sm:grid-cols-2">
            {shown.map((img) => (
              <li key={img.key}>
                <div className="relative overflow-hidden rounded border border-border">
                  <img
                    src={img.processed ?? img.original ?? ""}
                    alt={`${img.label} panel used as evidence for ${result.rule.title}`}
                    className="w-full object-contain"
                  />
                  {box && field?.sourceImage === img.key ? (
                    <span
                      aria-hidden
                      className="pointer-events-none absolute border-2 border-fail bg-fail/15"
                      style={{
                        left: `${box.x * 100}%`,
                        top: `${box.y * 100}%`,
                        width: `${box.w * 100}%`,
                        height: `${box.h * 100}%`,
                      }}
                    />
                  ) : null}
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {img.label} · quality {img.quality.grade.replaceAll("_", " ").toLowerCase()}
                  {img.preprocessing.length ? ` · ${img.preprocessing.join(", ")}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
        {!box ? (
          <p className="mt-1 text-[11px] text-muted-foreground">
            No region coordinates were returned by the OCR engine, so the whole panel is shown as evidence.
          </p>
        ) : null}
      </div>

      <div>
        <p className="label-caps">OCR extraction</p>
        {field ? (
          <dl className="mt-1 grid gap-1 text-[11px] text-muted-foreground sm:grid-cols-2">
            <div>
              <dt className="inline font-medium">Field: </dt>
              <dd className="inline">{field.label}</dd>
            </div>
            <div>
              <dt className="inline font-medium">Engine: </dt>
              <dd className="inline">{field.ocrEngine || "not attempted"}</dd>
            </div>
            <div>
              <dt className="inline font-medium">Confidence: </dt>
              <dd className="inline">
                {field.unreadable
                  ? "unreadable"
                  : field.confidence !== null
                    ? `${Math.round(field.confidence * 100)}%`
                    : "not attempted"}
              </dd>
            </div>
            <div>
              <dt className="inline font-medium">Panel: </dt>
              <dd className="inline">{field.sourceImage ?? "not attributed"}</dd>
            </div>
            {field.inspectorValue !== undefined ? (
              <div className="sm:col-span-2">
                <dt className="inline font-medium">Original AI value: </dt>
                <dd className="inline font-mono">{field.value ?? "NOT_DETECTED"}</dd>
              </div>
            ) : null}
            {field.note ? (
              <div className="sm:col-span-2">
                <dt className="inline font-medium">Note: </dt>
                <dd className="inline">{field.note}</dd>
              </div>
            ) : null}
          </dl>
        ) : (
          <p className="mt-1 text-[11px] text-review-foreground">
            No extraction record exists for “{result.rule.field}”. Nothing was read from the label for this provision.
          </p>
        )}
      </div>

      <div>
        <p className="label-caps">Detected text</p>
        <p className="mt-1 rounded border border-border bg-card px-2 py-1.5 font-mono text-xs">
          {detected ?? "NOT_DETECTED"}
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground">Requirement: {result.expected}</p>
      </div>
    </div>
  );
}
