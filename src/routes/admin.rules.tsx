import { CorpusBanner } from "@/components/CorpusBanner";
import { useSession } from "@/components/AppShell";
import { Button, Field, Panel, PanelHeader, StatusPill, inputClass } from "@/components/ui";
import { EXEMPTIONS, sourceTitle } from "@/legal/corpus";
import {
  createRuleVersion,
  listDbRules,
  listLegalDocuments,
  setRuleStatus,
  type DbRule,
} from "@/lib/db";
import { audit } from "@/lib/store";
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";

export const Route = createFileRoute("/admin/rules")({
  head: () => ({
    meta: [
      { title: "Rule catalogue — ScanShield" },
      { name: "description", content: "Manage the stored Legal Metrology rule records, amendment versions, effective dates, exemptions and source-document ingestion status." },
      { property: "og:title", content: "Rule catalogue — ScanShield" },
      { property: "og:description", content: "Rule records, amendment versions, exemptions and corpus provenance." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RulesPage,
});

type Doc = Awaited<ReturnType<typeof listLegalDocuments>>[number];

function statusToken(status: DbRule["status"]) {
  if (status === "in_force") return "PASS";
  if (status === "future" || status === "draft") return "MANUAL_REVIEW_REQUIRED";
  return "NOT_APPLICABLE";
}

function RulesPage() {
  const session = useSession();
  const isAdmin = session?.role === "ADMIN";

  const [rules, setRules] = useState<DbRule[]>([]);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [asOf, setAsOf] = useState(new Date().toISOString().slice(0, 10));
  const [q, setQ] = useState("");
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [editing, setEditing] = useState<DbRule | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    void listDbRules().then(setRules);
    void listLegalDocuments().then(setDocs);
  }, []);
  useEffect(load, [load]);

  /** Newest version of every rule, plus its full history. */
  const chains = useMemo(() => {
    const byKey = new Map<string, DbRule[]>();
    for (const r of rules) {
      const list = byKey.get(r.rule_key) ?? [];
      list.push(r);
      byKey.set(r.rule_key, list);
    }
    return [...byKey.entries()].flatMap(([key, versions]) => {
      const sorted = [...versions].sort((a, b) => b.version - a.version);
      const latest = sorted[0];
      return latest ? [{ key, versions: sorted, latest }] : [];
    });
  }, [rules]);

  /** Which version of each rule applied on the selected date. */
  const applicable = useMemo(
    () =>
      chains
        .map((c) => ({
          ...c,
          onDate:
            c.versions.find((v) => v.effective_from <= asOf && (!v.effective_to || v.effective_to >= asOf)) ?? null,
        }))
        .filter((c) => {
          const n = q.trim().toLowerCase();
          return (
            n === "" ||
            c.latest.title.toLowerCase().includes(n) ||
            c.key.toLowerCase().includes(n) ||
            (c.latest.category ?? "").toLowerCase().includes(n)
          );
        }),
    [chains, asOf, q],
  );

  const counts = useMemo(() => {
    let current = 0;
    let future = 0;
    let superseded = 0;
    for (const c of chains) {
      if (c.versions.some((v) => v.effective_from <= asOf && (!v.effective_to || v.effective_to >= asOf))) current += 1;
      else if (c.latest.effective_from > asOf) future += 1;
      else superseded += 1;
    }
    return { current, future, superseded };
  }, [chains, asOf]);

  async function publishVersion(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setBusy(true);
    setMessage(null);
    const { error } = await createRuleVersion({
      rule_key: editing.rule_key,
      title: editing.title,
      rule_number: editing.rule_number,
      legal_requirement: editing.legal_requirement,
      description: editing.description,
      effective_from: editing.effective_from,
      source_document: editing.source_document,
      amendment_note: editing.amendment_note,
    });
    setBusy(false);
    if (error) {
      setMessage(error);
      return;
    }
    audit({
      user: session?.email ?? "unknown",
      action: "RULE_VERSION_PUBLISHED",
      entity: "Rule",
      entityId: editing.rule_key,
      before: `v${editing.version}`,
      after: `effective ${editing.effective_from}`,
    });
    setMessage(`A new version of ${editing.rule_key} was published. The previous version is retained.`);
    setEditing(null);
    load();
  }

  async function archive(rule: DbRule) {
    setBusy(true);
    const { error } = await setRuleStatus(rule.id, rule.status === "archived" ? "in_force" : "archived");
    setBusy(false);
    if (error) {
      setMessage(error);
      return;
    }
    audit({
      user: session?.email ?? "unknown",
      action: rule.status === "archived" ? "RULE_RESTORED" : "RULE_ARCHIVED",
      entity: "Rule",
      entityId: rule.rule_key,
      before: rule.status,
      after: rule.status === "archived" ? "in_force" : "archived",
    });
    load();
  }

  return (
    <div className="space-y-4">
      <CorpusBanner />

      <Panel>
        <PanelHeader
          title="Effective-date simulation"
          subtitle="Change the date to see which version of each provision applied then. Rules are read from the central database."
        />
        <div className="grid gap-3 p-4 sm:grid-cols-2">
          <label className="block">
            <span className="label-caps">As-of date</span>
            <input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} className={inputClass("mt-1.5")} />
          </label>
          <label className="block">
            <span className="label-caps">Search</span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rule, category or id" className={inputClass("mt-1.5")} />
          </label>
        </div>
        <div className="grid grid-cols-3 gap-px border-t border-border bg-border text-center">
          {[["In force", counts.current], ["Not yet in force", counts.future], ["Superseded", counts.superseded]].map(([k, v]) => (
            <div key={String(k)} className="bg-card px-2 py-3">
              <p className="text-xl font-semibold tabular-nums">{v}</p>
              <p className="label-caps mt-0.5">{k}</p>
            </div>
          ))}
        </div>
      </Panel>

      {message ? (
        <p className="rounded-md border border-border bg-card px-4 py-2.5 text-xs">{message}</p>
      ) : null}

      {!isAdmin ? (
        <p className="rounded-md border border-border bg-card px-4 py-2.5 text-xs text-muted-foreground">
          You can read the rule catalogue. Only an administrator may publish a new version or archive a
          provision — this is enforced by the database, not just by this screen.
        </p>
      ) : null}

      {isAdmin ? (
        <Panel>
          <PanelHeader
            title="Add a new provision"
            subtitle="Creates version 1 of a rule. Enter the wording exactly as it appears in the source document — never a paraphrase."
            action={
              <Button size="sm" variant="outline" onClick={() => setCreating((v) => !v)}>
                {creating ? "Close" : "New rule"}
              </Button>
            }
          />
          {creating ? (
            <form onSubmit={submitNewRule} className="grid gap-3 p-4 sm:grid-cols-2">
              <Field label="Rule identifier">
                <input
                  required
                  value={draft.rule_key}
                  onChange={(e) => setDraft({ ...draft, rule_key: e.target.value })}
                  placeholder="PCR_DECL_..."
                  className={inputClass()}
                />
              </Field>
              <Field label="Rule number">
                <input
                  required
                  value={draft.rule_number}
                  onChange={(e) => setDraft({ ...draft, rule_number: e.target.value })}
                  placeholder="6(1)(a)"
                  className={inputClass()}
                />
              </Field>
              <Field label="Title">
                <input required value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className={inputClass()} />
              </Field>
              <Field label="Category">
                <input value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} className={inputClass()} />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Legal requirement (verbatim)">
                  <textarea
                    rows={3}
                    value={draft.legal_requirement}
                    onChange={(e) => setDraft({ ...draft, legal_requirement: e.target.value })}
                    className={inputClass()}
                  />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Description">
                  <textarea
                    rows={2}
                    value={draft.description}
                    onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                    className={inputClass()}
                  />
                </Field>
              </div>
              <Field label="Effective from">
                <input
                  type="date"
                  required
                  value={draft.effective_from}
                  onChange={(e) => setDraft({ ...draft, effective_from: e.target.value })}
                  className={inputClass()}
                />
              </Field>
              <Field label="Source document">
                <select
                  value={draft.source_document}
                  onChange={(e) => setDraft({ ...draft, source_document: e.target.value })}
                  className={inputClass()}
                >
                  <option value="">Not attributed</option>
                  {docs.map((d) => (
                    <option key={d.id} value={d.source_id}>
                      {d.title}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Severity">
                <select value={draft.severity} onChange={(e) => setDraft({ ...draft, severity: e.target.value })} className={inputClass()}>
                  <option value="">Unspecified</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </Field>
              <Field label="Status on creation">
                <select
                  value={draft.status}
                  onChange={(e) => setDraft({ ...draft, status: e.target.value as DbRule["status"] })}
                  className={inputClass()}
                >
                  <option value="draft">Draft</option>
                  <option value="in_force">In force</option>
                  <option value="future">Not yet in force</option>
                </select>
              </Field>
              <div className="sm:col-span-2">
                <Button type="submit" disabled={busy}>
                  {busy ? "Saving…" : "Create rule"}
                </Button>
              </div>
            </form>
          ) : null}
        </Panel>
      ) : null}

      <Panel>
        <PanelHeader title={`Rule records (${applicable.length})`} subtitle="Select a rule to see its full version history." />
        {rules.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">Loading the rule catalogue…</p>
        ) : (
          <ul className="divide-y divide-border">
            {applicable.map((c) => {
              const r = c.onDate ?? c.latest;
              const open = openKey === c.key;
              return (
                <li key={c.key} className="px-4 py-3">
                  <button className="w-full text-left" onClick={() => setOpenKey(open ? null : c.key)}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-medium">{r.title}</span>
                      <span className="flex gap-1.5">
                        <StatusPill token={statusToken(r.status)} label={r.status.replaceAll("_", " ")} />
                        {r.severity ? <StatusPill token={r.severity} label={`${r.severity.toLowerCase()} severity`} /> : null}
                        <StatusPill token="NOT_APPLICABLE" label={`v${r.version}`} />
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{r.description}</p>
                    <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                      {r.rule_key} · rule {r.rule_number}
                      {r.sub_rule ? `(${r.sub_rule})` : ""} · {sourceTitle(r.source_document ?? "")} · in force{" "}
                      {r.effective_from}
                      {r.effective_to ? ` → ${r.effective_to}` : " → open"}
                    </p>
                    <p className="mt-1 text-[11px] text-review-foreground">
                      {r.legal_requirement ?? "Exact statutory wording not ingested for this record."}
                    </p>
                  </button>

                  {open ? (
                    <div className="mt-3 rounded-md border border-border bg-surface p-3">
                      <p className="label-caps">Version history — earlier versions are never deleted</p>
                      <ol className="mt-1.5 space-y-1 text-xs text-muted-foreground">
                        {c.versions.map((v) => (
                          <li key={v.id}>
                            v{v.version} · {v.effective_from} → {v.effective_to ?? "open"} · {v.status}
                            {v.amendment_note ? ` — ${v.amendment_note}` : ""}
                          </li>
                        ))}
                      </ol>
                      {isAdmin ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button size="sm" variant="outline" onClick={() => setEditing({ ...c.latest, amendment_note: "" })}>
                            Publish amended version
                          </Button>
                          <Button size="sm" variant="outline" disabled={busy} onClick={() => void archive(c.latest)}>
                            {c.latest.status === "archived" ? "Restore" : "Archive"}
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      {editing ? (
        <Panel>
          <PanelHeader
            title={`Amend ${editing.rule_key}`}
            subtitle="Publishing creates the next version. The current version is closed off on the day before the new effective date and kept for historical inspections."
          />
          <form onSubmit={publishVersion} className="space-y-3 p-4">
            <Field label="Title">
              <input required value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} className={inputClass()} />
            </Field>
            <Field label="Rule number">
              <input required value={editing.rule_number} onChange={(e) => setEditing({ ...editing, rule_number: e.target.value })} className={inputClass()} />
            </Field>
            <Field label="Statutory wording">
              <textarea
                rows={4}
                value={editing.legal_requirement ?? ""}
                onChange={(e) => setEditing({ ...editing, legal_requirement: e.target.value })}
                className={inputClass()}
              />
            </Field>
            <Field label="Working summary">
              <textarea
                rows={2}
                value={editing.description ?? ""}
                onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                className={inputClass()}
              />
            </Field>
            <Field label="Effective from">
              <input
                type="date"
                required
                value={editing.effective_from}
                onChange={(e) => setEditing({ ...editing, effective_from: e.target.value })}
                className={inputClass()}
              />
            </Field>
            <Field label="Amendment note (which notification made this change)">
              <input
                value={editing.amendment_note ?? ""}
                onChange={(e) => setEditing({ ...editing, amendment_note: e.target.value })}
                className={inputClass()}
              />
            </Field>
            <div className="flex gap-2">
              <Button type="submit" disabled={busy}>
                {busy ? "Publishing…" : "Publish version"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                Cancel
              </Button>
            </div>
          </form>
        </Panel>
      ) : null}

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
        <PanelHeader title="Source documents" subtitle="Ingestion status of each official document held in the database." />
        <ul className="divide-y divide-border">
          {docs.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
              <span className="min-w-0 text-sm">
                {s.title}
                {s.gazette_reference ? <span className="text-muted-foreground"> · {s.gazette_reference}</span> : null}
              </span>
              <StatusPill token={s.ingested ? "PASS" : "MANUAL_REVIEW_REQUIRED"} label={s.ingested ? "ingested" : "not supplied"} />
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
