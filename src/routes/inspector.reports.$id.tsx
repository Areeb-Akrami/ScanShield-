import { CorpusBanner } from "@/components/CorpusBanner";
import { Button, DemoBadge, Panel, StatusPill } from "@/components/ui";
import { sourceTitle } from "@/legal/corpus";
import { evaluateStored, getInspection, type Inspection } from "@/lib/store";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

export const Route = createFileRoute("/inspector/reports/$id")({
  head: () => ({
    meta: [
      { title: "Compliance report — ScanShield" },
      { name: "description", content: "Printable inspection report listing declarations, rule outcomes, evidence and the inspector's audited decision." },
      { property: "og:title", content: "Compliance report — ScanShield" },
      { property: "og:description", content: "Evidence-linked, printable packaged commodity compliance report." },
    ],
  }),
  component: ReportPage,
});

function ReportPage() {
  const { id } = useParams({ from: "/inspector/reports/$id" });
  const [inspection, setInspection] = useState<Inspection | null>(null);
  useEffect(() => setInspection(getInspection(id) ?? null), [id]);
  const output = useMemo(() => (inspection ? evaluateStored(inspection) : null), [inspection]);

  if (!inspection || !output) {
    return (
      <Panel className="p-6 text-sm">
        <p>Report unavailable — this inspection is not stored on this device.</p>
        <Link to="/inspector/reports" className="mt-2 inline-block text-accent underline underline-offset-2">
          Back to reports
        </Link>
      </Panel>
    );
  }

  const failed = output.results.filter((r) => r.outcome === "FAIL");
  const review = output.results.filter((r) => r.outcome === "MANUAL_REVIEW_REQUIRED");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-end gap-2 print:hidden">
        <Button variant="outline" onClick={() => window.print()}>Print / save as PDF</Button>
      </div>

      <div className="print:hidden">
        <CorpusBanner compact />
      </div>

      <article className="panel space-y-5 p-6 text-sm">
        <header className="border-b border-border pb-4">
          <p className="label-caps">Legal Metrology enforcement · packaged commodity inspection</p>
          <h1 className="mt-1 text-xl font-semibold">Compliance verification report</h1>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            Reference {inspection.serverId ?? inspection.localId} · generated {new Date().toLocaleString()}
          </p>
          {inspection.isDemo ? <DemoBadge className="mt-2" /> : null}
        </header>

        <section>
          <h2 className="label-caps">Particulars</h2>
          <dl className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-2">
            {[
              ["Product", inspection.productName],
              ["Seller / premises", inspection.seller],
              ["District", inspection.district],
              ["Inspector", `${inspection.inspectorName} (${inspection.inspectorId})`],
              ["Inspection date", inspection.classification.inspection_date],
              ["Category", inspection.classification.product_category.replaceAll("_", " ")],
              ["Package type", inspection.classification.package_type.replaceAll("_", " ")],
              ["Transaction context", inspection.classification.transaction_context],
              ["Origin", inspection.classification.origin],
              [
                "Location",
                inspection.geo.status === "CAPTURED"
                  ? `${inspection.geo.latitude}, ${inspection.geo.longitude} (±${inspection.geo.accuracy} m)`
                  : `not recorded (${inspection.geo.status.replaceAll("_", " ").toLowerCase()})`,
              ],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 border-b border-border/60 py-1">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="text-right font-medium">{v}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section>
          <h2 className="label-caps">Outcome</h2>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <StatusPill token={output.finalStatus} />
            <span className="text-xs text-muted-foreground">
              {output.tally.FAIL} failed · {output.tally.MANUAL_REVIEW_REQUIRED} for review · {output.tally.PASS} passed
            </span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            The outcome is derived exclusively from the applicable rule checks in force on the inspection date. AI
            confidence ({Math.round(output.confidence * 100)}%) describes evidence quality and does not determine legal
            status.
          </p>
        </section>

        <section>
          <h2 className="label-caps">Declarations recorded</h2>
          <table className="mt-2 w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="py-1.5 pr-2 font-medium">Declaration</th>
                <th className="py-1.5 pr-2 font-medium">Value</th>
                <th className="py-1.5 font-medium">Evidence</th>
              </tr>
            </thead>
            <tbody>
              {inspection.fields.map((f) => (
                <tr key={f.field} className="border-b border-border/60 align-top">
                  <td className="py-1.5 pr-2">{f.label}</td>
                  <td className="py-1.5 pr-2 font-mono">
                    {(f.inspectorValue !== undefined ? f.inspectorValue : f.value) ?? "NOT_DETECTED"}
                  </td>
                  <td className="py-1.5 text-muted-foreground">
                    {f.sourceImage ? `${f.sourceImage} panel` : "—"}
                    {f.unreadable ? " · unreadable region" : f.confidence !== null ? ` · ${Math.round(f.confidence * 100)}%` : ""}
                    {f.inspectorValue !== undefined ? " · inspector edited" : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section>
          <h2 className="label-caps">Contraventions recorded</h2>
          {failed.length === 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">No provision was found to be contravened.</p>
          ) : (
            <ol className="mt-2 list-decimal space-y-2 pl-5 text-xs">
              {failed.map((r) => (
                <li key={r.rule.rule_id}>
                  <span className="font-medium">{r.rule.title}</span> — {r.reason}
                  <span className="block text-muted-foreground">
                    {sourceTitle(r.rule.source_id)}
                    {r.rule.rule_number ? ` · rule ${r.rule.rule_number}` : " · rule number pending corpus ingestion"} ·
                    severity {r.rule.severity.toLowerCase()}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section>
          <h2 className="label-caps">Matters requiring human verification</h2>
          {review.length === 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">None.</p>
          ) : (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
              {review.map((r) => (
                <li key={r.rule.rule_id}>
                  <span className="font-medium">{r.rule.title}</span> — {r.reason}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="label-caps">Inspector decision</h2>
          <p className="mt-2 text-xs">
            {inspection.inspectorDecision
              ? `${inspection.inspectorDecision.replaceAll("_", " ")}${inspection.decisionNote ? ` — ${inspection.decisionNote}` : ""}`
              : "No decision has been recorded against this inspection."}
          </p>
        </section>

        <footer className="border-t border-border pt-3 text-[11px] text-muted-foreground">
          This report is machine-generated from captured evidence and the configured rule set. Where the exact statutory
          wording has not been ingested from official sources, the corresponding checks are structural only and must be
          confirmed by the authorised officer before any legal action.
        </footer>
      </article>
    </div>
  );
}
