import { CameraCapture } from "@/components/CameraCapture";
import { ConsumerResult } from "@/components/ConsumerResult";
import { fileToDataUrl, makeThumbnail, preprocessImage } from "@/lib/imaging";
import { mapVisionClassification, mapVisionFields, productNameOf } from "@/lib/ocr-mapping";
import { saveConsumerCheck, type ConsumerCheckPayload } from "@/lib/consumer";
import { runPipeline } from "@/lib/store";
import { extractPackageFields } from "@/lib/vision.functions";
import type { CapturedImage } from "@/pipeline/types";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Camera, Check, Loader2, RefreshCw, ScanLine, Upload } from "lucide-react";
import { useRef, useState } from "react";

export const Route = createFileRoute("/consumer/")({
  head: () => ({
    meta: [
      { title: "Check your packaged product — ScanShield" },
      {
        name: "description",
        content:
          "Upload or photograph a package and ScanShield reads the printed declarations and compares them with the applicable Legal Metrology requirements.",
      },
      { property: "og:title", content: "Check your packaged product — ScanShield" },
      { property: "og:description", content: "Photograph a pack and see whether the required declarations are there." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ConsumerHome,
});

const ACCEPTED = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const MAX_BYTES = 12 * 1024 * 1024;

type Stage = 0 | 1 | 2 | 3 | 4;

const STEPS = [
  "Reading package declarations",
  "Extracting visible information",
  "Checking applicable requirements",
  "Preparing your result",
];

function ConsumerHome() {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [capture, setCapture] = useState<CapturedImage | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [stage, setStage] = useState<Stage>(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<
    { payload: ConsumerCheckPayload; status: string; confidence: number } | null
  >(null);

  async function accept(dataUrl: string) {
    setPreparing(true);
    setError(null);
    try {
      setCapture(await preprocessImage("front", "Package label", dataUrl));
      setResult(null);
    } catch {
      setError("That image could not be processed on this device. Please try another photo.");
    } finally {
      setPreparing(false);
    }
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (!ACCEPTED.includes(file.type)) {
      setError("Please choose a JPG, PNG or WebP image.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("That image is larger than 12 MB. Please choose a smaller photo.");
      return;
    }
    await accept(await fileToDataUrl(file));
    if (fileRef.current) fileRef.current.value = "";
  }

  async function scan() {
    if (!capture) return;
    setError(null);
    setStage(1);
    try {
      const source = capture.processed ?? capture.original!;
      setStage(2);
      const extraction = await extractPackageFields({
        data: { images: [{ key: "front", label: "Package label", dataUrl: source }] },
      });

      setStage(3);
      const fields = mapVisionFields(extraction, new Set(["front"]));
      const classification = mapVisionClassification(extraction);
      const output = runPipeline(classification, fields, [capture], null);
      const productName = productNameOf(fields);

      setStage(4);
      const payload: Omit<ConsumerCheckPayload, "v" | "imagePath"> = {
        productName,
        classification,
        fields,
        results: output.results.map((r) => ({
          rule_id: r.rule.rule_id,
          title: r.rule.title,
          outcome: r.outcome,
          summary: r.rule.working_summary ?? null,
          reason: r.reason ?? null,
        })),
        observations: extraction.observations,
        imageThumb: await makeThumbnail(source),
      };

      const id = await saveConsumerCheck({
        productName,
        status: output.finalStatus,
        confidence: output.confidence,
        payload,
        imageDataUrl: source,
      });

      if (id) {
        navigate({ to: "/consumer/check/$id", params: { id } });
        return;
      }
      // Saved copy unavailable (e.g. session expired) — still show the real result.
      setResult({ payload: { v: 1, ...payload, imagePath: null }, status: output.finalStatus, confidence: output.confidence });
      setStage(0);
    } catch (e) {
      setStage(0);
      setError(
        e instanceof Error && e.message
          ? `The package could not be analysed: ${e.message}`
          : "The package could not be analysed. Please check your connection and try again.",
      );
    }
  }

  if (result) {
    return (
      <div className="space-y-4">
        <ConsumerResult payload={result.payload} status={result.status} confidence={result.confidence} />
        <button
          onClick={() => {
            setResult(null);
            setCapture(null);
          }}
          className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold"
        >
          Check another package
        </button>
      </div>
    );
  }

  if (stage > 0) {
    return (
      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h1 className="text-lg font-bold">Analysing package…</h1>
        <ol className="mt-4 space-y-3">
          {STEPS.map((label, i) => {
            const index = i + 1;
            const done = stage > index;
            const active = stage === index;
            return (
              <li key={label} className="flex items-center gap-3 text-sm">
                <span
                  className={`inline-flex h-6 w-6 items-center justify-center rounded-full border ${
                    done
                      ? "border-pass/40 bg-pass/10 text-pass"
                      : active
                        ? "border-accent bg-accent/10 text-accent"
                        : "border-border text-muted-foreground"
                  }`}
                >
                  {done ? <Check className="h-3.5 w-3.5" /> : active ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : index}
                </span>
                <span className={done || active ? "text-foreground" : "text-muted-foreground"}>{label}</span>
              </li>
            );
          })}
        </ol>
      </section>
    );
  }

  return (
    <div className="space-y-5">
      {cameraOpen ? (
        <CameraCapture
          onClose={() => setCameraOpen(false)}
          onCapture={(dataUrl) => {
            setCameraOpen(false);
            void accept(dataUrl);
          }}
        />
      ) : null}

      <header className="rounded-2xl border border-border bg-gradient-to-b from-accent/10 to-card p-6 shadow-sm">
        <p className="text-xs font-semibold tracking-widest text-accent uppercase">Consumer self-check</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">Check your packaged product</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Upload or capture a package image and ScanShield will analyse the visible declarations and compare them with
          the applicable Legal Metrology requirements.
        </p>
      </header>

      {error ? (
        <p role="alert" className="rounded-xl border border-fail/40 bg-fail/10 px-4 py-3 text-sm text-fail">
          {error}
        </p>
      ) : null}

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => void onFile(e.target.files?.[0])}
      />

      {capture ? (
        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <img
            src={capture.processed ?? capture.original ?? ""}
            alt="Package you are about to check"
            className="w-full rounded-xl object-contain"
          />
          <p className="mt-2 text-xs text-muted-foreground">
            {capture.quality.resolution} · image quality {capture.quality.grade.replaceAll("_", " ").toLowerCase()}
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <button
              onClick={() => setCapture(null)}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-semibold"
            >
              <RefreshCw className="h-4 w-4" /> Change image
            </button>
            <button
              onClick={() => void scan()}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-foreground"
            >
              <ScanLine className="h-4 w-4" /> Scan package
            </button>
          </div>
        </section>
      ) : (
        <section className="grid gap-3 sm:grid-cols-2">
          <button
            disabled={preparing}
            onClick={() => fileRef.current?.click()}
            className="flex min-h-32 flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-card p-6 text-sm font-semibold shadow-sm transition hover:border-accent disabled:opacity-60"
          >
            <Upload className="h-6 w-6 text-accent" />
            {preparing ? "Preparing image…" : "Upload package"}
            <span className="text-xs font-normal text-muted-foreground">JPG, PNG or WebP · up to 12 MB</span>
          </button>
          <button
            disabled={preparing}
            onClick={() => setCameraOpen(true)}
            className="flex min-h-32 flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-card p-6 text-sm font-semibold shadow-sm transition hover:border-accent disabled:opacity-60"
          >
            <Camera className="h-6 w-6 text-accent" />
            Scan with camera
            <span className="text-xs font-normal text-muted-foreground">Uses your device camera</span>
          </button>
        </section>
      )}

      <p className="text-center text-xs text-muted-foreground">
        Your checks are private to your account.{" "}
        <Link to="/consumer/checks" className="underline underline-offset-2">
          See my past checks
        </Link>
      </p>
      <p className="text-center text-[11px] text-muted-foreground/70">Hackathon demo environment</p>
    </div>
  );
}
