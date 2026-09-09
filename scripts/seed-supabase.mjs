/**
 * Applies db/004_seed_demo_data.sql's content through the Data API using the
 * service-role key. Same source of truth as the SQL file: the already-verified
 * Legal Metrology corpus in legal_engine/*.json. No legal content is invented.
 */
import { readFileSync } from "node:fs";

const URL_BASE = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_BASE || !KEY) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing");

async function upsert(table, rows, onConflict) {
  if (rows.length === 0) return;
  const url = `${URL_BASE}/rest/v1/${table}${onConflict ? `?on_conflict=${onConflict}` : ""}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      apikey: KEY,
      "content-type": "application/json",
      Prefer: onConflict ? "resolution=merge-duplicates,return=minimal" : "return=minimal",
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) throw new Error(`${table}: ${res.status} ${await res.text()}`);
  console.log(`${table}: ${rows.length} rows`);
}

const rules = JSON.parse(readFileSync("legal_engine/rules.json", "utf8")).rules;
const exemptions = JSON.parse(readFileSync("legal_engine/exemptions.json", "utf8")).exemptions;
const sources = JSON.parse(readFileSync("legal_engine/rule_sources.json", "utf8")).expected_documents;
const scenarios = readFileSync("src/pipeline/scenarios.ts", "utf8");
const today = new Date().toISOString().slice(0, 10);

await upsert(
  "legal_documents",
  sources.map((s) => ({
    source_id: s.source_id,
    title: s.title,
    gazette_reference: `${s.notification_number} · ${s.gazette}`,
    published_on: s.published,
    ingested: s.ingested,
  })),
  "source_id",
);

await upsert(
  "rules",
  rules.map((r) => ({
    rule_key: r.rule_id,
    rule_number: r.rule_number ?? "-",
    sub_rule: r.sub_rule,
    title: r.title,
    description: r.working_summary,
    legal_requirement: r.exact_requirement,
    source_document: r.source_id,
    effective_from: r.effective_from,
    effective_to: r.effective_to,
    status:
      r.effective_from > today ? "future" : r.effective_to && r.effective_to < today ? "superseded" : "in_force",
    version: 1,
    category: r.category,
    field: r.field,
    severity: r.severity,
    machine_checkability: r.machine_checkability,
    human_review_required: r.human_review_required,
    required_evidence: r.required_evidence,
    applicability: r.applicability,
    provenance: r.provenance,
  })),
  "rule_key,version",
);

await upsert(
  "rule_exemptions",
  exemptions.map((e) => ({
    exemption_key: e.exemption_id,
    title: e.title,
    explanation: e.explanation,
    rule_keys: e.rule_ids,
    conditions: e.conditions,
    source_document: e.source_id,
    effective_from: e.effective_from,
    effective_to: e.effective_to,
  })),
  "exemption_key",
);

const sellers = [...new Set([...scenarios.matchAll(/seller:\s*"([^"]+)"/g)].map((m) => m[1]))].map((s) => {
  const [name, district = "—"] = s.split(",").map((x) => x.trim());
  return { name, district, state: "Maharashtra", status: "active" };
});
await upsert("sellers", sellers, "name,district");

console.log("seed complete");
