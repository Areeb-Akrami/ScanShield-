import { RequireRole } from "@/components/AppShell";
import { Button, Field, Panel, PanelHeader, inputClass } from "@/components/ui";
import { listOwnNotifications, markNotificationRead, sendNotifications } from "@/lib/db";
import { listUsersByRole, type ManagedUser } from "@/lib/admin-users";
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";

export const Route = createFileRoute("/admin/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — ScanShield" },
      { name: "description", content: "Send notices to inspectors, enforcement officers or consumers, and read notices addressed to your own account." },
      { property: "og:title", content: "Notifications — ScanShield" },
      { property: "og:description", content: "Administrator notices to staff and consumers." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NotificationsPage,
});

type Audience = "inspector" | "enforcement_officer" | "consumer" | "all_staff";

const AUDIENCE_ROLES: Record<Audience, string[]> = {
  inspector: ["inspector"],
  enforcement_officer: ["enforcement_officer"],
  consumer: ["consumer"],
  all_staff: ["inspector", "enforcement_officer", "admin"],
};

function NotificationsPage() {
  const [mine, setMine] = useState<Awaited<ReturnType<typeof listOwnNotifications>>>([]);
  const [audience, setAudience] = useState<Audience>("inspector");
  const [recipients, setRecipients] = useState<ManagedUser[]>([]);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    void listOwnNotifications().then(setMine);
  }, []);
  useEffect(load, [load]);

  useEffect(() => {
    void listUsersByRole(AUDIENCE_ROLES[audience]).then(setRecipients);
  }, [audience]);

  const active = useMemo(() => recipients.filter((r) => r.account_status === "active"), [recipients]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatus(null);
    const res = await sendNotifications(active.map((r) => r.id), title.trim(), message.trim());
    setBusy(false);
    if (res.error) {
      setStatus(res.error);
      return;
    }
    setStatus(`Sent to ${res.sent} account(s).`);
    setTitle("");
    setMessage("");
    load();
  }

  return (
    <RequireRole allowed={["ADMIN"]}>
      <div className="space-y-4">
        {status ? <p className="rounded-md border border-border bg-card px-4 py-2.5 text-xs">{status}</p> : null}

        <Panel>
          <PanelHeader title="Send a notice" subtitle="Only active accounts receive the notice." />
          <form onSubmit={send} className="space-y-3 p-4">
            <Field label="Audience">
              <select value={audience} onChange={(e) => setAudience(e.target.value as Audience)} className={inputClass()}>
                <option value="inspector">Inspectors</option>
                <option value="enforcement_officer">Enforcement officers</option>
                <option value="all_staff">All staff</option>
                <option value="consumer">Consumers</option>
              </select>
            </Field>
            <p className="text-xs text-muted-foreground">{active.length} active recipient(s).</p>
            <Field label="Title">
              <input required value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass()} />
            </Field>
            <Field label="Message">
              <textarea required rows={3} value={message} onChange={(e) => setMessage(e.target.value)} className={inputClass()} />
            </Field>
            <Button type="submit" disabled={busy || active.length === 0}>
              {busy ? "Sending…" : "Send notice"}
            </Button>
          </form>
        </Panel>

        <Panel>
          <PanelHeader title="Your notifications" subtitle="Notices addressed to your own account." />
          {mine.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">You have no notifications.</p>
          ) : (
            <ul className="divide-y divide-border">
              {mine.map((n) => (
                <li key={n.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className={`text-sm ${n.read ? "text-muted-foreground" : "font-semibold"}`}>{n.title}</span>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {new Date(n.created_at).toLocaleString()}
                    </span>
                  </div>
                  {n.message ? <p className="mt-1 text-xs text-muted-foreground">{n.message}</p> : null}
                  {!n.read ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2"
                      onClick={() => void markNotificationRead(n.id).then(load)}
                    >
                      Mark as read
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </RequireRole>
  );
}
