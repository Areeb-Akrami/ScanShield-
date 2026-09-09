import { Panel, PanelHeader, StatusPill, inputClass } from "@/components/ui";
import { listSellers, type SellerRow } from "@/lib/officer";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

export const Route = createFileRoute("/officer/sellers")({
  head: () => ({
    meta: [
      { title: "Sellers — ScanShield" },
      { name: "description", content: "Registered sellers ranked by risk score, inspection volume and confirmed packaging violations." },
      { property: "og:title", content: "Sellers — ScanShield" },
      { property: "og:description", content: "Seller risk scores, inspection volume and violations." },
    ],
  }),
  component: OfficerSellers,
});

function riskToken(score: number): string {
  if (score >= 60) return "HIGH";
  if (score >= 30) return "MEDIUM";
  return "LOW";
}

function OfficerSellers() {
  const [rows, setRows] = useState<SellerRow[] | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    void listSellers().then(setRows);
  }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows ?? [];
    return (rows ?? []).filter((s) => [s.name, s.district, s.state].some((v) => (v ?? "").toLowerCase().includes(term)));
  }, [rows, q]);

  return (
    <div className="space-y-4">
      <Panel className="p-4">
        <input className={inputClass()} placeholder="Search sellers or districts…" value={q} onChange={(e) => setQ(e.target.value)} />
      </Panel>

      <Panel>
        <PanelHeader title="Registered sellers" subtitle="Ranked by recorded risk score." />
        {!rows ? (
          <p className="p-4 text-sm text-muted-foreground">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No sellers recorded yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{s.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {s.district ?? "—"}
                    {s.state ? `, ${s.state}` : ""} · {s.inspections} inspection{s.inspections === 1 ? "" : "s"} · {s.nonCompliant} violation
                    {s.nonCompliant === 1 ? "" : "s"}
                    {s.lastInspection ? ` · last ${new Date(s.lastInspection).toLocaleDateString()}` : ""}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <StatusPill token={riskToken(Number(s.risk_score))} label={`risk ${Math.round(Number(s.risk_score))}`} />
                  <span className="text-xs text-muted-foreground">{s.status}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
