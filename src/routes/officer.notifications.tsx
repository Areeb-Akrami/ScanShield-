import { Button, Panel, PanelHeader } from "@/components/ui";
import { listMyNotifications, markNotificationRead, type NotificationRow } from "@/lib/consumer";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/officer/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — ScanShield" },
      { name: "description", content: "Alerts and departmental notices addressed to this enforcement officer account." },
      { property: "og:title", content: "Notifications — ScanShield" },
      { property: "og:description", content: "Alerts and departmental notices for this account." },
    ],
  }),
  component: OfficerNotifications,
});

function OfficerNotifications() {
  const [rows, setRows] = useState<NotificationRow[] | null>(null);

  const load = () => void listMyNotifications().then(setRows);
  useEffect(load, []);

  async function read(id: string) {
    await markNotificationRead(id);
    load();
  }

  return (
    <Panel>
      <PanelHeader title="Notifications" subtitle="Notices sent to your account." />
      {!rows ? (
        <p className="p-4 text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">You have no notifications.</p>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((n) => (
            <li key={n.id} className="flex items-start justify-between gap-3 px-4 py-3">
              <span className="min-w-0">
                <span className="block text-sm font-medium">
                  {n.title ?? "Notice"} {n.read ? null : <span className="ml-1 text-xs text-primary">• new</span>}
                </span>
                {n.message ? <span className="block text-xs text-muted-foreground">{n.message}</span> : null}
                <span className="block text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString()}</span>
              </span>
              {n.read ? null : (
                <Button variant="outline" size="sm" onClick={() => void read(n.id)}>
                  Mark read
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
