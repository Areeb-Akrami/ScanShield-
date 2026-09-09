/**
 * Read/write helpers for the enforcement-officer workspace.
 *
 * Everything here reads the existing tables through the signed-in officer's
 * own session, so row-level security decides what is visible. No rule
 * evaluation happens here — rule_checks are produced by the existing legal
 * engine when an inspection is recorded, and are only displayed.
 */
import { supabase } from "@/integrations/supabase/client";
import { pushAudit, signedUrl } from "@/lib/db";

export type DecisionType =
  | "confirm_compliant"
  | "confirm_non_compliant"
  | "request_rescan"
  | "send_for_review";

export interface CaseRow {
  id: string;
  local_id: string | null;
  product_name: string | null;
  seller_name: string | null;
  district: string | null;
  status: string;
  system_status: string | null;
  confidence: number | null;
  inspection_date: string;
  is_demo: boolean;
  violations: number;
  reviewItems: number;
  risk: "HIGH" | "MEDIUM" | "LOW";
}

function riskOf(status: string, violations: number): CaseRow["risk"] {
  if (status === "non_compliant" || violations >= 3) return "HIGH";
  if (violations > 0 || status === "manual_review" || status === "rescan_required") return "MEDIUM";
  return "LOW";
}

/** Every inspection the officer may see, with its violation tally. */
export async function listCases(): Promise<CaseRow[]> {
  const [insp, checks] = await Promise.all([
    supabase
      .from("inspections")
      .select(
        "id, local_id, product_name, seller_name, district, status, system_status, confidence, inspection_date, is_demo",
      )
      .order("inspection_date", { ascending: false })
      .limit(500),
    supabase.from("rule_checks").select("inspection_id, result").limit(10000),
  ]);

  const fails = new Map<string, number>();
  const reviews = new Map<string, number>();
  for (const row of checks.data ?? []) {
    const id = row.inspection_id;
    if (row.result === "fail") fails.set(id, (fails.get(id) ?? 0) + 1);
    else if (row.result === "manual_review" || row.result === "insufficient_evidence")
      reviews.set(id, (reviews.get(id) ?? 0) + 1);
  }

  return (insp.data ?? []).map((r) => {
    const violations = fails.get(r.id) ?? 0;
    return {
      ...r,
      violations,
      reviewItems: reviews.get(r.id) ?? 0,
      risk: riskOf(String(r.status), violations),
    } as CaseRow;
  });
}

export interface CaseRuleCheck {
  id: string;
  rule_key: string | null;
  rule_version: number | null;
  result: string;
  reason: string | null;
  confidence: number | null;
  evidence: string | null;
  rule_number?: string | null;
  rule_title?: string | null;
}

export interface CaseOcrRow {
  id: string;
  field_name: string;
  detected_value: string | null;
  confidence: number | null;
  status: string | null;
}

export interface CaseDecision {
  id: string;
  decision: string;
  note: string | null;
  created_at: string;
  officer: string | null;
}

export interface CaseDetail {
  id: string;
  local_id: string | null;
  product_name: string | null;
  seller_name: string | null;
  district: string | null;
  status: string;
  system_status: string | null;
  confidence: number | null;
  inspection_date: string;
  is_demo: boolean;
  latitude: number | null;
  longitude: number | null;
  package_image_url: string | null;
  inspector: string | null;
  payload: Record<string, unknown>;
  checks: CaseRuleCheck[];
  ocr: CaseOcrRow[];
  decisions: CaseDecision[];
  audit: Array<{ id: string; action: string; created_at: string; actor: string | null }>;
}

/** Full case file for one inspection, or null when it is not visible. */
export async function getCase(id: string): Promise<CaseDetail | null> {
  const { data: insp } = await supabase
    .from("inspections")
    .select(
      "id, local_id, product_name, seller_name, district, status, system_status, confidence, inspection_date, is_demo, latitude, longitude, package_image_url, payload, profiles:inspector_id(full_name, email)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!insp) return null;

  const [checks, ocr, decisions, audit, rules] = await Promise.all([
    supabase
      .from("rule_checks")
      .select("id, rule_key, rule_version, result, reason, confidence, evidence")
      .eq("inspection_id", id),
    supabase.from("ocr_results").select("id, field_name, detected_value, confidence, status").eq("inspection_id", id),
    supabase
      .from("decisions")
      .select("id, decision, note, created_at, profiles:officer_id(full_name, email)")
      .eq("inspection_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("audit_logs")
      .select("id, action, created_at, profiles:user_id(full_name, email)")
      .eq("inspection_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.from("rules").select("rule_key, rule_number, title"),
  ]);

  const ruleMeta = new Map((rules.data ?? []).map((r) => [r.rule_key, r]));
  const inspector = insp.profiles as { full_name?: string | null; email?: string | null } | null;

  return {
    id: insp.id,
    local_id: insp.local_id,
    product_name: insp.product_name,
    seller_name: insp.seller_name,
    district: insp.district,
    status: String(insp.status),
    system_status: insp.system_status ? String(insp.system_status) : null,
    confidence: insp.confidence,
    inspection_date: insp.inspection_date,
    is_demo: insp.is_demo,
    latitude: insp.latitude,
    longitude: insp.longitude,
    package_image_url: insp.package_image_url,
    inspector: inspector?.full_name ?? inspector?.email ?? null,
    payload: (insp.payload ?? {}) as Record<string, unknown>,
    checks: (checks.data ?? []).map((c) => ({
      ...c,
      result: String(c.result),
      rule_number: ruleMeta.get(c.rule_key ?? "")?.rule_number ?? null,
      rule_title: ruleMeta.get(c.rule_key ?? "")?.title ?? null,
    })),
    ocr: (ocr.data ?? []) as CaseOcrRow[],
    decisions: (decisions.data ?? []).map((d) => {
      const p = d.profiles as { full_name?: string | null; email?: string | null } | null;
      return {
        id: d.id,
        decision: String(d.decision),
        note: d.note,
        created_at: d.created_at,
        officer: p?.full_name ?? p?.email ?? null,
      };
    }),
    audit: (audit.data ?? []).map((a) => {
      const p = a.profiles as { full_name?: string | null; email?: string | null } | null;
      return { id: a.id, action: a.action, created_at: a.created_at, actor: p?.full_name ?? p?.email ?? null };
    }),
  };
}

const STATUS_FOR_DECISION: Record<DecisionType, string> = {
  confirm_compliant: "compliant",
  confirm_non_compliant: "non_compliant",
  request_rescan: "rescan_required",
  send_for_review: "manual_review",
};

/**
 * Records an officer's decision in the existing decisions table, moves the
 * case status, and writes an audit entry. The system's own evaluation is left
 * untouched in system_status so the machine result stays inspectable.
 */
export async function submitDecision(
  inspectionId: string,
  decision: DecisionType,
  note: string,
  previousStatus: string,
): Promise<{ error?: string }> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Your session has expired. Sign in again." };

  const { error } = await supabase
    .from("decisions")
    .insert({ inspection_id: inspectionId, officer_id: auth.user.id, decision, note: note || null });
  if (error) return { error: error.message };

  const next = STATUS_FOR_DECISION[decision];
  const { error: statusError } = await supabase
    .from("inspections")
    .update({ status: next as never })
    .eq("id", inspectionId);

  await pushAudit({
    user: auth.user.email ?? "officer",
    action: "OFFICER_DECISION",
    entity: "Inspection",
    entityId: inspectionId,
    before: previousStatus,
    after: `${decision} → ${next}`,
  });

  return statusError ? { error: statusError.message } : {};
}

export interface SellerRow {
  id: string;
  name: string;
  district: string | null;
  state: string | null;
  risk_score: number;
  status: string;
  inspections: number;
  nonCompliant: number;
  lastInspection: string | null;
}

export async function listSellers(): Promise<SellerRow[]> {
  const [sellers, insp] = await Promise.all([
    supabase.from("sellers").select("id, name, district, state, risk_score, status").order("risk_score", { ascending: false }),
    supabase.from("inspections").select("seller_id, status, inspection_date").limit(2000),
  ]);

  const stats = new Map<string, { total: number; bad: number; last: string | null }>();
  for (const row of insp.data ?? []) {
    if (!row.seller_id) continue;
    const s = stats.get(row.seller_id) ?? { total: 0, bad: 0, last: null };
    s.total += 1;
    if (String(row.status) === "non_compliant") s.bad += 1;
    if (!s.last || row.inspection_date > s.last) s.last = row.inspection_date;
    stats.set(row.seller_id, s);
  }

  return (sellers.data ?? []).map((s) => {
    const st = stats.get(s.id);
    return {
      ...s,
      inspections: st?.total ?? 0,
      nonCompliant: st?.bad ?? 0,
      lastInspection: st?.last ?? null,
    } as SellerRow;
  });
}

export interface ReportRow {
  id: string;
  report_number: string | null;
  report_url: string | null;
  generated_at: string;
  product: string | null;
  seller: string | null;
  inspection_date: string | null;
  result: string | null;
  local_id: string | null;
}

export async function listReports(): Promise<ReportRow[]> {
  const { data } = await supabase
    .from("reports")
    .select(
      "id, report_number, report_url, generated_at, inspections:inspection_id(local_id, product_name, seller_name, inspection_date, status)",
    )
    .order("generated_at", { ascending: false })
    .limit(300);
  return (data ?? []).map((r) => {
    const i = r.inspections as {
      local_id?: string | null;
      product_name?: string | null;
      seller_name?: string | null;
      inspection_date?: string | null;
      status?: string | null;
    } | null;
    return {
      id: r.id,
      report_number: r.report_number,
      report_url: r.report_url,
      generated_at: r.generated_at,
      product: i?.product_name ?? null,
      seller: i?.seller_name ?? null,
      inspection_date: i?.inspection_date ?? null,
      result: i?.status ?? null,
      local_id: i?.local_id ?? null,
    };
  });
}

/** Signed link for a stored report or package image. */
export async function openStored(bucket: string, path: string | null): Promise<string | null> {
  if (!path) return null;
  if (/^https?:\/\//.test(path)) return path;
  return signedUrl(bucket, path, 600);
}

export interface OfficerAnalytics {
  total: number;
  byStatus: Array<[string, number]>;
  byDistrict: Array<[string, { total: number; bad: number }]>;
  byMonth: Array<[string, { total: number; bad: number }]>;
  topRules: Array<[string, number]>;
  backlog: number;
  decisions: Array<[string, number]>;
  highRiskSellers: number;
}

export async function fetchOfficerAnalytics(): Promise<OfficerAnalytics> {
  const [insp, checks, decisions, sellers] = await Promise.all([
    supabase.from("inspections").select("status, district, inspection_date").limit(2000),
    supabase.from("rule_checks").select("rule_key, result").eq("result", "fail").limit(10000),
    supabase.from("decisions").select("decision").limit(2000),
    supabase.from("sellers").select("risk_score").limit(2000),
  ]);

  const byStatus = new Map<string, number>();
  const byDistrict = new Map<string, { total: number; bad: number }>();
  const byMonth = new Map<string, { total: number; bad: number }>();
  for (const row of insp.data ?? []) {
    const status = String(row.status);
    const bad = status === "non_compliant";
    byStatus.set(status, (byStatus.get(status) ?? 0) + 1);

    const dk = row.district ?? "Unrecorded";
    const d = byDistrict.get(dk) ?? { total: 0, bad: 0 };
    d.total += 1;
    if (bad) d.bad += 1;
    byDistrict.set(dk, d);

    const mk = String(row.inspection_date).slice(0, 7);
    const m = byMonth.get(mk) ?? { total: 0, bad: 0 };
    m.total += 1;
    if (bad) m.bad += 1;
    byMonth.set(mk, m);
  }

  const rule = new Map<string, number>();
  for (const row of checks.data ?? []) rule.set(row.rule_key ?? "—", (rule.get(row.rule_key ?? "—") ?? 0) + 1);

  const dec = new Map<string, number>();
  for (const row of decisions.data ?? []) dec.set(String(row.decision), (dec.get(String(row.decision)) ?? 0) + 1);

  return {
    total: (insp.data ?? []).length,
    byStatus: [...byStatus.entries()].sort((a, b) => b[1] - a[1]),
    byDistrict: [...byDistrict.entries()].sort((a, b) => b[1].bad - a[1].bad).slice(0, 12),
    byMonth: [...byMonth.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-12),
    topRules: [...rule.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10),
    backlog: (byStatus.get("pending") ?? 0) + (byStatus.get("manual_review") ?? 0) + (byStatus.get("rescan_required") ?? 0),
    decisions: [...dec.entries()].sort((a, b) => b[1] - a[1]),
    highRiskSellers: (sellers.data ?? []).filter((s) => Number(s.risk_score) >= 60).length,
  };
}

export interface OfficerDecisionFeedItem {
  id: string;
  decision: string;
  note: string | null;
  created_at: string;
  officer: string | null;
  inspection_id: string;
  product: string | null;
  seller: string | null;
}

export async function listRecentDecisions(limit = 10): Promise<OfficerDecisionFeedItem[]> {
  const { data } = await supabase
    .from("decisions")
    .select(
      "id, decision, note, created_at, inspection_id, profiles:officer_id(full_name, email), inspections:inspection_id(product_name, seller_name)",
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map((d) => {
    const p = d.profiles as { full_name?: string | null; email?: string | null } | null;
    const i = d.inspections as { product_name?: string | null; seller_name?: string | null } | null;
    return {
      id: d.id,
      decision: String(d.decision),
      note: d.note,
      created_at: d.created_at,
      officer: p?.full_name ?? p?.email ?? null,
      inspection_id: d.inspection_id,
      product: i?.product_name ?? null,
      seller: i?.seller_name ?? null,
    };
  });
}

/** Maps a database inspection status onto the shared status pill tokens. */
export function statusToken(status: string | null | undefined): string {
  switch (status) {
    case "compliant":
      return "COMPLIANT";
    case "non_compliant":
      return "NON_COMPLIANT";
    case "manual_review":
      return "MANUAL_REVIEW_REQUIRED";
    case "rescan_required":
      return "RESCAN_REQUIRED";
    case "partially_verified":
      return "PARTIALLY_VERIFIED";
    case "insufficient_evidence":
      return "INSUFFICIENT_EVIDENCE";
    default:
      return "NOT_APPLICABLE";
  }
}

export function resultToken(result: string): string {
  switch (result) {
    case "pass":
      return "PASS";
    case "fail":
      return "FAIL";
    case "manual_review":
      return "MANUAL_REVIEW_REQUIRED";
    case "rescan_required":
      return "RESCAN_REQUIRED";
    case "insufficient_evidence":
      return "INSUFFICIENT_EVIDENCE";
    default:
      return "NOT_APPLICABLE";
  }
}

export function prettyStatus(status: string | null | undefined): string {
  return (status ?? "—").replaceAll("_", " ");
}
