import { RequireRole, useSession } from "@/components/AppShell";
import { Button, Field, Panel, PanelHeader, StatusPill, inputClass } from "@/components/ui";
import {
  addLegalDocument,
  associateSourceWithRule,
  listDbRules,
  listExemptions,
  listLegalDocuments,
  signedUrl,
  updateLegalDocument,
  uploadLegalDocumentFile,
  type DbExemption,
  type DbRule,
} from "@/lib/db";
import { audit } from "@/lib/store";
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";

export const Route = createFileRoute("/admin/sources")({
  head: () => ({
    meta: [
      { title: "Legal sources & exemptions — ScanShield" },
      { name: "description", content: "Official source documents held for the Legal Metrology corpus, their ingestion status, and the exemptions recorded against provisions." },
      { property: "og:title", content: "Legal sources & exemptions — ScanShield" },
      { property: "og:description", content: "Upload official documents, associate them with provisions and review recorded exemptions." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SourcesPage,
});

type Doc = Awaited<ReturnType<typeof listLegalDocuments>>[number];

function SourcesPage() {
  const session = useSession();
  const [editing, setEditing] = useState<Doc | null>(null);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [rules, setRules] = useState<DbRule[]>([]);
  const [exemptions, setExemptions] = useState<DbExemption[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [sourceId, setSourceId] = useState("");
  const [title, setTitle] = useState("");
  const [gazette, setGazette] = useState("");
  const [publishedOn, setPublishedOn] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const [assocRule, setAssocRule] = useState("");
  const [assocSource, setAssocSource] = useState("");

  const load = useCallback(() => {
    void listLegalDocuments().then(setDocs);
    void listDbRules().then(setRules);
    void listExemptions().then(setExemptions);
  }, []);
  useEffect(load, [load]);

  const ruleKeys = useMemo(() => [...new Set(rules.map((r) => r.rule_key))].sort(), [rules]);

  /** How many distinct provisions are attributed to each source document. */
  const linkedCounts = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const r of rules) {
      if (!r.source_document) continue;
      const set = m.get(r.source_document) ?? new Set<string>();
      set.add(r.rule_key);
      m.set(r.source_document, set);
    }
    return m;
  }, [rules]);

  async function saveMetadata(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setBusy(true);
    setMessage(null);
    const { error } = await updateLegalDocument(editing.id, {
      title: editing.title,
      gazette_reference: editing.gazette_reference,
      published_on: editing.published_on,
      ingested: editing.ingested,
    });
    setBusy(false);
    if (error) {
      setMessage(error);
      return;
    }
    audit({
      user: session?.email ?? "unknown",
      action: "LEGAL_SOURCE_UPDATED",
      entity: "LegalDocument",
      entityId: editing.source_id,
      before: "previous metadata",
      after: `${editing.title} · ${editing.ingested ? "ingested" : "not ingested"}`,
    });
    setMessage(`${editing.title} was updated.`);
    setEditing(null);
    load();
  }

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    let path: string | null = null;
    if (file) {
      path = await uploadLegalDocumentFile(file, sourceId || title);
      if (!path) {
        setBusy(false);
        setMessage("The document file could not be stored. The record was not created.");
        return;
      }
    }
    const { error } = await addLegalDocument({
      source_id: sourceId || title.toLowerCase().replace(/\s+/g, "-").slice(0, 60),
      title,
      gazette_reference: gazette,
      published_on: publishedOn || null,
      document_url: path,
      // A document is only marked ingested once its provisions have actually
      // been read into the rule catalogue — uploading a file is not ingestion.
      ingested: false,
    });
    setBusy(false);
    if (error) {
      setMessage(error);
      return;
    }
    setMessage("The source document was recorded. Its provisions are not ingested until rules are entered against it.");
    setSourceId("");
    setTitle("");
    setGazette("");
    setPublishedOn("");
    setFile(null);
    load();
  }

  async function associate(e: React.FormEvent) {
    e.preventDefault();
    if (!assocRule || !assocSource) return;
    setBusy(true);
    const { error } = await associateSourceWithRule(assocRule, assocSource);
    setBusy(false);
    setMessage(error ?? `${assocRule} is now attributed to ${assocSource}.`);
    load();
  }

  async function open(doc: Doc) {
    if (!doc.document_url) return;
    if (/^https?:\/\//.test(doc.document_url)) {
      window.open(doc.document_url, "_blank", "noreferrer");
      return;
    }
    const url = await signedUrl("legal-documents", doc.document_url, 600);
    if (url) window.open(url, "_blank", "noreferrer");
    else setMessage("That file is no longer available in storage.");
  }

  return (
    <RequireRole allowed={["ADMIN"]}>
      <div className="space-y-4">
        {message ? <p className="rounded-md border border-border bg-card px-4 py-2.5 text-xs">{message}</p> : null}

        <Panel>
          <PanelHeader title={`Source documents (${docs.length})`} subtitle="Official documents held for the corpus." />
          {docs.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No source documents recorded.</p>
          ) : (
            <ul className="divide-y divide-border">
              {docs.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{d.title}</p>
                    <p className="font-mono text-[11px] text-muted-foreground">
                      {d.source_id}
                      {d.gazette_reference ? ` · ${d.gazette_reference}` : ""}
                      {d.published_on ? ` · published ${d.published_on}` : ""}
                    </p>
                  </div>
                  <span className="flex items-center gap-2">
                    <StatusPill token={d.ingested ? "PASS" : "MANUAL_REVIEW_REQUIRED"} label={d.ingested ? "ingested" : "not ingested"} />
                    {d.document_url ? (
                      <Button size="sm" variant="outline" onClick={() => void open(d)}>
                        Open
                      </Button>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel>
          <PanelHeader title="Upload a source document" subtitle="The file is stored privately; only the record is listed here." />
          <form onSubmit={upload} className="space-y-3 p-4">
            <Field label="Title">
              <input required value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass()} />
            </Field>
            <Field label="Source identifier">
              <input value={sourceId} onChange={(e) => setSourceId(e.target.value)} placeholder="e.g. pcr-2011" className={inputClass()} />
            </Field>
            <Field label="Gazette reference">
              <input value={gazette} onChange={(e) => setGazette(e.target.value)} className={inputClass()} />
            </Field>
            <Field label="Published on">
              <input type="date" value={publishedOn} onChange={(e) => setPublishedOn(e.target.value)} className={inputClass()} />
            </Field>
            <Field label="Document file (optional)">
              <input
                type="file"
                accept="application/pdf,image/*"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className={inputClass()}
              />
            </Field>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save document"}
            </Button>
          </form>
        </Panel>

        <Panel>
          <PanelHeader title="Associate a source with a provision" subtitle="Attributes every version of the selected rule to that document." />
          <form onSubmit={associate} className="grid gap-3 p-4 sm:grid-cols-3">
            <Field label="Rule">
              <select value={assocRule} onChange={(e) => setAssocRule(e.target.value)} className={inputClass()}>
                <option value="">Select a rule</option>
                {ruleKeys.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Source document">
              <select value={assocSource} onChange={(e) => setAssocSource(e.target.value)} className={inputClass()}>
                <option value="">Select a document</option>
                {docs.map((d) => (
                  <option key={d.id} value={d.source_id}>
                    {d.title}
                  </option>
                ))}
              </select>
            </Field>
            <div className="flex items-end">
              <Button type="submit" disabled={busy || !assocRule || !assocSource}>
                Associate
              </Button>
            </div>
          </form>
        </Panel>

        <Panel>
          <PanelHeader title={`Exemptions (${exemptions.length})`} subtitle="An exemption resolves a provision to NOT APPLICABLE — never to a pass." />
          {exemptions.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No exemptions recorded in the database.</p>
          ) : (
            <ul className="divide-y divide-border">
              {exemptions.map((x) => {
                const keys = Array.isArray(x.rule_keys) ? (x.rule_keys as string[]) : [];
                return (
                  <li key={x.id} className="px-4 py-3">
                    <p className="text-sm font-medium">{x.title}</p>
                    {x.explanation ? <p className="mt-1 text-xs text-muted-foreground">{x.explanation}</p> : null}
                    <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                      {x.exemption_key} · from {x.effective_from}
                      {x.effective_to ? ` to ${x.effective_to}` : ""} · affects {keys.length} rule(s)
                      {x.source_document ? ` · ${x.source_document}` : ""}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>
    </RequireRole>
  );
}
