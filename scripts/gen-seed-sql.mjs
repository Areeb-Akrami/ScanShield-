/**
 * Generates db/004_seed_demo_data.sql from the verified Legal Metrology corpus
 * that already ships with ScanShield (legal_engine/*.json) plus the demo
 * sellers referenced by the existing demo scenarios.
 *
 * No legal content is invented here: every rule row is a 1:1 projection of an
 * already-ingested corpus record.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const q = (v) => (v === null || v === undefined ? "null" : `'${String(v).replaceAll("'", "''")}'`);
const j = (v) => `'${JSON.stringify(v).replaceAll("'", "''")}'::jsonb`;

const rules = JSON.parse(readFileSync("legal_engine/rules.json", "utf8"));
const exemptions = JSON.parse(readFileSync("legal_engine/exemptions.json", "utf8"));
const sources = JSON.parse(readFileSync("legal_engine/rule_sources.json", "utf8"));
const scenarios = readFileSync("src/pipeline/scenarios.ts", "utf8");

const today = new Date().toISOString().slice(0, 10);
const out = [];

out.push(`-- ============================================================================
-- ScanShield — 004_seed_demo_data.sql
-- Idempotent. Loads the already-verified Legal Metrology corpus into the
-- database and the demo sellers/products used by the existing demo workflow.
-- Re-running this file updates rule version 1 in place and never touches any
-- later version created by an administrator.
-- ============================================================================\n`);

/* ---------------------------- legal documents ---------------------------- */
out.push("-- Source documents");
for (const s of sources.expected_documents) {
  out.push(
    `insert into public.legal_documents (source_id, title, gazette_reference, published_on, ingested) values (${q(s.source_id)}, ${q(s.title)}, ${q(`${s.notification_number} · ${s.gazette}`)}, ${q(s.published)}, ${s.ingested})
on conflict (source_id) do update set title = excluded.title, gazette_reference = excluded.gazette_reference, published_on = excluded.published_on, ingested = excluded.ingested;`,
  );
}

/* --------------------------------- rules --------------------------------- */
out.push("\n-- Legal Metrology provisions (version 1 = the principal rules as published)");
for (const r of rules.rules) {
  const status =
    r.effective_from > today ? "future" : r.effective_to && r.effective_to < today ? "superseded" : "in_force";
  out.push(
    `insert into public.rules (rule_key, rule_number, sub_rule, title, description, legal_requirement, source_document, effective_from, effective_to, status, version, category, field, severity, machine_checkability, human_review_required, required_evidence, applicability, provenance) values (${q(r.rule_id)}, ${q(r.rule_number ?? "-")}, ${q(r.sub_rule)}, ${q(r.title)}, ${q(r.working_summary)}, ${q(r.exact_requirement)}, ${q(r.source_id)}, ${q(r.effective_from)}, ${q(r.effective_to)}, '${status}', 1, ${q(r.category)}, ${q(r.field)}, ${q(r.severity)}, ${q(r.machine_checkability)}, ${r.human_review_required}, ${j(r.required_evidence)}, ${j(r.applicability)}, ${q(r.provenance)})
on conflict (rule_key, version) do update set rule_number = excluded.rule_number, title = excluded.title, description = excluded.description, legal_requirement = excluded.legal_requirement, source_document = excluded.source_document, effective_from = excluded.effective_from, category = excluded.category, field = excluded.field, severity = excluded.severity, machine_checkability = excluded.machine_checkability, human_review_required = excluded.human_review_required, required_evidence = excluded.required_evidence, applicability = excluded.applicability, provenance = excluded.provenance;`,
  );
}

/* ------------------------------- exemptions ------------------------------ */
out.push("\n-- Exemptions (an exemption resolves to NOT APPLICABLE, never to a pass)");
for (const e of exemptions.exemptions) {
  out.push(
    `insert into public.rule_exemptions (exemption_key, title, explanation, rule_keys, conditions, source_document, effective_from, effective_to) values (${q(e.exemption_id)}, ${q(e.title)}, ${q(e.explanation)}, ${j(e.rule_ids)}, ${j(e.conditions)}, ${q(e.source_id)}, ${q(e.effective_from)}, ${q(e.effective_to)})
on conflict (exemption_key) do update set title = excluded.title, explanation = excluded.explanation, rule_keys = excluded.rule_keys, conditions = excluded.conditions;`,
  );
}

/* ------------------------- demo sellers + products ----------------------- */
const sellerLines = [...scenarios.matchAll(/seller:\s*"([^"]+)"/g)].map((m) => m[1]);
const sellers = [...new Set(sellerLines)];
out.push("\n-- Demo sellers referenced by the existing demo scenarios");
for (const s of sellers) {
  const [name, district = "—"] = s.split(",").map((x) => x.trim());
  out.push(
    `insert into public.sellers (name, district, state, status) values (${q(name)}, ${q(district)}, 'Maharashtra', 'active') on conflict (name, district) do nothing;`,
  );
}

const products = [...new Set([...scenarios.matchAll(/productName:\s*"([^"]+)"/g)].map((m) => m[1]))];
out.push("\n-- Demo products referenced by the existing demo scenarios");
for (const p of products) {
  out.push(
    `insert into public.products (product_name) select ${q(p)} where not exists (select 1 from public.products where product_name = ${q(p)});`,
  );
}

mkdirSync("db", { recursive: true });
writeFileSync("db/004_seed_demo_data.sql", out.join("\n") + "\n");
console.log(
  `wrote db/004_seed_demo_data.sql — ${rules.rules.length} rules, ${exemptions.exemptions.length} exemptions, ${sellers.length} sellers, ${products.length} products`,
);
