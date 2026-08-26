import { Panel, PanelHeader, inputClass } from "@/components/ui";
import { listAudit, type AuditEntry } from "@/lib/store";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

export const Route = createFileRoute("/admin/audit")({
  head: () => ({
    meta: [
      { title: "Audit trail — ScanShield" },
      { name: "description", content: "Immutable log of logins, inspections, rule-engine runs, field edits and enforcement decisions." },
      { property: "og:title", content: "Audit trail — ScanShield" },
      { property: "og:description", content: "Every action recorded with actor, entity, before and after values." },
    ],
  }),
  component: AuditPage,
});

function AuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => setEntries(listAudit()), []);

  const rows = useMemo(() => {
    const n = q.trim().toLowerCase();
    return entries.filter(
      (e) =>
        n === "" ||
        e.action.toLowerCase().includes(n) ||
        e.user.toLowerCase().includes(n) ||
        e.entityId.toLowerCase().includes(n),
    );
  }, [entries, q]);

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeader title="Audit trail" subtitle={`${entries.length} entries. Records are appended, never edited.`} />
        <div className="p-4">
          <input
            className={inputClass()}
            placeholder="Filter by action, user or record id"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Filter audit entries"
          />
        </div>
      </Panel>

      <Panel>
        {rows.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No audit entries match.</p>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((e) => (
              <li key={e.id} className="px-4 py-3 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium">{e.action.replaceAll("_", " ").toLowerCase()}</span>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {new Date(e.timestamp).toLocaleString()}
                  </span>
                </div>
                <p className="mt-0.5 text-muted-foreground">
                  {e.user} · {e.entity} {e.entityId}
                </p>
                {e.before || e.after ? (
                  <p className="mt-1 font-mono text-[11px]">
                    <span className="text-muted-foreground">{e.before ?? "—"}</span> → <span>{e.after ?? "—"}</span>
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
