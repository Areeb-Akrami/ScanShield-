import { useSession } from "@/components/AppShell";
import { CorpusBanner } from "@/components/CorpusBanner";
import { Button, DemoBadge, Field, Panel, PanelHeader, StatusPill, inputClass } from "@/components/ui";
import type { InspectionClassification } from "@/legal/types";
import { audit, runPipeline, saveInspection, type GeoTag, type Inspection } from "@/lib/store";
import { SCENARIOS, scenarioById } from "@/pipeline/scenarios";
import type { CapturedImage, ExtractedField } from "@/pipeline/types";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";

export const Route = createFileRoute("/inspector/scan")({
  head: () => ({
    meta: [
      { title: "New inspection — ScanShield" },
      { name: "description", content: "Capture geo-tagged package evidence, run extraction and validate against the configured Legal Metrology rule set." },
      { property: "og:title", content: "New inspection — ScanShield" },
      { property: "og:description", content: "Geo-tagged capture, image quality gate, extraction and rule validation." },
    ],
  }),
  component: ScanPage,
});

type Step = "location" | "seller" | "capture" | "quality" | "extract" | "verify";

const STEPS: Array<{ id: Step; label: string }> = [
  { id: "location", label: "GPS" },
  { id: "seller", label: "Seller" },
  { id: "capture", label: "Capture" },
  { id: "quality", label: "Quality" },
  { id: "extract", label: "Extraction" },
  { id: "verify", label: "Verify" },
];

function ScanPage() {
  const session = useSession();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("location");
  const [geo, setGeo] = useState<GeoTag>({
    latitude: null,
    longitude: null,
    accuracy: null,
    capturedAt: "",
    status: "NOT_ATTEMPTED",
  });
  const [seller, setSeller] = useState("");
  const [district, setDistrict] = useState(session?.district ?? "");
  const [scenarioId, setScenarioId] = useState<string>(SCENARIOS[0]!.id);
  const [uploads, setUploads] = useState<string[]>([]);
  const [fields, setFields] = useState<ExtractedField[] | null>(null);
  const [images, setImages] = useState<CapturedImage[]>([]);
  const [classification, setClassification] = useState<InspectionClassification | null>(null);
  const [busy, setBusy] = useState(false);

  const scenario = scenarioById(scenarioId)!;

  function captureLocation() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeo({ latitude: null, longitude: null, accuracy: null, capturedAt: new Date().toISOString(), status: "UNAVAILABLE", note: "This device does not expose a geolocation API." });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setGeo({
          latitude: Number(pos.coords.latitude.toFixed(6)),
          longitude: Number(pos.coords.longitude.toFixed(6)),
          accuracy: Math.round(pos.coords.accuracy),
          capturedAt: new Date().toISOString(),
          status: "CAPTURED",
        }),
      (err) =>
        setGeo({
          latitude: null,
          longitude: null,
          accuracy: null,
          capturedAt: new Date().toISOString(),
          status: err.code === err.PERMISSION_DENIED ? "PERMISSION_DENIED" : "UNAVAILABLE",
          note:
            err.code === err.PERMISSION_DENIED
              ? "Location permission was denied. The inspection can continue, but the record will be flagged as lacking geo-tagged evidence. Coordinates are never fabricated."
              : "Location could not be determined on this device.",
        }),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  function onFiles(list: FileList | null) {
    if (!list) return;
    const urls: string[] = [];
    for (const file of Array.from(list).slice(0, 6)) {
      if (!file.type.startsWith("image/")) continue;
      if (file.size > 12 * 1024 * 1024) continue;
      urls.push(URL.createObjectURL(file));
    }
    setUploads((prev) => [...prev, ...urls].slice(0, 6));
  }

  function runExtraction() {
    setBusy(true);
    const merged = scenario.images.map((img, idx) => ({
      ...img,
      original: uploads[idx] ?? null,
      processed: uploads[idx] ?? null,
    }));
    window.setTimeout(() => {
      setImages(merged);
      setFields(scenario.fields.map((f) => ({ ...f })));
      setClassification({ ...scenario.classification });
      setBusy(false);
      setStep("extract");
    }, 700);
  }

  function editField(field: string, value: string) {
    setFields((prev) =>
      prev
        ? prev.map((f) =>
            f.field === field
              ? {
                  ...f,
                  inspectorValue: value === "" ? null : value,
                  editedAt: new Date().toISOString(),
                  editedBy: session?.email ?? "unknown",
                }
              : f,
          )
        : prev,
    );
  }

  function finalise() {
    if (!fields || !classification) return;
    const output = runPipeline(classification, fields, images, scenario.reference);
    const localId = `LOC-${Date.now()}`;
    const productName =
      fields.find((f) => f.field === "product_name")?.inspectorValue ??
      fields.find((f) => f.field === "product_name")?.value ??
      "Unidentified product";

    const inspection: Inspection = {
      localId,
      serverId: null,
      scenarioId,
      isDemo: true,
      inspectorId: session?.email ?? "unknown",
      inspectorName: session?.name ?? "Unknown",
      seller: seller.trim() || scenario.seller,
      district: district.trim() || "—",
      productName,
      classification,
      images,
      fields,
      findings: output.findings,
      tally: output.tally,
      finalStatus: output.finalStatus,
      inspectorDecision: null,
      decisionNote: "",
      confidence: output.confidence,
      readability: output.readability,
      geo,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      syncStatus: typeof navigator !== "undefined" && navigator.onLine ? "PENDING_SYNC" : "OFFLINE",
      retryCount: 0,
      lastError: null,
    };

    saveInspection(inspection);
    audit({ user: inspection.inspectorId, action: "INSPECTION_CREATED", entity: "Inspection", entityId: localId, before: null, after: output.finalStatus });
    audit({ user: inspection.inspectorId, action: "RULE_ENGINE_EXECUTED", entity: "Inspection", entityId: localId, before: null, after: `${output.rulesInForce} provisions in force on ${classification.inspection_date}` });
    for (const f of fields.filter((x) => x.editedAt)) {
      audit({ user: f.editedBy ?? "unknown", action: "FIELD_EDITED", entity: f.field, entityId: localId, before: f.value, after: f.inspectorValue ?? "(cleared)" });
    }
    navigate({ to: "/inspector/inspections/$id", params: { id: localId } });
  }

  const stepIndex = STEPS.findIndex((s) => s.id === step);

  return (
    <div className="space-y-4">
      <CorpusBanner compact />

      <ol className="flex flex-wrap gap-1.5" aria-label="Inspection progress">
        {STEPS.map((s, i) => (
          <li
            key={s.id}
            className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${
              i < stepIndex
                ? "border-pass/30 bg-pass/10 text-pass"
                : i === stepIndex
                  ? "border-accent bg-accent/10 text-foreground"
                  : "border-border text-muted-foreground"
            }`}
          >
            {i + 1}. {s.label}
          </li>
        ))}
      </ol>

      {step === "location" ? (
        <Panel>
          <PanelHeader title="Geo-tagged evidence" subtitle="Coordinates come from the device only. Nothing is simulated." />
          <div className="space-y-3 p-4">
            <Button onClick={captureLocation}>Capture current location</Button>
            {geo.status === "CAPTURED" ? (
              <p className="text-sm">
                <span className="font-mono">{geo.latitude}, {geo.longitude}</span>{" "}
                <span className="text-muted-foreground">±{geo.accuracy} m · {new Date(geo.capturedAt).toLocaleTimeString()}</span>
              </p>
            ) : geo.status !== "NOT_ATTEMPTED" ? (
              <p className="rounded-md bg-review/15 px-3 py-2 text-xs text-review-foreground">{geo.note}</p>
            ) : (
              <p className="text-xs text-muted-foreground">Location has not been requested yet.</p>
            )}
            <div className="flex gap-2 pt-1">
              <Button variant="outline" onClick={() => setStep("seller")}>
                {geo.status === "CAPTURED" ? "Continue" : "Continue without location"}
              </Button>
            </div>
          </div>
        </Panel>
      ) : null}

      {step === "seller" ? (
        <Panel>
          <PanelHeader title="Seller / premises" />
          <div className="space-y-3 p-4">
            <Field label="Business name">
              <input value={seller} onChange={(e) => setSeller(e.target.value)} className={inputClass()} placeholder="e.g. Shree Kirana Stores" />
            </Field>
            <Field label="District">
              <input value={district} onChange={(e) => setDistrict(e.target.value)} className={inputClass()} />
            </Field>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep("location")}>Back</Button>
              <Button onClick={() => setStep("capture")}>Continue</Button>
            </div>
          </div>
        </Panel>
      ) : null}

      {step === "capture" ? (
        <div className="space-y-4">
          <Panel>
            <PanelHeader title="Capture package evidence" subtitle="Front, back, side, MRP area, date area and any additional panel." />
            <div className="space-y-3 p-4">
              <ul className="grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-3">
                {["Hold steady", "Avoid glare — angle away from the light", "Keep the label inside the frame", "Move closer for small print", "Improve lighting", "Capture every declared panel"].map((tip) => (
                  <li key={tip} className="rounded border border-border px-2 py-1.5">{tip}</li>
                ))}
              </ul>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                className="hidden"
                onChange={(e) => onFiles(e.target.files)}
              />
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => fileRef.current?.click()}>Open camera / upload</Button>
                {uploads.length > 0 ? (
                  <Button variant="ghost" onClick={() => setUploads([])}>Clear captures</Button>
                ) : null}
              </div>
              {uploads.length > 0 ? (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                  {uploads.map((u, i) => (
                    <img key={u} src={u} alt={`Captured evidence ${i + 1}`} className="aspect-square w-full rounded border border-border object-cover" />
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  No image captured yet. You can still run a demo scenario below — the pipeline output is
                  clearly badged as demo data.
                </p>
              )}
            </div>
          </Panel>

          <Panel>
            <PanelHeader
              title={<span className="inline-flex items-center gap-2">Demo scenario <DemoBadge /></span>}
              subtitle="Controlled extraction output so the rule engine can be demonstrated without a paid OCR service."
            />
            <div className="space-y-3 p-4">
              <Field label="Scenario">
                <select value={scenarioId} onChange={(e) => setScenarioId(e.target.value)} className={inputClass()}>
                  {SCENARIOS.map((s) => (
                    <option key={s.id} value={s.id}>{s.id} — {s.title}</option>
                  ))}
                </select>
              </Field>
              <p className="text-xs text-muted-foreground">{scenario.blurb}</p>
              <div className="flex flex-wrap gap-1.5 text-[11px]">
                <StatusPill token="NOT_APPLICABLE" label={scenario.classification.product_category.replaceAll("_", " ")} />
                <StatusPill token="NOT_APPLICABLE" label={scenario.classification.package_type.replaceAll("_", " ")} />
                <StatusPill token="NOT_APPLICABLE" label={scenario.classification.transaction_context} />
                <StatusPill token="NOT_APPLICABLE" label={scenario.classification.origin} />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep("seller")}>Back</Button>
                <Button onClick={() => setStep("quality")}>Run image quality check</Button>
              </div>
            </div>
          </Panel>
        </div>
      ) : null}

      {step === "quality" ? (
        <Panel>
          <PanelHeader title="Image quality gate" subtitle="Quality failures block verification — they are never recorded as legal violations." />
          <ul className="divide-y divide-border">
            {scenario.images.map((img) => (
              <li key={img.key} className="px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium">{img.label}</span>
                  <StatusPill
                    token={img.quality.grade === "GOOD" ? "PASS" : img.quality.grade === "ACCEPTABLE" ? "MANUAL_REVIEW_REQUIRED" : "RESCAN_REQUIRED"}
                    label={img.quality.grade.replaceAll("_", " ")}
                  />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  blur {img.quality.blur.toFixed(2)} · glare {img.quality.glare.toFixed(2)} · contrast{" "}
                  {img.quality.contrast.toFixed(2)} · {img.quality.resolution}
                  {img.quality.issues.length > 0 ? ` · ${img.quality.issues.join("; ")}` : ""}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Preprocessing applied: {img.preprocessing.join(", ")}. Original evidence retained unmodified.
                </p>
              </li>
            ))}
          </ul>
          <div className="flex gap-2 p-4">
            <Button variant="outline" onClick={() => setStep("capture")}>Back</Button>
            <Button disabled={busy} onClick={runExtraction}>
              {busy ? "Running OCR + computer vision…" : "Run extraction"}
            </Button>
          </div>
        </Panel>
      ) : null}

      {(step === "extract" || step === "verify") && fields ? (
        <Panel>
          <PanelHeader
            title="Extracted declarations"
            subtitle="Edit any value before validation. Every modification is audited against the AI value."
            action={<DemoBadge />}
          />
          <ul className="divide-y divide-border">
            {fields.map((f) => {
              const effective = f.inspectorValue !== undefined ? f.inspectorValue : f.value;
              return (
                <li key={f.field} className="px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium">{f.label}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {f.unreadable
                        ? "unreadable region"
                        : f.confidence !== null
                          ? `confidence ${Math.round(f.confidence * 100)}%`
                          : "not attempted"}{" "}
                      · {f.ocrEngine}
                    </span>
                  </div>
                  <input
                    className={inputClass("mt-1.5 font-mono text-xs")}
                    value={effective ?? ""}
                    placeholder="NOT_DETECTED"
                    onChange={(e) => editField(f.field, e.target.value)}
                  />
                  {f.inspectorValue !== undefined ? (
                    <p className="mt-1 text-[11px] text-accent">
                      Inspector-modified · AI value was {f.value ?? "NOT_DETECTED"} · {new Date(f.editedAt!).toLocaleTimeString()}
                    </p>
                  ) : null}
                  {f.note ? <p className="mt-1 text-[11px] text-muted-foreground">{f.note}</p> : null}
                </li>
              );
            })}
          </ul>
          <div className="flex gap-2 p-4">
            <Button variant="outline" onClick={() => setStep("quality")}>Back</Button>
            <Button onClick={finalise}>Classify, apply rules and produce result</Button>
          </div>
        </Panel>
      ) : null}
    </div>
  );
}
