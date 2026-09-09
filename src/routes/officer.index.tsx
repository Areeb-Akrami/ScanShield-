import { Panel, PanelHeader, Stat, StatusPill } from "@/components/ui";
import { listCases, listRecentDecisions, prettyStatus, statusToken, type CaseRow, type OfficerDecisionFeedItem } from "@/lib/officer";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/officer/")({
  head: () => ({
    meta: [
      { title: "Enforcement dashboard — ScanShield" },
      { name: "description", content: "Pending compliance reviews, violation load and recent enforcement decisions across the jurisdiction." },
      { property: "og:title", content: "Enforcement dashboard — ScanShield" },
      { property: "og:description", content: "Review load, violations and recent enforcement decisions." },
    ],
  }),
  component: OfficerDashboard,
});

function OfficerDashboard() {
  const [cases, setCases] = useState<CaseRow[] | null>(null);
  const [feed, setFeed] = useState<OfficerDecisionFeedItem[]>([]);

  useEffect(() => {
    void listCases().then(setCases);
    void listRecentDecisions(8).then(setFeed);
  }, []);

  if (!cases) return <p className="p-4 text-sm text-muted-foreground">Loading case load…</p>;

  const pending = cases.filter((c) => ["pending", "manual_review", "rescan_required"].includes(c.status));
  const violations = cases.filter((c) => c.status === "non_compliant");
  const highRisk = cases.filter((c) => c.risk === "HIGH");
  const priority = [...pending].sort((a, b) => b.violations - a.violations).slice(0, 8);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Awaiting review" value={pending.length} tone="review" hint="pending, manual review or rescan" />
        <Stat label="Confirmed violations" value={violations.length} tone="fail" />
        <Stat label="High-risk cases" value={highRisk.length} tone="fail" />
        <Stat label="Total cases" value={cases.length} />
      </div>

      <Panel>
        <PanelHeader title="Priority review queue" subtitle="Highest violation count first." />
        {priority.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">Nothing is waiting for a decision.</p>
        ) : (
          <ul className="divide-y divide-border">
            {priority.map((c) => (
              <li key={c.id}>
                <Link to="/officer/cases/$id" params={{ id: c.id }} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{c.product_name ?? "Unnamed product"}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {c.seller_name ?? "Unknown seller"} · {c.district ?? "—"} · {c.violations} violation{c.violations === 1 ? "" : "s"}
                    </span>
                  </span>
                  <StatusPill token={statusToken(c.status)} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel>
        <PanelHeader title="Recent enforcement decisions" subtitle="Recorded by officers on this jurisdiction's cases." />
        {feed.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No decisions recorded yet.</p>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {feed.map((d) => (
              <li key={d.id} className="px-4 py-2.5">
                <Link to="/officer/cases/$id" params={{ id: d.inspection_id }} className="font-medium hover:underline">
                  {d.product ?? "Case"}
                </Link>{" "}
                <span className="text-muted-foreground">
                  · {prettyStatus(d.decision)} · {d.officer ?? "officer"} · {new Date(d.created_at).toLocaleString()}
                </span>
                {d.note ? <p className="mt-1 text-xs text-muted-foreground">{d.note}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
