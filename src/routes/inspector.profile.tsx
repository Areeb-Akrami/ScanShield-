import { useSession } from "@/components/AppShell";
import { Button, Panel, PanelHeader, Stat } from "@/components/ui";
import { signOut } from "@/lib/auth";
import { listAudit, listInspections } from "@/lib/store";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/inspector/profile")({
  head: () => ({
    meta: [
      { title: "Inspector profile — ScanShield" },
      { name: "description", content: "Inspector identity, jurisdiction, personal inspection statistics and recent audit activity." },
      { property: "og:title", content: "Inspector profile — ScanShield" },
      { property: "og:description", content: "Identity, jurisdiction and recent audited activity." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const session = useSession();
  const navigate = useNavigate();
  const [mine, setMine] = useState(0);
  const [recent, setRecent] = useState<ReturnType<typeof listAudit>>([]);

  useEffect(() => {
    const s = session?.email;
    setMine(listInspections().filter((i) => i.inspectorId === s).length);
    setRecent(listAudit().filter((a) => a.user === s).slice(0, 12));
  }, [session?.email]);

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeader title="Officer details" />
        <dl className="divide-y divide-border text-sm">
          {[
            ["Name", session?.name],
            ["Official email", session?.email],
            ["Role", session?.role.replaceAll("_", " ")],
            ["Jurisdiction", session?.district],
            ["Session expires", session ? new Date(session.expiresAt).toLocaleString() : "—"],
          ].map(([k, v]) => (
            <div key={String(k)} className="flex justify-between gap-4 px-4 py-2.5">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="text-right font-medium">{v ?? "—"}</dd>
            </div>
          ))}
        </dl>
      </Panel>

      <div className="grid grid-cols-2 gap-3">
        <Stat label="My inspections" value={mine} />
        <Stat label="My audit events" value={recent.length} hint="most recent 12" />
      </div>

      <Panel>
        <PanelHeader title="My recent activity" subtitle="Immutable audit entries recorded for this account." />
        {recent.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No activity recorded yet.</p>
        ) : (
          <ul className="divide-y divide-border text-xs">
            {recent.map((a) => (
              <li key={a.id} className="px-4 py-2.5">
                <span className="font-medium">{a.action.replaceAll("_", " ").toLowerCase()}</span>{" "}
                <span className="text-muted-foreground">
                  · {a.entity} {a.entityId} · {new Date(a.timestamp).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Button
        variant="outline"
        onClick={() => {
          signOut();
          navigate({ to: "/" });
        }}
      >
        Sign out
      </Button>
    </div>
  );
}
