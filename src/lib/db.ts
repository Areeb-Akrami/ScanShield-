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
  const bytes = atob(match[2]);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i += 1) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: match[1] });
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
      category: insp.classification?.category ?? null,
      package_type: insp.classification?.packageType ?? null,
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
  const images = [] as Inspection["images"];
  for (const img of insp.images) {
    let storagePath = (img as { storagePath?: string }).storagePath ?? null;
    if (!storagePath && img.processedDataUrl) {
      storagePath = await uploadDataUrl(
        "package-images",
        `${uid}/${insp.localId}/${img.key}.jpg`,
        img.processedDataUrl,
      );
    }
    images.push({ ...img, storagePath } as Inspection["images"][number]);
  }

  const [seller_id, product_id] = await Promise.all([
    sellerId(insp.seller, insp.district),
    productId(insp.productName, insp),
  ]);

  const payload = {
    ...insp,
    images: images.map((i) => ({ ...i, dataUrl: undefined, processedDataUrl: undefined })),
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
        classification: insp.classification as unknown as Record<string, unknown>,
        is_demo: insp.isDemo,
        inspection_date: insp.createdAt,
        payload: payload as unknown as Record<string, unknown>,
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
        field_name: f.key,
        detected_value: f.value ?? null,
        confidence: f.confidence ?? null,
        bounding_box: (f as { boundingBox?: unknown }).boundingBox ?? null,
        status: f.status ?? null,
      })),
    );
  }

  // Rule-engine output, with the rule version that applied at inspection time
  try {
    const evaluation = evaluateStored(insp);
    await supabase.from("rule_checks").delete().eq("inspection_id", inspectionId);
    const rows = evaluation.results.map((r) => ({
      inspection_id: inspectionId,
      rule_key: r.ruleId,
      rule_version: 1,
      result: (OUTCOME_TO_DB[r.outcome as CheckOutcome] ?? "manual_review") as never,
      reason: r.reason ?? null,
      confidence: r.confidence ?? null,
      evidence: r.evidence ? JSON.stringify(r.evidence).slice(0, 4000) : null,
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
      user: prof?.email ?? m.actor ?? "—",
      action: r.action,
      entity: r.entity_type,
      entityId: m.entity_id ?? "—",
      before: m.before ?? null,
      after: m.after ?? null,
      timestamp: r.created_at,
    };
  });
}

/* ------------------------------------------------------------------ */
/* Consumer self-checks                                                */
/* ------------------------------------------------------------------ */

export async function saveConsumerCheck(input: {
  productName: string;
  status: string;
  confidence: number;
  findings: unknown;
}): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return;
  await supabase.from("consumer_checks").insert({
    consumer_id: auth.user.id,
    product_name: input.productName,
    status: input.status,
    confidence: input.confidence,
    findings: input.findings as never,
  });
}

export async function listConsumerChecks() {
  const { data } = await supabase
    .from("consumer_checks")
    .select("id, product_name, status, confidence, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  return data ?? [];
}

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
  effective_from: string;
  effective_to: string | null;
  status: "draft" | "in_force" | "superseded" | "future" | "archived";
  version: number;
  category: string | null;
  severity: string | null;
  amendment_note: string | null;
  updated_at: string;
}

export async function listDbRules(): Promise<DbRule[]> {
  const { data } = await supabase
    .from("rules")
    .select(
      "id, rule_key, rule_number, sub_rule, title, description, legal_requirement, source_document, effective_from, effective_to, status, version, category, severity, amendment_note, updated_at",
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
}): Promise<{ error?: string }> {
  const { error } = await supabase.rpc("create_rule_version", {
    _rule_key: input.rule_key,
    _title: input.title,
    _rule_number: input.rule_number,
    _legal_requirement: input.legal_requirement,
    _description: input.description,
    _effective_from: input.effective_from,
    _source_document: input.source_document,
    _amendment_note: input.amendment_note,
  });
  return { error: error?.message };
}

export async function setRuleStatus(id: string, status: DbRule["status"]): Promise<{ error?: string }> {
  const { error } = await supabase.from("rules").update({ status }).eq("id", id);
  return { error: error?.message };
}

export async function listLegalDocuments() {
  const { data } = await supabase
    .from("legal_documents")
    .select("id, source_id, title, gazette_reference, published_on, ingested, document_url")
    .order("published_on", { ascending: false });
  return data ?? [];
}
