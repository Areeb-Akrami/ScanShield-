import { RequireRole } from "@/components/AppShell";
import { Panel, PanelHeader, Stat } from "@/components/ui";
import { fetchAdminAnalytics, type AdminAnalytics } from "@/lib/db";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/admin/analytics")({
  head: () => ({
    meta: [
      { title: "Compliance analytics — ScanShield" },
      { name: "description", content: "Enforcement analytics drawn from stored inspections, rule checks, consumer checks and complaints." },
      { property: "og:title", content: "Compliance analytics — ScanShield" },
      { property: "og:description", content: "Inspection outcomes, district hotspots and the most frequently contravened provisions." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AnalyticsPage,
});

const STATUS_LABEL: Record<string, string> = {
  compliant: "Compliant",
  non_compliant: "Non-compliant",
  manual_review: "Manual review",
  rescan_required: "Rescan required",
  partially_verified: "Partially verified",
  insufficient_evidence: "Insufficient evidence",
  pending: "Pending",
};

function AnalyticsPage() {
  const [a, setA] = useState<AdminAnalytics | null>(null);

  useEffect(() => {
    void fetchAdminAnalytics().then(setA);
  }, []);

  if (!a) return <Panel className="p-4 text-sm text-muted-foreground">Loading analytics…</Panel>;

  const compliant = a.byStatus.find(([s]) => s === "compliant")?.[1] ?? 0;
  const rate = a.inspections === 0 ? 0 : Math.round((compliant / a.inspections) * 100);

  return (
    <RequireRole allowed={["ADMIN"]}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Inspections" value={a.inspections} />
          <Stat label="Compliance rate" value={`${rate}%`} tone={rate >= 80 ? "pass" : "review"} />
          <Stat label="Consumer checks" value={a.consumerChecks} />
          <Stat label="Open complaints" value={a.openComplaints} tone={a.openComplaints > 0 ? "fail" : "pass"} />
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Staff accounts" value={a.staff} />
          <Stat label="Customer accounts" value={a.customers} />
          <Stat label="Complaints total" value={a.complaints} />
          <Stat label="Districts covered" value={a.byDistrict.length} />
        </div>

        <Panel>
          <PanelHeader title="Inspection outcomes" subtitle="Counts recorded in the central database." />
          {a.byStatus.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No inspections recorded yet.</p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {a.byStatus.map(([status, count]) => (
                <li key={status} className="flex items-center justify-between px-4 py-2.5">
                  <span>{STATUS_LABEL[status] ?? status}</span>
                  <span className="font-semibold tabular-nums">{count}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel>
          <PanelHeader title="District hotspots" />
          {a.byDistrict.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No district data yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {a.byDistrict.map(([district, row]) => (
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
          <PanelHeader title="Most frequently failed provisions" subtitle="Recorded rule-check failures, by rule identifier." />
          {a.topFailedRules.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No failed rule checks recorded.</p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {a.topFailedRules.map(([key, count]) => (
                <li key={key} className="flex items-center justify-between px-4 py-2.5">
                  <span className="font-mono text-xs">{key}</span>
                  <span className="font-semibold tabular-nums">{count}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </RequireRole>
  );
}
