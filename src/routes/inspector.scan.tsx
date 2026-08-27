import { useSession } from "@/components/AppShell";
import { CorpusBanner } from "@/components/CorpusBanner";
import { Button, DemoBadge, Field, Panel, PanelHeader, StatusPill, inputClass } from "@/components/ui";
import { PANEL_ORDER, fileToDataUrl, makeThumbnail, preprocessImage } from "@/lib/imaging";
import { audit, enqueueOcrJob, runPipeline, saveInspection, type GeoTag, type Inspection } from "@/lib/store";
import { CATEGORIES, ORIGINS, PACKAGE_TYPES, mapVisionClassification, mapVisionFields } from "@/lib/ocr-mapping";
import { extractPackageFields } from "@/lib/vision.functions";
import type {
  InspectionClassification,
  OriginContextId,
  PackageTypeId,
  ProductCategoryId,
  TransactionContextId,
} from "@/legal/types";
import { SCENARIOS, scenarioById } from "@/pipeline/scenarios";
import type { CapturedImage, ExtractedField, PanelKey } from "@/pipeline/types";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";

export const Route = createFileRoute("/inspector/scan")({
  head: () => ({
    meta: [
      { title: "New inspection — ScanShield" },
      { name: "description", content: "Capture geo-tagged package evidence, read the label with OCR and validate the declarations against the ingested Legal Metrology rules." },
      { property: "og:title", content: "New inspection — ScanShield" },
      { property: "og:description", content: "Geo-tagged capture, image quality gate, real label extraction and rule validation." },
    ],
  }),
  component: ScanPage,
});

type Step = "location" | "seller" | "capture" | "quality" | "extract";

const STEPS: Array<{ id: Step; label: string }> = [
  { id: "location", label: "GPS" },
  { id: "seller", label: "Seller" },
  { id: "capture", label: "Capture" },
  { id: "quality", label: "Quality" },
  { id: "extract", label: "Extraction" },
];

const CONTEXTS: TransactionContextId[] = ["RETAIL", "WHOLESALE", "ECOMMERCE"];
const ORIGINS: OriginContextId[] = ["DOMESTIC", "IMPORTED"];

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
  const [useDemo, setUseDemo] = useState(false);
  const [scenarioId, setScenarioId] = useState<string>(SCENARIOS[0]!.id);
  const [captures, setCaptures] = useState<CapturedImage[]>([]);
  const [fields, setFields] = useState<ExtractedField[] | null>(null);
  const [images, setImages] = useState<CapturedImage[]>([]);
  const [observations, setObservations] = useState<string[]>([]);
  const [classification, setClassification] = useState<InspectionClassification | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);

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

  async function onFiles(list: FileList | null) {
    if (!list) return;
    setPreparing(true);
    setError(null);
    try {
      const next: CapturedImage[] = [];
      const files = Array.from(list).filter((f) => f.type.startsWith("image/") && f.size <= 12 * 1024 * 1024);
      for (const file of files) {
        const slot = PANEL_ORDER[Math.min(captures.length + next.length, PANEL_ORDER.length - 1)]!;
        const dataUrl = await fileToDataUrl(file);
        next.push(await preprocessImage(slot.key, slot.label, dataUrl));
      }
      setCaptures((prev) => [...prev, ...next].slice(0, 6));
    } catch (e) {
      setError(e instanceof Error ? e.message : "The photographs could not be processed on this device.");
    } finally {
      setPreparing(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function setPanel(index: number, key: PanelKey) {
    const label = PANEL_ORDER.find((p) => p.key === key)?.label ?? key;
    setCaptures((prev) => prev.map((c, i) => (i === index ? { ...c, key, label } : c)));
  }

  async function runRealExtraction() {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      await queueOffline();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const payload = captures.map((c) => ({ key: c.key, label: c.label, dataUrl: c.processed ?? c.original! }));
      const result = await extractPackageFields({ data: { images: payload } });

      const panelKeys = new Set(captures.map((c) => c.key));
      setImages(captures);
      setFields(mapVisionFields(result, panelKeys));
      setObservations(result.observations);
      setClassification(mapVisionClassification(result));
      setStep("extract");
    } catch (e) {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        await queueOffline();
        return;
      }
      setError(e instanceof Error ? e.message : "Extraction failed. No values were recorded.");
    } finally {
      setBusy(false);
    }
  }

  /** Offline-first: store the inspection with its evidence and queue the OCR + rule run for reconnection. */
  async function queueOffline() {
    setBusy(true);
    setError(null);
    try {
      const localId = `LOC-${Date.now()}`;
      const queueImages = captures.map((c) => ({
        key: c.key,
        label: c.label,
        dataUrl: c.processed ?? c.original!,
      }));
      const storedImages: CapturedImage[] = await Promise.all(
        captures.map(async (img) => ({
          ...img,
          original: img.original ? await makeThumbnail(img.original) : null,
          processed: img.processed ? await makeThumbnail(img.processed) : null,
        })),
      );
      const classificationDraft: InspectionClassification = {
        product_category: "OTHER",
        package_type: "RETAIL",
        transaction_context: "RETAIL",
        origin: "DOMESTIC",
        inspection_date: new Date().toISOString().slice(0, 10),
      };
      const inspection: Inspection = {
        localId,
        serverId: null,
        scenarioId: null,
        isDemo: false,
        inspectorId: session?.email ?? "unknown",
        inspectorName: session?.name ?? "Unknown",
        seller: seller.trim() || "—",
        district: district.trim() || "—",
        productName: "Awaiting offline extraction",
        classification: classificationDraft,
        images: storedImages,
        fields: [],
        findings: [],
        tally: { PASS: 0, FAIL: 0, MANUAL_REVIEW_REQUIRED: 0, RESCAN_REQUIRED: 0, INSUFFICIENT_EVIDENCE: 0, NOT_APPLICABLE: 0 },
        finalStatus: "MANUAL_REVIEW_REQUIRED",
        inspectorDecision: null,
        decisionNote: "",
        confidence: 0,
        readability: "NOT_ASSESSED",
        geo,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        syncStatus: "OFFLINE",
        retryCount: 0,
        lastError: null,
        extractionStatus: "PENDING_OCR",
        extractionError: null,
      };
      saveInspection(inspection);
      enqueueOcrJob(localId, queueImages);
      audit({
        user: inspection.inspectorId,
        action: "INSPECTION_QUEUED_OFFLINE",
        entity: "Inspection",
        entityId: localId,
        before: null,
        after: `${queueImages.length} panel(s) stored — OCR and rule checks queued until connectivity returns`,
      });
      navigate({ to: "/inspector/inspections/$id", params: { id: localId } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "The inspection could not be queued on this device.");
    } finally {
      setBusy(false);
    }
  }

  function runDemoExtraction() {
    setBusy(true);
    window.setTimeout(() => {
      setImages(scenario.images.map((img) => ({ ...img })));
      setFields(scenario.fields.map((f) => ({ ...f })));
      setObservations([]);
      setClassification({ ...scenario.classification });
      setBusy(false);
      setStep("extract");
    }, 500);
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

  async function finalise() {
    if (!fields || !classification) return;
    setBusy(true);
    try {
      const isDemo = useDemo;
      const output = runPipeline(classification, fields, images, isDemo ? scenario.reference : null);
      const localId = `LOC-${Date.now()}`;
      const productName =
        fields.find((f) => f.field === "product_name")?.inspectorValue ??
        fields.find((f) => f.field === "product_name")?.value ??
        "Unidentified product";

      // Persist compact copies — the full-resolution capture stays in this session only.
      const storedImages: CapturedImage[] = await Promise.all(
        images.map(async (img) => ({
          ...img,
          original: img.original ? await makeThumbnail(img.original) : null,
          processed: img.processed ? await makeThumbnail(img.processed) : null,
        })),
      );

      const inspection: Inspection = {
        localId,
        serverId: null,
        scenarioId: isDemo ? scenarioId : null,
        isDemo,
        inspectorId: session?.email ?? "unknown",
        inspectorName: session?.name ?? "Unknown",
        seller: seller.trim() || (isDemo ? scenario.seller : "—"),
        district: district.trim() || "—",
        productName,
        classification,
        images: storedImages,
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
      audit({ user: inspection.inspectorId, action: isDemo ? "DEMO_EXTRACTION" : "OCR_EXTRACTION_EXECUTED", entity: "Inspection", entityId: localId, before: null, after: `${images.length} panel(s) · ${fields.filter((f) => f.value !== null).length} declaration(s) read` });
      audit({ user: inspection.inspectorId, action: "RULE_ENGINE_EXECUTED", entity: "Inspection", entityId: localId, before: null, after: `${output.rulesInForce} provisions in force on ${classification.inspection_date}` });
      for (const f of fields.filter((x) => x.editedAt)) {
        audit({ user: f.editedBy ?? "unknown", action: "FIELD_EDITED", entity: f.field, entityId: localId, before: f.value, after: f.inspectorValue ?? "(cleared)" });
      }
      navigate({ to: "/inspector/inspections/$id", params: { id: localId } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "The inspection could not be saved on this device.");
      setBusy(false);
    }
  }

  const stepIndex = STEPS.findIndex((s) => s.id === step);
  const blocked = captures.some((c) => c.quality.grade === "RESCAN_REQUIRED");

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

      {error ? (
        <p role="alert" className="rounded-md border border-fail/40 bg-fail/10 px-3 py-2 text-xs text-fail">
          {error}
        </p>
      ) : null}

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
            <PanelHeader
              title="Capture package evidence"
              subtitle="Photograph the front, back, MRP area and date area. Each photo is measured for focus, glare and contrast, then read by OCR."
            />
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
                onChange={(e) => void onFiles(e.target.files)}
              />
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => fileRef.current?.click()} disabled={preparing}>
                  {preparing ? "Processing photos…" : "Open camera / upload"}
                </Button>
                {captures.length > 0 ? (
                  <Button variant="ghost" onClick={() => setCaptures([])}>Clear captures</Button>
                ) : null}
              </div>

              {captures.length > 0 ? (
                <ul className="grid gap-3 sm:grid-cols-2">
                  {captures.map((c, i) => (
                    <li key={i} className="rounded border border-border p-2">
                      <img src={c.processed ?? c.original ?? ""} alt={`${c.label} evidence`} className="aspect-video w-full rounded object-cover" />
                      <select
                        aria-label={`Panel for photo ${i + 1}`}
                        className={inputClass("mt-2 text-xs")}
                        value={c.key}
                        onChange={(e) => setPanel(i, e.target.value as PanelKey)}
                      >
                        {PANEL_ORDER.map((p) => (
                          <option key={p.key} value={p.key}>{p.label}</option>
                        ))}
                      </select>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {c.quality.resolution} · focus {c.quality.blur.toFixed(2)} · glare {c.quality.glare.toFixed(2)} · contrast {c.quality.contrast.toFixed(2)}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">
                  No photograph captured yet. Photographs are read by an OCR/vision model; declarations that
                  are not visible are reported as not detected, never assumed.
                </p>
              )}

              <div className="flex gap-2 pt-1">
                <Button variant="outline" onClick={() => setStep("seller")}>Back</Button>
                <Button
                  disabled={captures.length === 0}
                  onClick={() => {
                    setUseDemo(false);
                    setStep("quality");
                  }}
                >
                  Run image quality check
                </Button>
              </div>
            </div>
          </Panel>

          <Panel>
            <PanelHeader
              title={<span className="inline-flex items-center gap-2">Demo scenario <DemoBadge /></span>}
              subtitle="Optional. Controlled extraction output for demonstrating the rule engine without a package in hand."
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
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => {
                  setUseDemo(true);
                  runDemoExtraction();
                }}
              >
                Run demo scenario instead
              </Button>
            </div>
          </Panel>
        </div>
      ) : null}

      {step === "quality" ? (
        <Panel>
          <PanelHeader title="Image quality gate" subtitle="Measured on this device from the captured pixels. Quality failures block verification — they are never recorded as legal violations." />
          <ul className="divide-y divide-border">
            {captures.map((img, i) => (
              <li key={i} className="px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium">{img.label}</span>
                  <StatusPill
                    token={img.quality.grade === "GOOD" ? "PASS" : img.quality.grade === "ACCEPTABLE" ? "MANUAL_REVIEW_REQUIRED" : "RESCAN_REQUIRED"}
                    label={img.quality.grade.replaceAll("_", " ")}
                  />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  focus {img.quality.blur.toFixed(2)} · glare {img.quality.glare.toFixed(2)} · contrast{" "}
                  {img.quality.contrast.toFixed(2)} · {img.quality.resolution}
                  {img.quality.issues.length > 0 ? ` · ${img.quality.issues.join("; ")}` : ""}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Preprocessing applied: {img.preprocessing.join(", ")}. Original evidence retained unmodified.
                </p>
              </li>
            ))}
          </ul>
          {blocked ? (
            <p className="px-4 pb-2 text-xs text-review-foreground">
              At least one panel is below the recognition threshold. Recapture it, or continue — the
              affected declarations will be reported as unverified rather than as violations.
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2 p-4">
            <Button variant="outline" onClick={() => setStep("capture")}>Back / recapture</Button>
            <Button disabled={busy} onClick={() => void runRealExtraction()}>
              {busy ? "Reading label with OCR…" : "Read label and extract declarations"}
            </Button>
          </div>
        </Panel>
      ) : null}

      {step === "extract" && fields && classification ? (
        <div className="space-y-4">
          <Panel>
            <PanelHeader
              title="Package classification"
              subtitle="Proposed from the photographs. Correct it before the rules are applied — applicability depends on it."
              {...(useDemo ? { action: <DemoBadge /> } : {})}
            />
            <div className="grid gap-3 p-4 sm:grid-cols-2">
              <Field label="Product category">
                <select className={inputClass()} value={classification.product_category} onChange={(e) => setClassification({ ...classification, product_category: e.target.value as ProductCategoryId })}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c.replaceAll("_", " ")}</option>)}
                </select>
              </Field>
              <Field label="Package type">
                <select className={inputClass()} value={classification.package_type} onChange={(e) => setClassification({ ...classification, package_type: e.target.value as PackageTypeId })}>
                  {PACKAGE_TYPES.map((c) => <option key={c} value={c}>{c.replaceAll("_", " ")}</option>)}
                </select>
              </Field>
              <Field label="Transaction context">
                <select className={inputClass()} value={classification.transaction_context} onChange={(e) => setClassification({ ...classification, transaction_context: e.target.value as TransactionContextId })}>
                  {CONTEXTS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Origin">
                <select className={inputClass()} value={classification.origin} onChange={(e) => setClassification({ ...classification, origin: e.target.value as OriginContextId })}>
                  {ORIGINS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
            </div>
          </Panel>

          <Panel>
            <PanelHeader
              title="Extracted declarations"
              subtitle="Read from your photographs. Edit any value before validation — every modification is audited against the OCR value."
              {...(useDemo ? { action: <DemoBadge /> } : {})}
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
                        Inspector-modified · OCR value was {f.value ?? "NOT_DETECTED"} · {new Date(f.editedAt!).toLocaleTimeString()}
                      </p>
                    ) : null}
                    {f.note ? <p className="mt-1 text-[11px] text-muted-foreground">{f.note}</p> : null}
                  </li>
                );
              })}
            </ul>
            {observations.length > 0 ? (
              <div className="border-t border-border px-4 py-3">
                <p className="text-xs font-medium">Reader observations (not legal conclusions)</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[11px] text-muted-foreground">
                  {observations.map((o) => <li key={o}>{o}</li>)}
                </ul>
              </div>
            ) : null}
            <div className="flex gap-2 p-4">
              <Button variant="outline" onClick={() => setStep(useDemo ? "capture" : "quality")}>Back</Button>
              <Button disabled={busy} onClick={() => void finalise()}>
                {busy ? "Applying rules…" : "Apply rules and produce result"}
              </Button>
            </div>
          </Panel>
        </div>
      ) : null}
    </div>
  );
}
