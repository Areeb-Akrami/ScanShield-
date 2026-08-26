import { CorpusBanner } from "@/components/CorpusBanner";
import { Panel, PanelHeader, Stat, StatusPill } from "@/components/ui";
import { corpusStatistics } from "@/legal/corpus";
import { listInspections, sellerProfiles, type Inspection } from "@/lib/store";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "Enforcement overview — ScanShield" },
      { name: "description", content: "District-level compliance analytics, violation categories, corpus status and inspection locations for enforcement officers." },
      { property: "og:title", content: "Enforcement overview — ScanShield" },
      { property: "og:description", content: "Compliance analytics, violation trends and inspection geography." },
    ],
  }),
  component: AdminOverview,
});

function AdminOverview() {
  const [all, setAll] = useState<Inspection[]>([]);
  useEffect(() => setAll(listInspections()), []);

  const stats = useMemo(() => corpusStatistics(new Date().toISOString().slice(0, 10)), []);
  const total = all.length;
  const nonCompliant = all.filter((i) => i.finalStatus === "NON_COMPLIANT").length;
  const rate = total === 0 ? 0 : Math.round(((total - nonCompliant) / total) * 100);

  const byDistrict = useMemo(() => {
    const m = new Map<string, { total: number; bad: number }>();
    for (const i of all) {
      const row = m.get(i.district) ?? { total: 0, bad: 0 };
      row.total += 1;
      if (i.finalStatus === "NON_COMPLIANT") row.bad += 1;
      m.set(i.district, row);
    }
    return [...m.entries()].sort((a, b) => b[1].bad - a[1].bad);
  }, [all]);

  const byRule = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of all) {
      if (i.finalStatus !== "NON_COMPLIANT") continue;
      for (const f of i.fields) void f;
    }
    for (const i of all) {
      for (const finding of i.findings) m.set(finding.kind, (m.get(finding.kind) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [all]);

  const geo = all.filter((i) => i.geo.status === "CAPTURED");

  return (
    <div className="space-y-4">
      <CorpusBanner compact />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Inspections" value={total} />
        <Stat label="Compliance rate" value={`${rate}%`} tone={rate >= 80 ? "pass" : "review"} />
        <Stat label="Non-compliant" value={nonCompliant} tone="fail" />
        <Stat label="Provisions in force" value={stats.current} hint={`${stats.future} future · ${stats.superseded} superseded`} />
      </div>

      <Panel>
        <PanelHeader title="Legal corpus status" subtitle="Ingestion coverage of the official source documents." />
        <div className="grid grid-cols-2 gap-px border-t border-border bg-border sm:grid-cols-4">
          {[
            ["Sources expected", stats.sourcesExpected],
            ["Sources ingested", stats.sourcesIngested],
            ["Rule records", stats.totalRules],
            ["Exemptions", stats.exemptions],
          ].map(([k, v]) => (
            <div key={String(k)} className="bg-card px-3 py-3 text-center">
              <p className="text-xl font-semibold tabular-nums">{v}</p>
              <p className="label-caps mt-0.5">{k}</p>
            </div>
          ))}
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="District breakdown" />
        {byDistrict.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No inspection data yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {byDistrict.map(([district, row]) => (
              <li key={district} className="px-4 py-3">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium">{district}</span>
                  <span className="text-xs text-muted-foreground">
                    {row.bad}/{row.total} non-compliant
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 w-full rounded-full bg-muted">
                  <div
                    className="h-1.5 rounded-full bg-fail"
                    style={{ width: `${row.total === 0 ? 0 : (row.bad / row.total) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel>
        <PanelHeader title="AI finding categories" subtitle="Observation volumes, not confirmed contraventions." />
        {byRule.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No findings recorded.</p>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {byRule.map(([kind, count]) => (
              <li key={kind} className="flex items-center justify-between px-4 py-2.5">
                <span>{kind.replaceAll("_", " ").toLowerCase()}</span>
                <span className="font-semibold tabular-nums">{count}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel>
        <PanelHeader title="Inspection locations" subtitle="Only coordinates actually captured on a device are listed." />
        {geo.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No geo-tagged inspections recorded.</p>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {geo.map((i) => (
              <li key={i.localId} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                <span className="min-w-0 truncate">
                  {i.seller} <span className="text-muted-foreground">· {i.productName}</span>
                </span>
                <span className="flex items-center gap-2">
                  <StatusPill token={i.finalStatus} />
                  <a
                    className="font-mono text-[11px] text-accent underline underline-offset-2"
                    href={`https://www.openstreetmap.org/?mlat=${i.geo.latitude}&mlon=${i.geo.longitude}#map=16/${i.geo.latitude}/${i.geo.longitude}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {i.geo.latitude}, {i.geo.longitude}
                  </a>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel>
        <PanelHeader title="Seller risk register" />
        <ul className="divide-y divide-border">
          {sellerProfiles().length === 0 ? (
            <li className="px-4 py-3 text-sm text-muted-foreground">No sellers on record.</li>
          ) : (
            sellerProfiles().map((s) => (
              <li key={s.name} className="px-4 py-3">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium">{s.name}</span>
                  <StatusPill token={s.risk} label={`${s.risk.toLowerCase()} risk`} />
                </div>
                <ul className="mt-1 list-disc pl-4 text-xs text-muted-foreground">
                  {s.reasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </li>
            ))
          )}
        </ul>
      </Panel>
    </div>
  );
}
