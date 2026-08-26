import { useSession } from "@/components/AppShell";
import { CorpusBanner } from "@/components/CorpusBanner";
import { Button, Panel, PanelHeader, Stat, StatusPill } from "@/components/ui";
import { listInspections, processSyncQueue, sellerProfiles, type Inspection } from "@/lib/store";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/inspector/")({
  head: () => ({
    meta: [
      { title: "Inspector dashboard — ScanShield" },
      { name: "description", content: "Today's inspections, pending reviews, sync state and high-risk sellers for the field inspector." },
      { property: "og:title", content: "Inspector dashboard — ScanShield" },
      { property: "og:description", content: "Field inspection workload, sync queue and seller risk at a glance." },
    ],
  }),
  component: InspectorHome,
});

function InspectorHome() {
  const session = useSession();
  const navigate = useNavigate();
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  useEffect(() => setInspections(listInspections()), []);

  const today = new Date().toISOString().slice(0, 10);
  const todays = inspections.filter((i) => i.createdAt.slice(0, 10) === today);
  const nonCompliant = inspections.filter((i) => i.finalStatus === "NON_COMPLIANT").length;
  const review = inspections.filter((i) => i.finalStatus === "MANUAL_REVIEW_REQUIRED").length;
  const pendingSync = inspections.filter((i) => i.syncStatus !== "SYNCED").length;
  const highRisk = sellerProfiles().filter((s) => s.risk === "HIGH");

  return (
    <div className="space-y-5">
      <CorpusBanner compact />

      <section className="panel overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <p className="label-caps">Signed in</p>
            <p className="mt-0.5 text-lg font-semibold">{session?.name ?? "—"}</p>
            <p className="text-xs text-muted-foreground">
              {session?.role.replaceAll("_", " ")} · {session?.district} district
            </p>
          </div>
          <Button size="lg" onClick={() => navigate({ to: "/inspector/scan" })}>
            Quick start inspection
          </Button>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Today" value={todays.length} hint="inspections created" />
        <Stat label="Non-compliant" value={nonCompliant} tone="fail" hint="rule-engine failures" />
        <Stat label="Manual review" value={review} tone="review" hint="awaiting decision" />
        <Stat label="Unsynced" value={pendingSync} hint="held locally" />
      </div>

      <Panel>
        <PanelHeader
          title="Sync queue"
          subtitle="Inspections are written locally first and never discarded on failure."
          action={
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const moved = processSyncQueue(session?.email ?? "unknown");
                setInspections(listInspections());
                setSyncMsg(
                  moved > 0
                    ? `${moved} inspection(s) synced to the central repository.`
                    : navigator.onLine
                      ? "Nothing queued for sync."
                      : "Device is offline — records stay queued and will retry.",
                );
              }}
            >
              Sync now
            </Button>
          }
        />
        <div className="p-4 text-sm">
          {pendingSync === 0 ? (
            <p className="text-muted-foreground">All local inspections are synced.</p>
          ) : (
            <ul className="space-y-2">
              {inspections
                .filter((i) => i.syncStatus !== "SYNCED")
                .map((i) => (
                  <li key={i.localId} className="flex items-center justify-between gap-3">
                    <span className="truncate">
                      {i.productName} <span className="text-muted-foreground">· {i.seller}</span>
                    </span>
                    <StatusPill token="MANUAL_REVIEW_REQUIRED" label={i.syncStatus.replaceAll("_", " ")} />
                  </li>
                ))}
            </ul>
          )}
          {syncMsg ? <p className="mt-3 text-xs text-muted-foreground">{syncMsg}</p> : null}
        </div>
      </Panel>

      <Panel>
        <PanelHeader
          title="Recent inspections"
          action={
            <Link to="/inspector/inspections" className="text-xs font-medium text-accent underline underline-offset-2">
              View all
            </Link>
          }
        />
        {inspections.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">
            No inspections yet. Start one from the Scan tab.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {inspections.slice(0, 5).map((i) => (
              <li key={i.localId}>
                <Link
                  to="/inspector/inspections/$id"
                  params={{ id: i.localId }}
                  className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{i.productName}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {i.seller} · {new Date(i.createdAt).toLocaleString()}
                    </span>
                  </span>
                  <StatusPill token={i.finalStatus} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel>
        <PanelHeader title="High-risk sellers" subtitle="Scored from recorded inspection outcomes, with reasons." />
        {highRisk.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No seller currently scores HIGH.</p>
        ) : (
          <ul className="divide-y divide-border">
            {highRisk.map((s) => (
              <li key={s.name} className="px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium">{s.name}</span>
                  <StatusPill token="HIGH" label="High risk" />
                </div>
                <ul className="mt-1.5 list-disc pl-4 text-xs text-muted-foreground">
                  {s.reasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
