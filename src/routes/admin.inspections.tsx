import { Button, Panel, PanelHeader, StatusPill, inputClass } from "@/components/ui";
import type { FinalStatus } from "@/legal/engine";
import { getSession } from "@/lib/auth";
import { evaluateStored, listInspections, overrideFinalStatus, type Inspection } from "@/lib/store";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

export const Route = createFileRoute("/admin/inspections")({
  head: () => ({
    meta: [
      { title: "Inspection review — ScanShield" },
      { name: "description", content: "Review submitted inspections, inspect the evidence and rule outcomes, and record an enforcement decision such as passing a flagged package." },
      { property: "og:title", content: "Inspection review — ScanShield" },
      { property: "og:description", content: "Review inspections and record enforcement decisions." },
    ],
  }),
  component: AdminInspections,
});

const DECISIONS: Array<{ value: FinalStatus; label: string; variant: "primary" | "danger" | "outline" }> = [
  { value: "COMPLIANT", label: "Pass — mark compliant", variant: "primary" },
  { value: "NON_COMPLIANT", label: "Mark non-compliant", variant: "danger" },
  { value: "MANUAL_REVIEW_REQUIRED", label: "Send back for review", variant: "outline" },
];

function AdminInspections() {
  const [all, setAll] = useState<Inspection[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<"ALL" | FinalStatus>("ALL");
  const user = getSession()?.name ?? "Unknown officer";

  useEffect(() => setAll(listInspections()), []);

  const rows = useMemo(
    () => (filter === "ALL" ? all : all.filter((i) => i.finalStatus === filter)),
    [all, filter],
  );

  function decide(id: string, status: FinalStatus | null) {
    overrideFinalStatus(id, status, notes[id]?.trim() ?? "", user);
    setAll(listInspections());
  }

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeader
          title="Inspection review"
          subtitle="Open any record to see the evidence and rule outcomes, then record an enforcement decision. Overrides never delete the rule-engine result."
        />
        <div className="flex flex-wrap gap-2 p-4">
          {(["ALL", "NON_COMPLIANT", "MANUAL_REVIEW_REQUIRED", "COMPLIANT"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full border px-3 py-1 text-xs font-medium ${
                filter === f ? "border-accent bg-accent/15 text-accent" : "border-border text-muted-foreground"
              }`}
            >
              {f === "ALL" ? "All" : f.replaceAll("_", " ").toLowerCase()}
            </button>
          ))}
        </div>
      </Panel>

      {rows.length === 0 ? (
        <Panel className="p-4 text-sm text-muted-foreground">No inspections match this filter.</Panel>
      ) : (
        rows.map((i) => {
          const open = openId === i.localId;
          return (
            <Panel key={i.localId}>
              <PanelHeader
                title={i.productName || "Untitled package"}
                subtitle={`${i.seller} · ${i.district} · ${new Date(i.createdAt).toLocaleString()} · ${i.inspectorName}`}
                action={
                  <span className="flex items-center gap-2">
                    <StatusPill token={i.finalStatus} />
                    <Button size="sm" variant="outline" onClick={() => setOpenId(open ? null : i.localId)}>
                      {open ? "Close" : "View"}
                    </Button>
                  </span>
                }
              />

              {i.overrideStatus ? (
                <p className="border-b border-border bg-muted/40 px-4 py-2 text-xs text-muted-foreground">
                  Overridden to <strong>{i.overrideStatus.replaceAll("_", " ").toLowerCase()}</strong> by {i.overrideBy}
                  {i.overrideAt ? ` on ${new Date(i.overrideAt).toLocaleString()}` : ""}. Rule engine said{" "}
                  {(i.systemStatus ?? i.finalStatus).replaceAll("_", " ").toLowerCase()}.
                  {i.overrideNote ? ` Note: ${i.overrideNote}` : ""}
                </p>
              ) : null}

              {open ? <Detail inspection={i} /> : null}

              <div className="space-y-2 border-t border-border p-4">
                <input
                  className={inputClass()}
                  placeholder="Decision note (recorded in the audit trail)"
                  value={notes[i.localId] ?? ""}
                  onChange={(e) => setNotes((n) => ({ ...n, [i.localId]: e.target.value }))}
                  aria-label={`Decision note for ${i.productName}`}
                />
                <div className="flex flex-wrap gap-2">
                  {DECISIONS.map((d) => (
                    <Button
                      key={d.value}
                      size="sm"
                      variant={d.variant}
                      disabled={i.finalStatus === d.value && !!i.overrideStatus}
                      onClick={() => decide(i.localId, d.value)}
                    >
                      {d.label}
                    </Button>
                  ))}
                  {i.overrideStatus ? (
                    <Button size="sm" variant="ghost" onClick={() => decide(i.localId, null)}>
                      Clear override
                    </Button>
                  ) : null}
                </div>
              </div>
            </Panel>
          );
        })
      )}
    </div>
  );
}

function Detail({ inspection }: { inspection: Inspection }) {
  const output = useMemo(() => evaluateStored(inspection), [inspection]);
  const problems = output.results.filter(
    (r) => r.outcome === "FAIL" || r.outcome === "MANUAL_REVIEW_REQUIRED" || r.outcome === "RESCAN_REQUIRED",
  );
  const images = inspection.images.filter((im) => im.processed ?? im.original);

  return (
    <div className="space-y-4 border-t border-border p-4">
      {images.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {images.map((im) => (
            <img
              key={im.key}
              src={(im.processed ?? im.original) as string}
              alt={`${im.label} panel of ${inspection.productName}`}
              className="h-24 w-24 rounded-md border border-border object-cover"
              loading="lazy"
            />
          ))}
        </div>
      ) : null}

      <div>
        <p className="label-caps">Declared values read from the package</p>
        <ul className="mt-1 divide-y divide-border text-sm">
          {inspection.fields.map((f) => (
            <li key={f.field} className="flex items-center justify-between gap-3 py-1.5">
              <span className="text-muted-foreground">{f.label}</span>
              <span className="text-right font-medium">
                {f.inspectorValue ?? f.value ?? <span className="text-muted-foreground">not readable</span>}
              </span>
            </li>
          ))}
          {inspection.fields.length === 0 ? (
            <li className="py-1.5 text-muted-foreground">No extracted fields on this record.</li>
          ) : null}
        </ul>
      </div>

      <div>
        <p className="label-caps">Rule outcomes needing attention</p>
        {problems.length === 0 ? (
          <p className="mt-1 text-sm text-muted-foreground">All applicable checks passed.</p>
        ) : (
          <ul className="mt-1 space-y-1.5 text-sm">
            {problems.map((r) => (
              <li key={r.ruleId} className="rounded-md border border-border p-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{r.title}</span>
                  <StatusPill token={r.outcome} />
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{r.reason}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
