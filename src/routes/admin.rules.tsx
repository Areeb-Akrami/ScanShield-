import { CorpusBanner } from "@/components/CorpusBanner";
import { Panel, PanelHeader, StatusPill, inputClass } from "@/components/ui";
import { EXEMPTIONS, RULES, SOURCE_DOCUMENTS, VERSION_CHAINS, corpusStatistics, sourceTitle } from "@/legal/corpus";
import { temporalStatus } from "@/legal/engine";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/admin/rules")({
  head: () => ({
    meta: [
      { title: "Rule catalogue — ScanShield" },
      { name: "description", content: "Browse the configured Legal Metrology rule records, amendment chains, exemptions and source-document ingestion status." },
      { property: "og:title", content: "Rule catalogue — ScanShield" },
      { property: "og:description", content: "Rule records, amendment chains, exemptions and corpus provenance." },
    ],
  }),
  component: RulesPage,
});

function RulesPage() {
  const [asOf, setAsOf] = useState(new Date().toISOString().slice(0, 10));
  const [q, setQ] = useState("");
  const stats = useMemo(() => corpusStatistics(asOf), [asOf]);

  const rows = RULES.filter((r) => {
    const n = q.trim().toLowerCase();
    return n === "" || r.title.toLowerCase().includes(n) || r.field.toLowerCase().includes(n) || r.rule_id.toLowerCase().includes(n);
  });

  return (
    <div className="space-y-4">
      <CorpusBanner />

      <Panel>
        <PanelHeader title="Effective-date simulation" subtitle="Change the date to see which provisions are in force, future or superseded." />
        <div className="grid gap-3 p-4 sm:grid-cols-2">
          <label className="block">
            <span className="label-caps">As-of date</span>
            <input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} className={inputClass("mt-1.5")} />
          </label>
          <label className="block">
            <span className="label-caps">Search</span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rule, field or id" className={inputClass("mt-1.5")} />
          </label>
        </div>
        <div className="grid grid-cols-3 gap-px border-t border-border bg-border text-center">
          {[["In force", stats.current], ["Not yet in force", stats.future], ["Superseded", stats.superseded]].map(([k, v]) => (
            <div key={String(k)} className="bg-card px-2 py-3">
              <p className="text-xl font-semibold tabular-nums">{v}</p>
              <p className="label-caps mt-0.5">{k}</p>
            </div>
          ))}
        </div>
      </Panel>

      <Panel>
        <PanelHeader title={`Rule records (${rows.length})`} />
        <ul className="divide-y divide-border">
          {rows.map((r) => {
            const status = temporalStatus(r, asOf);
            return (
              <li key={r.rule_id} className="px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium">{r.title}</span>
                  <span className="flex gap-1.5">
                    <StatusPill
                      token={status === "CURRENT" ? "PASS" : status === "FUTURE" ? "MANUAL_REVIEW_REQUIRED" : "NOT_APPLICABLE"}
                      label={status.toLowerCase()}
                    />
                    <StatusPill token={r.severity} label={`${r.severity.toLowerCase()} severity`} />
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{r.working_summary}</p>
                <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                  {r.rule_id} · {sourceTitle(r.source_id)} · in force {r.effective_from}
                  {r.effective_to ? ` → ${r.effective_to}` : " → open"} · {r.machine_checkability.replaceAll("_", " ").toLowerCase()}
                </p>
                <p className="mt-1 text-[11px] text-review-foreground">
                  {r.exact_requirement ?? "Exact statutory wording not ingested — provisional record."}
                </p>
              </li>
            );
          })}
        </ul>
      </Panel>

      <Panel>
        <PanelHeader title="Amendment chains" subtitle="Versions are retained; superseded text is never deleted." />
        <ul className="divide-y divide-border">
          {VERSION_CHAINS.map((c) => (
            <li key={c.chain_id} className="px-4 py-3">
              <p className="text-sm font-medium">{c.title}</p>
              <ol className="mt-1.5 space-y-1 text-xs text-muted-foreground">
                {c.entries.map((e) => (
                  <li key={`${e.rule_id}-${e.version}`}>
                    v{e.version} · {e.rule_id} · {e.effective_from} → {e.effective_to ?? "open"} · {e.amendment_action.toLowerCase()}
                    {e.note ? ` — ${e.note}` : ""}
                  </li>
                ))}
              </ol>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel>
        <PanelHeader title="Exemptions" subtitle="An exemption resolves to NOT APPLICABLE — never to a pass." />
        <ul className="divide-y divide-border">
          {EXEMPTIONS.map((e) => (
            <li key={e.exemption_id} className="px-4 py-3">
              <p className="text-sm font-medium">{e.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{e.explanation}</p>
              <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                {e.exemption_id} · from {e.effective_from}
                {e.effective_to ? ` to ${e.effective_to}` : ""} · affects {e.rule_ids.length} rule(s)
              </p>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel>
        <PanelHeader title="Source documents" subtitle="Ingestion status of each expected official document." />
        <ul className="divide-y divide-border">
          {SOURCE_DOCUMENTS.map((s) => (
            <li key={s.source_id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
              <span className="min-w-0 text-sm">{s.title}</span>
              <StatusPill token={s.ingested ? "PASS" : "MANUAL_REVIEW_REQUIRED"} label={s.ingested ? "ingested" : "not supplied"} />
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
