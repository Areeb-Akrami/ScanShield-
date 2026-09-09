import type { ConsumerCheckPayload } from "@/lib/consumer";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Eye,
  HelpCircle,
  ImageOff,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { useState } from "react";

/** Plain-language wording for the rule-engine outcomes. Nothing is re-decided here. */
const OUTCOME_TEXT: Record<string, { label: string; tone: "good" | "warn" | "bad" | "muted" }> = {
  PASS: { label: "Present on the pack", tone: "good" },
  FAIL: { label: "Problem found", tone: "bad" },
  MANUAL_REVIEW_REQUIRED: { label: "Needs a closer look", tone: "warn" },
  RESCAN_REQUIRED: { label: "Photo not clear enough", tone: "warn" },
  INSUFFICIENT_EVIDENCE: { label: "Not visible in the photo", tone: "muted" },
};

const OVERALL: Record<string, { label: string; tone: "good" | "warn" | "bad"; blurb: string }> = {
  COMPLIANT: {
    label: "Compliant",
    tone: "good",
    blurb: "Every declaration we could read on this pack was present.",
  },
  NON_COMPLIANT: {
    label: "Potential non-compliance",
    tone: "bad",
    blurb: "One or more required declarations appear to be missing or incorrect on this pack.",
  },
  MANUAL_REVIEW_REQUIRED: {
    label: "Needs review",
    tone: "warn",
    blurb:
      "Some package information could not be clearly verified from the image. Consider taking a clearer photo or checking the package by hand.",
  },
  PARTIALLY_VERIFIED: {
    label: "Needs review",
    tone: "warn",
    blurb: "Part of the label was verified. The rest could not be confirmed from this photo.",
  },
  RESCAN_REQUIRED: {
    label: "Needs review",
    tone: "warn",
    blurb:
      "The photo was not clear enough to read the label. Please take a clearer photo — this does not mean anything is wrong with the pack.",
  },
  INSUFFICIENT_EVIDENCE: {
    label: "Needs review",
    tone: "warn",
    blurb: "There was not enough visible information in the photo to complete the check.",
  },
};

const toneRing: Record<string, string> = {
  good: "border-pass/40 bg-pass/10 text-pass",
  warn: "border-review/50 bg-review/15 text-review-foreground",
  bad: "border-fail/40 bg-fail/10 text-fail",
  muted: "border-border bg-muted text-muted-foreground",
};

/** Declarations a shopper actually cares about, in reading order. */
const CONSUMER_FIELDS: Array<{ key: string; label: string }> = [
  { key: "product_name", label: "Product / generic name" },
  { key: "net_quantity", label: "Net quantity" },
  { key: "mrp", label: "Maximum retail price" },
  { key: "manufacturer_name", label: "Manufacturer / packer" },
  { key: "manufacturer_address", label: "Address" },
  { key: "manufacturing_date", label: "Date of manufacture / packing" },
  { key: "best_before", label: "Best before / use by" },
  { key: "consumer_care_phone", label: "Consumer care" },
  { key: "country_of_origin", label: "Country of origin" },
];

function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <section className={cn("rounded-2xl border border-border bg-card p-5 shadow-sm", className)}>{children}</section>
  );
}

export function ConsumerResult({
  payload,
  status,
  confidence,
  createdAt,
  imageUrl,
}: {
  payload: ConsumerCheckPayload;
  status: string;
  confidence: number | null;
  createdAt?: string;
  imageUrl?: string | null;
}) {
  const [showEvidence, setShowEvidence] = useState(false);
  const overall = OVERALL[status] ?? OVERALL["MANUAL_REVIEW_REQUIRED"]!;
  const results = (payload.results ?? []).filter((r) => r.outcome !== "NOT_APPLICABLE");
  const fields = payload.fields ?? [];
  const image = imageUrl ?? payload.imageThumb ?? null;

  const detected = (key: string) => fields.find((f) => f.field === key);

  return (
    <div className="space-y-4">
      <Card className={cn("border-2", toneRing[overall.tone])}>
        <div className="flex items-start gap-3">
          <span className="mt-0.5">
            {overall.tone === "good" ? (
              <CheckCircle2 className="h-7 w-7" />
            ) : overall.tone === "bad" ? (
              <XCircle className="h-7 w-7" />
            ) : (
              <AlertTriangle className="h-7 w-7" />
            )}
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-wide uppercase opacity-80">Result</p>
            <h2 className="truncate text-xl font-bold">{overall.label}</h2>
            <p className="mt-1 text-sm font-medium break-words text-foreground">{payload.productName}</p>
            <p className="mt-2 text-sm text-foreground/80">{overall.blurb}</p>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              {confidence !== null && confidence !== undefined ? (
                <span>Reading quality {Math.round(confidence * 100)}%</span>
              ) : null}
              {createdAt ? <span>{new Date(createdAt).toLocaleString()}</span> : null}
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <h3 className="text-sm font-semibold">What we found on the pack</h3>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {CONSUMER_FIELDS.map(({ key, label }) => {
            const f = detected(key);
            const value = f?.inspectorValue ?? f?.value ?? null;
            const state = !f
              ? "none"
              : f.unreadable
                ? "unreadable"
                : value
                  ? "found"
                  : "none";
            return (
              <li key={key} className="rounded-xl border border-border bg-surface/60 px-3 py-2.5">
                <div className="flex items-start gap-2">
                  {state === "found" ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-pass" />
                  ) : state === "unreadable" ? (
                    <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-review-foreground" />
                  ) : (
                    <ImageOff className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
                    <p className="text-sm break-words">
                      {state === "found"
                        ? value
                        : state === "unreadable"
                          ? "Not clearly readable in the photo"
                          : "Not detected in the photo"}
                    </p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">
          A declaration that could not be read is not treated as missing — it simply could not be confirmed from this
          photograph.
        </p>
      </Card>

      <Card>
        <h3 className="text-sm font-semibold">Requirements we checked</h3>
        <ul className="mt-3 space-y-2">
          {results.map((r) => {
            const o = OUTCOME_TEXT[r.outcome] ?? OUTCOME_TEXT["MANUAL_REVIEW_REQUIRED"]!;
            return (
              <li key={r.rule_id} className="rounded-xl border border-border px-3 py-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium">{r.title}</span>
                  <span
                    className={cn(
                      "rounded-full border px-2.5 py-0.5 text-[11px] font-semibold",
                      toneRing[o.tone],
                    )}
                  >
                    {o.label}
                  </span>
                </div>
                {r.summary ? <p className="mt-1 text-xs text-muted-foreground">{r.summary}</p> : null}
              </li>
            );
          })}
        </ul>
        <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
          This is guidance for shoppers, not a legal ruling. Only an authorised Legal Metrology officer can decide a
          contravention.
        </p>
      </Card>

      {image ? (
        <Card>
          <button
            type="button"
            onClick={() => setShowEvidence((v) => !v)}
            className="flex w-full items-center justify-between gap-2 text-sm font-semibold"
          >
            <span className="inline-flex items-center gap-2">
              <Eye className="h-4 w-4" /> View the package photo
            </span>
            <ChevronDown className={cn("h-4 w-4 transition-transform", showEvidence && "rotate-180")} />
          </button>
          {showEvidence ? (
            <img src={image} alt="Package photograph you submitted" className="mt-3 w-full rounded-xl object-contain" />
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}
