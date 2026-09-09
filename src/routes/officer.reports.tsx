import { Button, Panel, PanelHeader, StatusPill } from "@/components/ui";
import { listReports, openStored, statusToken, type ReportRow } from "@/lib/officer";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/officer/reports")({
  head: () => ({
    meta: [
      { title: "Compliance reports — ScanShield" },
      { name: "description", content: "Generated Legal Metrology compliance reports linked to their source inspections and stored securely." },
      { property: "og:title", content: "Compliance reports — ScanShield" },
      { property: "og:description", content: "Generated compliance reports and their source inspections." },
    ],
  }),
  component: OfficerReports,
});

function OfficerReports() {
  const [rows, setRows] = useState<ReportRow[] | null>(null);

  useEffect(() => {
    void listReports().then(setRows);
  }, []);

  async function open(row: ReportRow) {
    const url = await openStored("reports", row.report_url);
    if (url) window.open(url, "_blank", "noopener");
  }

  return (
    <Panel>
      <PanelHeader title="Compliance reports" subtitle="Reports generated from recorded inspections." />
      {!rows ? (
        <p className="p-4 text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">
          No reports have been generated yet. Reports appear here once an inspection report is produced and stored.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{r.report_number ?? r.id.slice(0, 8)}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {r.product ?? "—"} · {r.seller ?? "—"} · generated {new Date(r.generated_at).toLocaleString()}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                {r.result ? <StatusPill token={statusToken(r.result)} /> : null}
                {r.report_url ? (
                  <Button variant="outline" size="sm" onClick={() => void open(r)}>
                    Open
                  </Button>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
