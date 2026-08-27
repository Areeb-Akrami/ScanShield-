import { useSession } from "@/components/AppShell";
import { CorpusBanner } from "@/components/CorpusBanner";
import { RuleEvidence } from "@/components/RuleEvidence";
import { Button, DemoBadge, Panel, PanelHeader, StatusPill, inputClass } from "@/components/ui";
import { sourceTitle } from "@/legal/corpus";
import type { RuleCheckResult } from "@/legal/types";
import {
  audit,
  evaluateStored,
  getInspection,
  queueForSync,
  saveInspection,
  type Inspection,
  type InspectorDecision,
} from "@/lib/store";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

export const Route = createFileRoute("/inspector/inspections/$id")({
  head: () => ({
    meta: [
      { title: "Inspection result — ScanShield" },
      { name: "description", content: "Rule-by-rule compliance result, AI findings, evidence and inspector decision for a single package inspection." },
      { property: "og:title", content: "Inspection result — ScanShield" },
      { property: "og:description", content: "Legal checks, AI observations and the audited inspector decision." },
    ],
  }),
  component: InspectionDetail,
});

function InspectionDetail() {
  const { id } = useParams({ from: "/inspector/inspections/$id" });
  const session = useSession();
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState<string | null>(null);
  const [openRule, setOpenRule] = useState<string | null>(null);

  useEffect(() => {
    const found = getInspection(id) ?? null;
    setInspection(found);
    setNote(found?.decisionNote ?? "");
  }, [id]);

  // While OCR is still queued (captured offline), pick up the result as soon as it lands.
  const pendingOcr = inspection?.extractionStatus === "PENDING_OCR";
  useEffect(() => {
    if (!pendingOcr) return;
    const timer = window.setInterval(() => {
      const latest = getInspection(id);
      if (latest && latest.extractionStatus !== "PENDING_OCR") setInspection(latest);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [pendingOcr, id]);

  const output = useMemo(() => (inspection ? evaluateStored(inspection) : null), [inspection]);

  if (!inspection || !output) {
    return (
      <Panel className="p-6 text-sm">
        <p>This inspection is not stored on this device.</p>
        <Link to="/inspector/inspections" className="mt-2 inline-block text-accent underline underline-offset-2">
          Back to inspection history
        </Link>
      </Panel>
    );
  }

  function decide(decision: InspectorDecision) {
    if (!inspection) return;
    const before = inspection.inspectorDecision;
    const updated: Inspection = {
      ...inspection,
      inspectorDecision: decision,
      decisionNote: note,
      updatedAt: new Date().toISOString(),
    };
    saveInspection(updated);
    audit({
      user: session?.email ?? "unknown",
      action: `DECISION_${decision}`,
      entity: "Inspection",
      entityId: updated.localId,
      before: before ?? "(none)",
      after: `${decision}${note ? ` — ${note}` : ""}`,
    });
    queueForSync(updated.localId, session?.email ?? "unknown");
    setInspection(getInspection(updated.localId) ?? updated);
    setSaved(`Decision recorded: ${decision.replaceAll("_", " ").toLowerCase()}.`);
  }

  const groups: Array<[string, RuleCheckResult[]]> = [
    ["Failed legal checks", output.results.filter((r) => r.outcome === "FAIL")],
    ["Manual review required", output.results.filter((r) => r.outcome === "MANUAL_REVIEW_REQUIRED")],
    ["Rescan required", output.results.filter((r) => r.outcome === "RESCAN_REQUIRED")],
    ["Insufficient evidence", output.results.filter((r) => r.outcome === "INSUFFICIENT_EVIDENCE")],
    ["Passed", output.results.filter((r) => r.outcome === "PASS")],
  ];

  if (inspection.extractionStatus === "PENDING_OCR" || inspection.extractionStatus === "OCR_FAILED") {
    const failed = inspection.extractionStatus === "OCR_FAILED";
    return (
      <div className="space-y-4">
        <Panel>
          <PanelHeader
            title={failed ? "Queued scan could not be read yet" : "Captured offline — awaiting extraction"}
            subtitle="The evidence is stored safely on this device. No declarations or legal results are assumed until the label is actually read."
          />
          <div className="space-y-3 p-4 text-sm">
            <p className="text-xs text-muted-foreground">
              {inspection.seller} · {inspection.district} · {new Date(inspection.createdAt).toLocaleString()}
            </p>
            <p className="text-xs">
              {failed
                ? `Last attempt failed: ${inspection.extractionError ?? "unknown error"}. It stays queued and will be retried automatically.`
                : "OCR and the rule checks will run automatically as soon as connectivity returns, then this page updates itself."}
            </p>
            <ul className="grid gap-2 sm:grid-cols-3">
              {inspection.images.map((img, i) => (
                <li key={i} className="rounded border border-border p-2">
                  <img src={img.processed ?? img.original ?? ""} alt={`${img.label} evidence`} className="aspect-video w-full rounded object-cover" />
                  <p className="mt-1 text-[11px] text-muted-foreground">{img.label}</p>
                </li>
              ))}
            </ul>
            <Link to="/inspector/inspections" className="inline-block text-xs text-accent underline underline-offset-2">
              Back to inspection history
            </Link>
          </div>
        </Panel>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <CorpusBanner compact />


      <Panel>
        <div className="flex flex-wrap items-start justify-between gap-3 p-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-lg font-semibold">{inspection.productName}</h1>
              {inspection.isDemo ? <DemoBadge /> : null}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {inspection.seller} · {inspection.district} · {new Date(inspection.createdAt).toLocaleString()}
            </p>
            <p className="mt-1 font-mono text-[11px] text-muted-foreground">
              {inspection.serverId ?? inspection.localId} · inspector {inspection.inspectorName}
            </p>
          </div>
          <div className="text-right">
            <StatusPill token={output.finalStatus} />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Derived from {output.rulesInForce} provision(s) in force
            </p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-px border-t border-border bg-border text-center">
          {(["FAIL", "MANUAL_REVIEW_REQUIRED", "PASS"] as const).map((k) => (
            <div key={k} className="bg-card px-2 py-3">
              <p className="text-xl font-semibold tabular-nums">{output.tally[k]}</p>
              <p className="label-caps mt-0.5">{k.replaceAll("_", " ")}</p>
            </div>
          ))}
        </div>
        <p className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
          Extraction confidence {Math.round(output.confidence * 100)}% · imagery {output.readability.replaceAll("_", " ").toLowerCase()}.
          Confidence describes evidence quality only — the legal status above comes solely from the rule checks.
        </p>
      </Panel>

      <Panel>
        <PanelHeader title="Geo-tagged evidence" />
        <div className="p-4 text-sm">
          {inspection.geo.status === "CAPTURED" ? (
            <>
              <p className="font-mono text-xs">
                {inspection.geo.latitude}, {inspection.geo.longitude} · ±{inspection.geo.accuracy} m
              </p>
              <a
                className="mt-1 inline-block text-xs text-accent underline underline-offset-2"
                href={`https://www.openstreetmap.org/?mlat=${inspection.geo.latitude}&mlon=${inspection.geo.longitude}#map=17/${inspection.geo.latitude}/${inspection.geo.longitude}`}
                target="_blank"
                rel="noreferrer"
              >
                Open location on map
              </a>
            </>
          ) : (
            <p className="text-xs text-review-foreground">
              No coordinates recorded ({inspection.geo.status.replaceAll("_", " ").toLowerCase()}). Location is never
              inferred or fabricated.
            </p>
          )}
        </div>
      </Panel>

      {groups.map(([title, list]) =>
        list.length === 0 ? null : (
          <Panel key={title}>
            <PanelHeader title={`${title} (${list.length})`} />
            <ul className="divide-y divide-border">
              {list.map((r) => (
                <li key={r.rule.rule_id} className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => setOpenRule(openRule === r.rule.rule_id ? null : r.rule.rule_id)}
                    aria-expanded={openRule === r.rule.rule_id}
                    className="flex w-full flex-wrap items-center justify-between gap-2 text-left"
                  >
                    <span className="text-sm font-medium">{r.rule.title}</span>
                    <span className="flex items-center gap-2">
                      <StatusPill token={r.outcome} />
                      <span className="text-[11px] text-accent underline underline-offset-2">
                        {openRule === r.rule.rule_id ? "Hide evidence" : "View evidence"}
                      </span>
                    </span>
                  </button>
                  <p className="mt-1 text-xs text-muted-foreground">{r.reason}</p>
                  {openRule === r.rule.rule_id ? (
                    <RuleEvidence result={r} images={inspection.images} fields={inspection.fields} />
                  ) : null}
                  <dl className="mt-2 grid gap-1 text-[11px] text-muted-foreground sm:grid-cols-2">
                    <div>
                      <dt className="inline font-medium">Detected: </dt>
                      <dd className="inline font-mono">{r.detected ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="inline font-medium">Requirement: </dt>
                      <dd className="inline">{r.expected}</dd>
                    </div>
                    <div>
                      <dt className="inline font-medium">Source: </dt>
                      <dd className="inline">
                        {sourceTitle(r.rule.source_id)}
                        {r.rule.rule_number ? ` · rule ${r.rule.rule_number}` : " · rule number pending ingestion"}
                      </dd>
                    </div>
                    <div>
                      <dt className="inline font-medium">Provenance: </dt>
                      <dd className="inline">{r.rule.provenance.replaceAll("_", " ").toLowerCase()}</dd>
                    </div>
                  </dl>
                  {r.exemption ? (
                    <p className="mt-1.5 rounded bg-na/10 px-2 py-1.5 text-[11px]">
                      Exempt: {r.exemption.title} — {r.exemption.explanation}
                    </p>
                  ) : null}
                  {r.rule.exact_requirement === null ? (
                    <p className="mt-1.5 text-[11px] text-review-foreground">
                      Exact statutory wording is not loaded for this provision.
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </Panel>
        ),
      )}

      <Panel>
        <PanelHeader
          title="AI observations"
          subtitle="Anomalies and reference discrepancies. These are not legal determinations."
        />
        {output.findings.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No anomalies were raised by the analysis layer.</p>
        ) : (
          <ul className="divide-y divide-border">
            {output.findings.map((f) => (
              <li key={f.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium">{f.title}</span>
                  <StatusPill
                    token={f.disposition === "MANUAL_REVIEW_REQUIRED" ? "MANUAL_REVIEW_REQUIRED" : "NOT_APPLICABLE"}
                    label={f.kind.replaceAll("_", " ").toLowerCase()}
                  />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{f.detail}</p>
                {f.confidence !== null ? (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Model confidence {Math.round(f.confidence * 100)}% · evidence: {f.evidence.join(", ") || "—"}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel>
        <PanelHeader title="Extracted declarations" subtitle="Inspector edits are shown against the original AI value." />
        <ul className="divide-y divide-border">
          {inspection.fields.map((f) => (
            <li key={f.field} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-2.5">
              <span className="text-sm">{f.label}</span>
              <span className="text-right">
                <span className="block font-mono text-xs">
                  {(f.inspectorValue !== undefined ? f.inspectorValue : f.value) ?? "NOT_DETECTED"}
                </span>
                <span className="block text-[11px] text-muted-foreground">
                  {f.unreadable
                    ? "unreadable"
                    : f.confidence !== null
                      ? `${Math.round(f.confidence * 100)}% · ${f.ocrEngine}`
                      : "not attempted"}
                  {f.inspectorValue !== undefined ? " · inspector edited" : ""}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel>
        <PanelHeader title="Inspector decision" subtitle="Every decision is written to the audit trail and queued for sync." />
        <div className="space-y-3 p-4">
          <textarea
            className={inputClass("min-h-20")}
            placeholder="Observation note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            aria-label="Decision note"
          />
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => decide("CONFIRM")}>Confirm result</Button>
            <Button variant="outline" onClick={() => decide("REJECT")}>Reject AI finding</Button>
            <Button variant="outline" onClick={() => decide("REQUEST_RESCAN")}>Request rescan</Button>
            <Button variant="outline" onClick={() => decide("MARK_NOT_APPLICABLE")}>Mark not applicable</Button>
          </div>
          {inspection.inspectorDecision ? (
            <p className="text-xs text-muted-foreground">
              Current decision: <span className="font-medium">{inspection.inspectorDecision.replaceAll("_", " ").toLowerCase()}</span>
              {inspection.decisionNote ? ` — ${inspection.decisionNote}` : ""}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">No decision recorded yet.</p>
          )}
          {saved ? <p className="text-xs text-pass">{saved}</p> : null}
          <Link
            to="/inspector/reports/$id"
            params={{ id: inspection.localId }}
            className="inline-block text-xs text-accent underline underline-offset-2"
          >
            Open printable violation report
          </Link>
        </div>
      </Panel>
    </div>
  );
}
