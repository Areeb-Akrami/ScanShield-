import { Panel, PanelHeader, StatusPill } from "@/components/ui";
import { listInspections, type Inspection } from "@/lib/store";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/inspector/reports/")({
  head: () => ({
    meta: [
      { title: "Reports — ScanShield" },
      { name: "description", content: "Generate printable compliance and violation reports from recorded inspections." },
      { property: "og:title", content: "Reports — ScanShield" },
      { property: "og:description", content: "Printable, evidence-linked compliance reports." },
    ],
  }),
  component: ReportsIndex,
});

function ReportsIndex() {
  const [all, setAll] = useState<Inspection[]>([]);
  useEffect(() => setAll(listInspections()), []);

  return (
    <Panel>
      <PanelHeader title="Reports" subtitle="Select an inspection to produce a printable report." />
      {all.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">No inspections available yet.</p>
      ) : (
        <ul className="divide-y divide-border">
          {all.map((i) => (
            <li key={i.localId}>
              <Link
                to="/inspector/reports/$id"
                params={{ id: i.localId }}
                className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{i.productName}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {i.seller} · {new Date(i.createdAt).toLocaleDateString()}
                  </span>
                </span>
                <StatusPill token={i.finalStatus} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
