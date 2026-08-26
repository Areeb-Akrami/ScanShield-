import { Panel, PanelHeader, StatusPill, inputClass } from "@/components/ui";
import { listInspections, type Inspection } from "@/lib/store";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

export const Route = createFileRoute("/inspector/inspections/")({
  head: () => ({
    meta: [
      { title: "Inspection history — ScanShield" },
      { name: "description", content: "Search and filter recorded packaged commodity inspections by status, seller and product." },
      { property: "og:title", content: "Inspection history — ScanShield" },
      { property: "og:description", content: "All recorded inspections with rule-engine outcomes and sync state." },
    ],
  }),
  component: InspectionList,
});

const FILTERS = ["ALL", "COMPLIANT", "NON_COMPLIANT", "MANUAL_REVIEW_REQUIRED", "RESCAN_REQUIRED", "NOT_APPLICABLE"] as const;

function InspectionList() {
  const [all, setAll] = useState<Inspection[]>([]);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("ALL");

  useEffect(() => setAll(listInspections()), []);

  const rows = useMemo(
    () =>
      all.filter((i) => {
        const matchesFilter = filter === "ALL" || i.finalStatus === filter;
        const needle = q.trim().toLowerCase();
        const matchesQuery =
          needle === "" ||
          i.productName.toLowerCase().includes(needle) ||
          i.seller.toLowerCase().includes(needle) ||
          i.localId.toLowerCase().includes(needle);
        return matchesFilter && matchesQuery;
      }),
    [all, q, filter],
  );

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeader title="Inspection history" subtitle={`${all.length} record(s) stored on this device.`} />
        <div className="space-y-3 p-4">
          <input
            className={inputClass()}
            placeholder="Search product, seller or reference"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search inspections"
          />
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                  filter === f ? "border-accent bg-accent/10" : "border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                {f === "ALL" ? "All" : f.replaceAll("_", " ").toLowerCase()}
              </button>
            ))}
          </div>
        </div>
      </Panel>

      <Panel>
        {rows.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No inspections match this filter.</p>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((i) => (
              <li key={i.localId}>
                <Link
                  to="/inspector/inspections/$id"
                  params={{ id: i.localId }}
                  className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{i.productName}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {i.seller} · {i.district} · {new Date(i.createdAt).toLocaleString()}
                    </span>
                    <span className="mt-1 block font-mono text-[11px] text-muted-foreground">
                      {i.serverId ?? i.localId} · {i.syncStatus.replaceAll("_", " ").toLowerCase()}
                    </span>
                  </span>
                  <StatusPill token={i.finalStatus} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
