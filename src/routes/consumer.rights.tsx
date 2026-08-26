import { CorpusBanner } from "@/components/CorpusBanner";
import { Panel, PanelHeader } from "@/components/ui";
import { RULES } from "@/legal/corpus";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/consumer/rights")({
  head: () => ({
    meta: [
      { title: "Your rights on packaged goods — ScanShield" },
      { name: "description", content: "What a packaged commodity must declare, explained in plain language for shoppers." },
      { property: "og:title", content: "Your rights on packaged goods — ScanShield" },
      { property: "og:description", content: "Plain-language guide to mandatory declarations on retail packages." },
    ],
  }),
  component: RightsPage,
});

function RightsPage() {
  const retail = RULES.filter(
    (r) => r.applicability.package_types.includes("RETAIL") || r.applicability.package_types.includes("*"),
  );

  return (
    <div className="space-y-4">
      <CorpusBanner compact />
      <Panel>
        <PanelHeader
          title="What a retail package should tell you"
          subtitle="Descriptions below are working summaries. Exact legal wording is shown only once the official text is loaded."
        />
        <ul className="divide-y divide-border">
          {retail.map((r) => (
            <li key={r.rule_id} className="px-4 py-3">
              <p className="text-sm font-medium">{r.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{r.working_summary}</p>
              {r.exact_requirement === null ? (
                <p className="mt-1 text-[11px] text-review-foreground">
                  Statutory wording not yet ingested — treat as guidance only.
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      </Panel>
      <Panel>
        <PanelHeader title="If something looks wrong" />
        <ol className="list-decimal space-y-1.5 px-8 py-4 text-sm">
          <li>Photograph the whole pack, including the panel with the price and dates.</li>
          <li>Keep the pack and the receipt — they are the evidence.</li>
          <li>Raise a complaint from the Complaints tab with the shop name and location.</li>
          <li>An officer verifies the pack physically before any action is taken against a seller.</li>
        </ol>
      </Panel>
    </div>
  );
}
