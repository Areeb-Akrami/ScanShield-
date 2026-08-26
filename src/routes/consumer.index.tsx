import { CorpusBanner } from "@/components/CorpusBanner";
import { Button, DemoBadge, Field, Panel, PanelHeader, StatusPill, inputClass } from "@/components/ui";
import { runPipeline, type PipelineOutput } from "@/lib/store";
import { SCENARIOS, scenarioById } from "@/pipeline/scenarios";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/consumer/")({
  head: () => ({
    meta: [
      { title: "Check a package — ScanShield consumer" },
      { name: "description", content: "Consumers can check whether a packaged commodity carries the declarations required by law, in plain language." },
      { property: "og:title", content: "Check a package — ScanShield consumer" },
      { property: "og:description", content: "Plain-language declaration check for shoppers." },
    ],
  }),
  component: ConsumerCheck,
});

function ConsumerCheck() {
  const [scenarioId, setScenarioId] = useState(SCENARIOS[0].id);
  const [output, setOutput] = useState<PipelineOutput | null>(null);
  const scenario = scenarioById(scenarioId)!;

  function run() {
    setOutput(runPipeline(scenario.classification, scenario.fields, scenario.images, scenario.reference));
  }

  return (
    <div className="space-y-4">
      <CorpusBanner compact />

      <Panel>
        <PanelHeader
          title={<span className="inline-flex items-center gap-2">Check a package <DemoBadge /></span>}
          subtitle="Pick a sample package to see what a shopper would be told. Real capture uses the same rule engine."
        />
        <div className="space-y-3 p-4">
          <Field label="Sample package">
            <select className={inputClass()} value={scenarioId} onChange={(e) => { setScenarioId(e.target.value); setOutput(null); }}>
              {SCENARIOS.map((s) => (
                <option key={s.id} value={s.id}>{s.title}</option>
              ))}
            </select>
          </Field>
          <p className="text-xs text-muted-foreground">{scenario.blurb}</p>
          <Button onClick={run}>Check this package</Button>
        </div>
      </Panel>

      {output ? (
        <>
          <Panel>
            <div className="p-4">
              <StatusPill token={output.finalStatus} />
              <p className="mt-2 text-sm">
                {output.finalStatus === "COMPLIANT"
                  ? "Every declaration we could check was present on this pack."
                  : output.finalStatus === "NON_COMPLIANT"
                    ? "One or more required declarations are missing or incorrect on this pack."
                    : output.finalStatus === "RESCAN_REQUIRED"
                      ? "The photos were not clear enough to read the label. Please take clearer photos — this does not mean anything is wrong with the pack."
                      : "Some points need an officer to look at them. Nothing has been decided against the seller."}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                This is guidance for shoppers, not a legal ruling. Only an authorised Legal Metrology officer can decide
                a contravention.
              </p>
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="What we looked for" />
            <ul className="divide-y divide-border">
              {output.results
                .filter((r) => r.outcome !== "NOT_APPLICABLE")
                .map((r) => (
                  <li key={r.rule.rule_id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                    <span className="text-sm">{r.rule.title}</span>
                    <StatusPill
                      token={r.outcome}
                      label={
                        r.outcome === "PASS"
                          ? "Present"
                          : r.outcome === "FAIL"
                            ? "Problem found"
                            : r.outcome === "RESCAN_REQUIRED"
                              ? "Could not read"
                              : "Officer check needed"
                      }
                    />
                  </li>
                ))}
            </ul>
          </Panel>
        </>
      ) : null}
    </div>
  );
}
