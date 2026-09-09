import { Panel, PanelHeader, Stat } from "@/components/ui";
import { fetchOfficerAnalytics, prettyStatus, type OfficerAnalytics } from "@/lib/officer";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/officer/analytics")({
  head: () => ({
    meta: [
      { title: "Enforcement analytics — ScanShield" },
      { name: "description", content: "Violation trends by district, month and rule, plus decision throughput for enforcement planning." },
      { property: "og:title", content: "Enforcement analytics — ScanShield" },
      { property: "og:description", content: "Violation trends by district, month and rule." },
    ],
  }),
  component: OfficerAnalyticsPage,
});

function Bar({ label, value, max, hint }: { label: string; value: number; max: number; hint?: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <li className="px-4 py-2.5">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="min-w-0 truncate">{label}</span>
        <span className="tabular-nums font-medium">{value}</span>
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </li>
  );
}

function OfficerAnalyticsPage() {
  const [a, setA] = useState<OfficerAnalytics | null>(null);
  useEffect(() => {
    void fetchOfficerAnalytics().then(setA);
  }, []);

  if (!a) return <p className="p-4 text-sm text-muted-foreground">Loading analytics…</p>;

  const nonCompliant = a.byStatus.find(([s]) => s === "non_compliant")?.[1] ?? 0;
  const maxDistrict = Math.max(1, ...a.byDistrict.map(([, d]) => d.total));
  const maxMonth = Math.max(1, ...a.byMonth.map(([, m]) => m.total));
  const maxRule = Math.max(1, ...a.topRules.map(([, n]) => n));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Inspections" value={a.total} />
        <Stat label="Violations" value={nonCompliant} tone="fail" />
        <Stat label="Open backlog" value={a.backlog} tone="review" />
        <Stat label="High-risk sellers" value={a.highRiskSellers} tone="fail" hint="risk score 60+" />
      </div>

      <Panel>
        <PanelHeader title="Districts by violation load" />
        {a.byDistrict.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No district data yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {a.byDistrict.map(([name, d]) => (
              <Bar key={name} label={name} value={d.total} max={maxDistrict} hint={`${d.bad} non-compliant`} />
            ))}
          </ul>
        )}
      </Panel>

      <Panel>
        <PanelHeader title="Monthly inspection trend" subtitle="Last 12 months with activity." />
        {a.byMonth.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No trend data yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {a.byMonth.map(([month, m]) => (
              <Bar key={month} label={month} value={m.total} max={maxMonth} hint={`${m.bad} non-compliant`} />
            ))}
          </ul>
        )}
      </Panel>

      <Panel>
        <PanelHeader title="Most-failed provisions" />
        {a.topRules.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No failed rule checks recorded.</p>
        ) : (
          <ul className="divide-y divide-border">
            {a.topRules.map(([key, n]) => (
              <Bar key={key} label={key} value={n} max={maxRule} />
            ))}
          </ul>
        )}
      </Panel>

      <Panel>
        <PanelHeader title="Decision throughput" />
        {a.decisions.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No decisions recorded yet.</p>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {a.decisions.map(([d, n]) => (
              <li key={d} className="flex justify-between px-4 py-2.5">
                <span className="text-muted-foreground">{prettyStatus(d)}</span>
                <span className="font-medium tabular-nums">{n}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
