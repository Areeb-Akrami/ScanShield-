/**
 * Database persistence for ScanShield.
 *
 * The application keeps its existing offline-first local store as the working
 * copy. This module mirrors that working copy into the database so records
 * survive a refresh, a new device and a different user, and so enforcement
 * staff can review inspections captured by inspectors.
 *
 * The Legal Metrology rule engine itself is untouched — its output is written
 * here, it is never re-derived from the database.
 */
import { supabase } from "@/integrations/supabase/client";
import type { FinalStatus } from "@/legal/engine";
import type { CheckOutcome } from "@/legal/types";
import { evaluateStored, type AuditEntry, type Inspection } from "@/lib/store";

type DbStatus =
  | "pending"
  | "compliant"
  | "non_compliant"
  | "manual_review"
  | "rescan_required"
  | "partially_verified"
  | "insufficient_evidence";

const STATUS_TO_DB: Record<string, DbStatus> = {
  COMPLIANT: "compliant",
  PASS: "compliant",
  NON_COMPLIANT: "non_compliant",
  FAIL: "non_compliant",
  MANUAL_REVIEW_REQUIRED: "manual_review",
  RESCAN_REQUIRED: "rescan_required",
  PARTIALLY_VERIFIED: "partially_verified",
  INSUFFICIENT_EVIDENCE: "insufficient_evidence",
};
const STATUS_FROM_DB: Record<DbStatus, FinalStatus> = {
  pending: "INSUFFICIENT_EVIDENCE" as FinalStatus,
  compliant: "COMPLIANT" as FinalStatus,
  non_compliant: "NON_COMPLIANT" as FinalStatus,
  manual_review: "MANUAL_REVIEW_REQUIRED" as FinalStatus,
  rescan_required: "RESCAN_REQUIRED" as FinalStatus,
  partially_verified: "PARTIALLY_VERIFIED" as FinalStatus,
  insufficient_evidence: "INSUFFICIENT_EVIDENCE" as FinalStatus,
};

const OUTCOME_TO_DB: Record<string, string> = {
  PASS: "pass",
  FAIL: "fail",
  MANUAL_REVIEW_REQUIRED: "manual_review",
  NOT_APPLICABLE: "not_applicable",
  RESCAN_REQUIRED: "rescan_required",
  INSUFFICIENT_EVIDENCE: "insufficient_evidence",
};

function dbStatus(status: string): DbStatus {
  return STATUS_TO_DB[status] ?? "pending";
}

/* ------------------------------------------------------------------ */
/* Storage                                                             */
/* ------------------------------------------------------------------ */

function dataUrlToBlob(dataUrl: string): Blob | null {
  const match = /^data:([^;]+);base64,(.*)$/.exec(dataUrl);
  if (!match) return null;
  const bytes = atob(match[2] ?? "");
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i += 1) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: match[1] ?? "image/jpeg" });
}

export async function uploadDataUrl(bucket: string, path: string, dataUrl: string): Promise<string | null> {
  const blob = dataUrlToBlob(dataUrl);
  if (!blob) return null;
  const { error } = await supabase.storage.from(bucket).upload(path, blob, {
    upsert: true,
    contentType: blob.type,
  });
  if (error) return null;
  return path;
}

/** Buckets are private, so viewing an image requires a short-lived signed link. */
export async function signedUrl(bucket: string, path: string, seconds = 3600): Promise<string | null> {
  const { data } = await supabase.storage.from(bucket).createSignedUrl(path, seconds);
  return data?.signedUrl ?? null;
}

/* ------------------------------------------------------------------ */
/* Reference rows                                                      */
/* ------------------------------------------------------------------ */

async function sellerId(name: string, district: string): Promise<string | null> {
  if (!name) return null;
  const { data } = await supabase.from("sellers").select("id").eq("name", name).maybeSingle();
  if (data?.id) return data.id;
  const { data: created } = await supabase
    .from("sellers")
    .insert({ name, district, status: "active" })
    .select("id")
    .maybeSingle();
  return created?.id ?? null;
}

async function productId(name: string, insp: Inspection): Promise<string | null> {
  if (!name) return null;
  const { data } = await supabase.from("products").select("id").eq("product_name", name).maybeSingle();
  if (data?.id) return data.id;
  const { data: created } = await supabase
    .from("products")
    .insert({
      product_name: name,
      category: insp.classification?.product_category ?? null,
      package_type: insp.classification?.package_type ?? null,
    })
    .select("id")
    .maybeSingle();
  return created?.id ?? null;
}

/* ------------------------------------------------------------------ */
/* Inspections                                                         */
/* ------------------------------------------------------------------ */

/**
 * Pushes one inspection (and its extraction + rule-engine output) to the
 * database. Returns the server id, or null when the write was rejected.
 */
export async function pushInspection(insp: Inspection): Promise<string | null> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return null;

  // Upload each captured panel once, then keep only the storage path in the
  // stored record so the row stays small.
  const images: Array<Inspection["images"][number] & { storagePath?: string | null }> = [];
  for (const img of insp.images) {
    const current = img as Inspection["images"][number] & { storagePath?: string | null };
    let storagePath = current.storagePath ?? null;
    const source = img.processed ?? img.original;
    if (!storagePath && source?.startsWith("data:")) {
      storagePath = await uploadDataUrl("package-images", `${uid}/${insp.localId}/${img.key}.jpg`, source);
    }
    images.push({ ...current, storagePath });
  }

  const [seller_id, product_id] = await Promise.all([
    sellerId(insp.seller, insp.district),
    productId(insp.productName, insp),
  ]);

  // Image bytes live in storage, not in the row: keep only the reference.
  const payload = {
    ...insp,
    images: images.map((i) => ({ ...i, original: null, processed: null })),
  };

  const { data: row, error } = await supabase
    .from("inspections")
    .upsert(
      {
        local_id: insp.localId,
        inspector_id: uid,
        seller_id,
        product_id,
        seller_name: insp.seller,
        product_name: insp.productName,
        district: insp.district,
        status: dbStatus(insp.finalStatus),
        system_status: dbStatus(insp.systemStatus ?? insp.finalStatus),
        confidence: insp.confidence,
        latitude: insp.geo.latitude,
        longitude: insp.geo.longitude,
        location_accuracy: insp.geo.accuracy,
        package_image_url: images[0]?.storagePath ?? null,
        classification: insp.classification as never,
        is_demo: insp.isDemo,
        inspection_date: insp.createdAt,
        payload: payload as never,
      },
      { onConflict: "local_id" },
    )
    .select("id")
    .maybeSingle();

  if (error || !row?.id) return null;
  const inspectionId = row.id;

  // Extraction results
  await supabase.from("ocr_results").delete().eq("inspection_id", inspectionId);
  if (insp.fields.length > 0) {
    await supabase.from("ocr_results").insert(
      insp.fields.map((f) => ({
        inspection_id: inspectionId,
        field_name: f.field,
        detected_value: f.inspectorValue ?? f.value ?? null,
        confidence: f.confidence ?? null,
        bounding_box: f.boundingBox as never,
        status: f.unreadable ? "unreadable" : f.value ? "detected" : "not_detected",
      })),
    );
  }

  // Rule-engine output, with the rule version that applied at inspection time
  try {
    const evaluation = evaluateStored(insp);
    await supabase.from("rule_checks").delete().eq("inspection_id", inspectionId);
    const rows = evaluation.results.map((r) => ({
      inspection_id: inspectionId,
      rule_key: r.rule.rule_id,
      rule_version: 1,
      result: (OUTCOME_TO_DB[r.outcome as CheckOutcome] ?? "manual_review") as never,
      reason: r.reason ?? null,
      confidence: r.confidence ?? null,
      evidence: r.evidence?.length ? r.evidence.join(" | ").slice(0, 4000) : null,
    }));
    if (rows.length > 0) await supabase.from("rule_checks").insert(rows);
  } catch {
    /* the engine is authoritative locally; a persistence hiccup must not block the inspector */
  }

  return inspectionId;
}

/** Reads every inspection the signed-in user is allowed to see. */
export async function fetchRemoteInspections(): Promise<Inspection[]> {
  const { data, error } = await supabase
    .from("inspections")
    .select("local_id, status, system_status, payload, created_at, updated_at")
    .order("inspection_date", { ascending: false })
    .limit(500);
  if (error || !data) return [];
  return data
    .map((row) => {
      const p = (row.payload ?? {}) as Partial<Inspection>;
      if (!p.localId) return null;
      return {
        ...(p as Inspection),
        finalStatus: STATUS_FROM_DB[row.status as DbStatus] ?? p.finalStatus,
        syncStatus: "SYNCED",
      } as Inspection;
    })
    .filter((x): x is Inspection => x !== null);
}

export async function recordDecision(
  localId: string,
  decision: "confirm_compliant" | "confirm_non_compliant" | "request_rescan" | "mark_not_applicable" | "send_for_review",
  note: string,
): Promise<boolean> {
  const { data: auth } = await supabase.auth.getUser();
  const { data: insp } = await supabase.from("inspections").select("id").eq("local_id", localId).maybeSingle();
  if (!insp?.id || !auth.user) return false;
  const { error } = await supabase
    .from("decisions")
    .insert({ inspection_id: insp.id, officer_id: auth.user.id, decision, note });
  return !error;
}

/* ------------------------------------------------------------------ */
/* Audit trail                                                         */
/* ------------------------------------------------------------------ */

export async function pushAudit(entry: Omit<AuditEntry, "id" | "timestamp">): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return;
  await supabase.from("audit_logs").insert({
    user_id: auth.user.id,
    action: entry.action,
    entity_type: entry.entity,
    metadata: { entity_id: entry.entityId, before: entry.before, after: entry.after, actor: entry.user },
  });
}

export async function fetchAudit(): Promise<AuditEntry[]> {
  const { data } = await supabase
    .from("audit_logs")
    .select("id, action, entity_type, metadata, created_at, profiles:user_id(full_name, email)")
    .order("created_at", { ascending: false })
    .limit(500);
  return (data ?? []).map((r) => {
    const m = (r.metadata ?? {}) as Record<string, string | null>;
    const prof = r.profiles as { full_name?: string; email?: string } | null;
    return {
      id: r.id,
      user: prof?.email ?? m['actor'] ?? "—",
      action: r.action,
      entity: r.entity_type ?? "—",
      entityId: m['entity_id'] ?? "—",
      before: m['before'] ?? null,
      after: m['after'] ?? null,
      timestamp: r.created_at,
    };
  });
}

/* ------------------------------------------------------------------ */
/* Consumer self-checks live in src/lib/consumer.ts                    */
/* ------------------------------------------------------------------ */


/* ------------------------------------------------------------------ */
/* Rules (admin management + engine overlay)                           */
/* ------------------------------------------------------------------ */

export interface DbRule {
  id: string;
  rule_key: string;
  rule_number: string;
  sub_rule: string | null;
  title: string;
  description: string | null;
  legal_requirement: string | null;
  source_document: string | null;
  source_url: string | null;
  effective_from: string;
  effective_to: string | null;
  status: "draft" | "in_force" | "superseded" | "future" | "archived";
  version: number;
  category: string | null;
  field: string | null;
  severity: string | null;
  machine_checkability: string | null;
  human_review_required: boolean;
  provenance: string | null;
  amendment_note: string | null;
  created_at: string;
  updated_at: string;
}

export async function listDbRules(): Promise<DbRule[]> {
  const { data } = await supabase
    .from("rules")
    .select(
      "id, rule_key, rule_number, sub_rule, title, description, legal_requirement, source_document, source_url, effective_from, effective_to, status, version, category, field, severity, machine_checkability, human_review_required, provenance, amendment_note, created_at, updated_at",
    )
    .order("rule_key")
    .order("version", { ascending: false });
  return (data ?? []) as DbRule[];
}

/** Creates the next version of a rule; earlier versions are preserved. */
export async function createRuleVersion(input: {
  rule_key: string;
  title: string;
  rule_number: string;
  legal_requirement: string | null;
  description: string | null;
  effective_from: string;
  source_document: string | null;
  amendment_note: string | null;
}): Promise<{ error?: string | undefined }> {
  const { error } = await supabase.rpc("create_rule_version", {
    _rule_key: input.rule_key,
    _title: input.title,
    _rule_number: input.rule_number,
    _legal_requirement: input.legal_requirement ?? "",
    _description: input.description ?? "",
    _effective_from: input.effective_from,
    _source_document: input.source_document ?? "",
    _amendment_note: input.amendment_note ?? "",
  });
  return { error: error?.message };
}

export async function setRuleStatus(id: string, status: DbRule["status"]): Promise<{ error?: string | undefined }> {
  const { error } = await supabase.from("rules").update({ status }).eq("id", id);
  return { error: error?.message };
}

export async function listLegalDocuments() {
  const { data } = await supabase
    .from("legal_documents")
    .select("id, source_id, title, gazette_reference, published_on, ingested, document_url, created_at")
    .order("published_on", { ascending: false });
  return data ?? [];
}

/* ------------------------------------------------------------------ */
/* Admin: rule creation, sources, exemptions, sellers, notifications   */
/* ------------------------------------------------------------------ */

/** Creates a brand-new provision (version 1). Only an administrator may do this. */
export async function createRule(input: {
  rule_key: string;
  rule_number: string;
  sub_rule?: string | null;
  title: string;
  description?: string | null;
  legal_requirement?: string | null;
  source_document?: string | null;
  source_url?: string | null;
  effective_from: string;
  effective_to?: string | null;
  category?: string | null;
  field?: string | null;
  severity?: string | null;
  machine_checkability?: string | null;
  human_review_required?: boolean;
  required_evidence?: string[];
  applicability?: Record<string, unknown>;
  provenance?: string | null;
  amendment_note?: string | null;
  status?: DbRule["status"];
}): Promise<{ error?: string | undefined }> {
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase.from("rules").insert({
    rule_key: input.rule_key.trim(),
    rule_number: input.rule_number.trim(),
    sub_rule: input.sub_rule?.trim() || null,
    title: input.title.trim(),
    description: input.description?.trim() || null,
    legal_requirement: input.legal_requirement?.trim() || null,
    source_document: input.source_document || null,
    source_url: input.source_url?.trim() || null,
    effective_from: input.effective_from,
    effective_to: input.effective_to || null,
    status: input.status ?? "draft",
    version: 1,
    category: input.category?.trim() || null,
    field: input.field?.trim() || null,
    severity: input.severity || null,
    machine_checkability: input.machine_checkability || null,
    human_review_required: input.human_review_required ?? false,
    required_evidence: (input.required_evidence ?? []) as never,
    applicability: (input.applicability ?? {}) as never,
    provenance: input.provenance?.trim() || "ENTERED_BY_ADMINISTRATOR",
    amendment_note: input.amendment_note?.trim() || null,
    created_by: auth.user?.id ?? null,
  });
  return { error: error?.message };
}

/** Edits the current version in place — used for corrections, not amendments. */
export async function updateRule(
  id: string,
  patch: Partial<
    Pick<
      DbRule,
      | "title"
      | "rule_number"
      | "sub_rule"
      | "description"
      | "legal_requirement"
      | "source_document"
      | "source_url"
      | "category"
      | "field"
      | "severity"
      | "machine_checkability"
      | "human_review_required"
      | "effective_from"
      | "effective_to"
    >
  >,
): Promise<{ error?: string | undefined }> {
  const { error } = await supabase.from("rules").update(patch).eq("id", id);
  return { error: error?.message };
}

export interface DbExemption {
  id: string;
  exemption_key: string;
  title: string;
  explanation: string | null;
  rule_keys: unknown;
  conditions: unknown;
  source_document: string | null;
  effective_from: string;
  effective_to: string | null;
}

export async function listExemptions(): Promise<DbExemption[]> {
  const { data } = await supabase
    .from("rule_exemptions")
    .select("id, exemption_key, title, explanation, rule_keys, conditions, source_document, effective_from, effective_to")
    .order("exemption_key");
  return (data ?? []) as DbExemption[];
}

/** Uploads an official document file into the private legal-documents bucket. */
export async function uploadLegalDocumentFile(file: File, sourceId: string): Promise<string | null> {
  const safe = sourceId.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${safe}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const { error } = await supabase.storage.from("legal-documents").upload(path, file, {
    upsert: true,
    contentType: file.type || "application/octet-stream",
  });
  return error ? null : path;
}

export async function addLegalDocument(input: {
  source_id: string;
  title: string;
  gazette_reference?: string | null;
  published_on?: string | null;
  document_url?: string | null;
  ingested?: boolean;
}): Promise<{ error?: string | undefined }> {
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase.from("legal_documents").insert({
    source_id: input.source_id.trim(),
    title: input.title.trim(),
    gazette_reference: input.gazette_reference?.trim() || null,
    published_on: input.published_on || null,
    document_url: input.document_url || null,
    ingested: input.ingested ?? false,
    uploaded_by: auth.user?.id ?? null,
  });
  return { error: error?.message };
}

/** Points every version of one rule at a source document. */
export async function associateSourceWithRule(ruleKey: string, sourceId: string): Promise<{ error?: string | undefined }> {
  const { error } = await supabase.from("rules").update({ source_document: sourceId }).eq("rule_key", ruleKey);
  return { error: error?.message };
}

/** Corrects the metadata of a recorded source document. */
export async function updateLegalDocument(
  id: string,
  patch: { title?: string; gazette_reference?: string | null; published_on?: string | null; ingested?: boolean },
): Promise<{ error?: string | undefined }> {
  const { error } = await supabase.from("legal_documents").update(patch).eq("id", id);
  return { error: error?.message };
}

export interface DbSeller {
  id: string;
  name: string;
  address: string | null;
  district: string | null;
  state: string | null;
  contact_phone: string | null;
  risk_score: number;
  status: string;
  updated_at: string;
}

export async function listDbSellers(): Promise<DbSeller[]> {
  const { data } = await supabase
    .from("sellers")
    .select("id, name, address, district, state, contact_phone, risk_score, status, updated_at")
    .order("risk_score", { ascending: false });
  return (data ?? []) as DbSeller[];
}

export async function setSellerStatus(id: string, status: string): Promise<{ error?: string | undefined }> {
  const { error } = await supabase.from("sellers").update({ status }).eq("id", id);
  return { error: error?.message };
}

/** Sends a notification to one or more accounts. Staff-only by policy. */
export async function sendNotifications(
  userIds: string[],
  title: string,
  message: string,
  type = "admin",
): Promise<{ error?: string | undefined; sent: number }> {
  if (userIds.length === 0) return { error: "No recipients selected.", sent: 0 };
  const { error } = await supabase
    .from("notifications")
    .insert(userIds.map((user_id) => ({ user_id, title, message, type })));
  return { error: error?.message, sent: error ? 0 : userIds.length };
}

export async function listOwnNotifications() {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return [];
  const { data } = await supabase
    .from("notifications")
    .select("id, title, message, type, read, created_at")
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: false })
    .limit(100);
  return data ?? [];
}

export async function markNotificationRead(id: string) {
  await supabase.from("notifications").update({ read: true }).eq("id", id);
}

/* ------------------------------------------------------------------ */
/* Admin analytics                                                     */
/* ------------------------------------------------------------------ */

export interface AdminAnalytics {
  inspections: number;
  byStatus: Array<[string, number]>;
  byDistrict: Array<[string, { total: number; bad: number }]>;
  topFailedRules: Array<[string, number]>;
  consumerChecks: number;
  complaints: number;
  openComplaints: number;
  staff: number;
  customers: number;
}

export async function fetchAdminAnalytics(): Promise<AdminAnalytics> {
  const [insp, checks, comps, profs, failed] = await Promise.all([
    supabase.from("inspections").select("status, district").limit(2000),
    supabase.from("consumer_checks").select("id").limit(5000),
    supabase.from("complaints").select("status").limit(2000),
    supabase.from("profiles").select("role").limit(2000),
    supabase.from("rule_checks").select("rule_key, result").eq("result", "fail").limit(5000),
  ]);

  const byStatus = new Map<string, number>();
  const byDistrict = new Map<string, { total: number; bad: number }>();
  for (const row of insp.data ?? []) {
    const status = String(row.status);
    byStatus.set(status, (byStatus.get(status) ?? 0) + 1);
    const key = row.district ?? "Unrecorded";
    const d = byDistrict.get(key) ?? { total: 0, bad: 0 };
    d.total += 1;
    if (status === "non_compliant") d.bad += 1;
    byDistrict.set(key, d);
  }

  const ruleCount = new Map<string, number>();
  for (const row of failed.data ?? []) {
    const key = row.rule_key ?? "—";
    ruleCount.set(key, (ruleCount.get(key) ?? 0) + 1);
  }

  const roles = (profs.data ?? []).map((p) => String(p.role));
  return {
    inspections: (insp.data ?? []).length,
    byStatus: [...byStatus.entries()].sort((a, b) => b[1] - a[1]),
    byDistrict: [...byDistrict.entries()].sort((a, b) => b[1].bad - a[1].bad),
    topFailedRules: [...ruleCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12),
    consumerChecks: (checks.data ?? []).length,
    complaints: (comps.data ?? []).length,
    openComplaints: (comps.data ?? []).filter((c) => String(c.status) !== "resolved").length,
    staff: roles.filter((r) => r === "inspector" || r === "enforcement_officer" || r === "admin").length,
    customers: roles.filter((r) => r === "consumer").length,
  };
}
