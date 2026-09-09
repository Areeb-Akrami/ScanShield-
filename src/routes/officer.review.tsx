import { Panel, PanelHeader, StatusPill, inputClass } from "@/components/ui";
import { listCases, statusToken, type CaseRow } from "@/lib/officer";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

export const Route = createFileRoute("/officer/review")({
  head: () => ({
    meta: [
      { title: "Review queue — ScanShield" },
      { name: "description", content: "Filterable queue of packaged-commodity inspections awaiting an enforcement decision." },
      { property: "og:title", content: "Review queue — ScanShield" },
      { property: "og:description", content: "Inspections awaiting an enforcement decision." },
    ],
  }),
  component: ReviewQueue,
});

const STATUSES = ["all", "pending", "manual_review", "rescan_required", "non_compliant", "compliant"] as const;

function ReviewQueue() {
  const [cases, setCases] = useState<CaseRow[] | null>(null);
  const [status, setStatus] = useState<string>("pending");
  const [risk, setRisk] = useState<string>("all");
  const [q, setQ] = useState("");

  useEffect(() => {
    void listCases().then(setCases);
  }, []);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (cases ?? []).filter((c) => {
      if (status !== "all" && c.status !== status) return false;
      if (risk !== "all" && c.risk !== risk) return false;
      if (!term) return true;
      return [c.product_name, c.seller_name, c.district, c.local_id].some((v) => (v ?? "").toLowerCase().includes(term));
    });
  }, [cases, status, risk, q]);

  return (
    <div className="space-y-4">
      <Panel className="p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <input
            className={inputClass()}
            placeholder="Search product, seller, district…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select className={inputClass()} value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s === "all" ? "All statuses" : s.replaceAll("_", " ")}
              </option>
            ))}
          </select>
          <select className={inputClass()} value={risk} onChange={(e) => setRisk(e.target.value)}>
            <option value="all">All risk levels</option>
            <option value="HIGH">High risk</option>
            <option value="MEDIUM">Medium risk</option>
            <option value="LOW">Low risk</option>
          </select>
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Review queue" subtitle={`${rows.length} case${rows.length === 1 ? "" : "s"} shown`} />
        {!cases ? (
          <p className="p-4 text-sm text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No cases match these filters.</p>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((c) => (
              <li key={c.id}>
                <Link to="/officer/cases/$id" params={{ id: c.id }} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{c.product_name ?? "Unnamed product"}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {c.seller_name ?? "Unknown seller"} · {c.district ?? "—"} ·{" "}
                      {new Date(c.inspection_date).toLocaleDateString()} · {c.violations} violation
                      {c.violations === 1 ? "" : "s"}
                      {c.reviewItems > 0 ? ` · ${c.reviewItems} to review` : ""}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <StatusPill token={c.risk} label={`${c.risk.toLowerCase()} risk`} />
                    <StatusPill token={statusToken(c.status)} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
