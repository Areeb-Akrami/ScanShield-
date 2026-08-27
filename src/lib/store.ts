import { deriveFinalStatus, evaluateCompliance, type FinalStatus } from "@/legal/engine";
import type { CheckOutcome, InspectionClassification, RuleCheckResult } from "@/legal/types";
import { aggregateConfidence, readabilityVerdict, runAiAnalysis } from "@/pipeline/analysis";
import { SCENARIOS } from "@/pipeline/scenarios";
import { toEvidenceMap, type AiFinding, type CapturedImage, type ExtractedField } from "@/pipeline/types";

export type SyncStatus = "OFFLINE" | "PENDING_SYNC" | "SYNCING" | "SYNCED" | "SYNC_FAILED";
export type InspectorDecision = "CONFIRM" | "REJECT" | "EDIT" | "REQUEST_RESCAN" | "MARK_NOT_APPLICABLE";

export interface GeoTag {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  capturedAt: string;
  status: "CAPTURED" | "PERMISSION_DENIED" | "UNAVAILABLE" | "NOT_ATTEMPTED";
  note?: string;
}

export interface Inspection {
  localId: string;
  serverId: string | null;
  scenarioId: string | null;
  isDemo: boolean;
  inspectorId: string;
  inspectorName: string;
  seller: string;
  district: string;
  productName: string;
  classification: InspectionClassification;
  images: CapturedImage[];
  fields: ExtractedField[];
  findings: AiFinding[];
  tally: Record<CheckOutcome, number>;
  finalStatus: FinalStatus;
  inspectorDecision: InspectorDecision | null;
  decisionNote: string;
  confidence: number;
  readability: string;
  geo: GeoTag;
  createdAt: string;
  updatedAt: string;
  syncStatus: SyncStatus;
  retryCount: number;
  lastError: string | null;
  /** Offline-first: OCR may still be queued when the record was created without connectivity. */
  extractionStatus?: ExtractionStatus;
  extractionError?: string | null;
  /** Enforcement override recorded from the admin panel. */
  systemStatus?: FinalStatus;
  overrideStatus?: FinalStatus | null;
  overrideNote?: string;
  overrideBy?: string;
  overrideAt?: string;
}

export type ExtractionStatus = "COMPLETE" | "PENDING_OCR" | "OCR_FAILED";

export interface AuditEntry {
  id: string;
  user: string;
  action: string;
  entity: string;
  entityId: string;
  before: string | null;
  after: string | null;
  timestamp: string;
}

const INSPECTIONS_KEY = "scanshield.inspections";
const AUDIT_KEY = "scanshield.audit";
const OCR_QUEUE_KEY = "scanshield.ocrqueue";

/* ------------------------------------------------------------------ */
/* Persistence (local-first; the sync queue models the server hand-off) */
/* ------------------------------------------------------------------ */

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

export function listInspections(): Inspection[] {
  const stored = read<Inspection[]>(INSPECTIONS_KEY, []);
  return [...stored].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getInspection(localId: string): Inspection | undefined {
  return listInspections().find((i) => i.localId === localId);
}

export function saveInspection(inspection: Inspection): void {
  const all = read<Inspection[]>(INSPECTIONS_KEY, []);
  const idx = all.findIndex((i) => i.localId === inspection.localId);
  if (idx >= 0) all[idx] = inspection;
  else all.push(inspection);
  write(INSPECTIONS_KEY, all);
}

export function listAudit(): AuditEntry[] {
  return read<AuditEntry[]>(AUDIT_KEY, []).slice().reverse();
}

export function audit(entry: Omit<AuditEntry, "id" | "timestamp">): void {
  const all = read<AuditEntry[]>(AUDIT_KEY, []);
  all.push({ ...entry, id: `AUD-${all.length + 1}-${Date.now()}`, timestamp: new Date().toISOString() });
  write(AUDIT_KEY, all.slice(-500));
}

/* ------------------------------------------------------------------ */
/* Pipeline orchestration                                              */
/* ------------------------------------------------------------------ */

export interface PipelineOutput {
  results: RuleCheckResult[];
  tally: Record<CheckOutcome, number>;
  finalStatus: FinalStatus;
  findings: AiFinding[];
  confidence: number;
  readability: string;
  rulesInForce: number;
}

export function runPipeline(
  classification: InspectionClassification,
  fields: ExtractedField[],
  images: CapturedImage[],
  reference: Parameters<typeof runAiAnalysis>[2],
): PipelineOutput {
  const evaluation = evaluateCompliance(classification, toEvidenceMap(fields));
  const findings = runAiAnalysis(fields, images, reference);
  const { score } = aggregateConfidence(fields);
  return {
    results: evaluation.results,
    tally: evaluation.tally,
    finalStatus: deriveFinalStatus(evaluation.tally),
    findings,
    confidence: score,
    readability: readabilityVerdict(images),
    rulesInForce: evaluation.rulesInForce,
  };
}

export function evaluateStored(inspection: Inspection): PipelineOutput {
  const scenario = SCENARIOS.find((s) => s.id === inspection.scenarioId);
  return runPipeline(
    inspection.classification,
    inspection.fields,
    inspection.images,
    scenario?.reference ?? null,
  );
}

/* ------------------------------------------------------------------ */
/* Sync queue                                                          */
/* ------------------------------------------------------------------ */

export function queueForSync(localId: string, user: string): void {
  const insp = getInspection(localId);
  if (!insp) return;
  const online = typeof navigator !== "undefined" ? navigator.onLine : true;
  insp.syncStatus = online ? "PENDING_SYNC" : "OFFLINE";
  insp.updatedAt = new Date().toISOString();
  saveInspection(insp);
  audit({ user, action: "SYNC_QUEUED", entity: "Inspection", entityId: localId, before: null, after: insp.syncStatus });
}

export function processSyncQueue(user: string): number {
  const all = read<Inspection[]>(INSPECTIONS_KEY, []);
  let moved = 0;
  const online = typeof navigator !== "undefined" ? navigator.onLine : true;
  for (const insp of all) {
    if (insp.syncStatus === "PENDING_SYNC" || insp.syncStatus === "OFFLINE" || insp.syncStatus === "SYNC_FAILED") {
      if (!online) {
        insp.syncStatus = "OFFLINE";
        continue;
      }
      insp.syncStatus = "SYNCED";
      insp.serverId = insp.serverId ?? `SS-${insp.localId.slice(-6).toUpperCase()}`;
      insp.updatedAt = new Date().toISOString();
      insp.lastError = null;
      moved += 1;
      audit({ user, action: "SYNC_COMPLETED", entity: "Inspection", entityId: insp.localId, before: "PENDING_SYNC", after: "SYNCED" });
    }
  }
  write(INSPECTIONS_KEY, all);
  return moved;
}

/* ------------------------------------------------------------------ */
/* Seller profiles + risk engine                                       */
/* ------------------------------------------------------------------ */

export interface SellerProfile {
  name: string;
  district: string;
  inspections: number;
  nonCompliant: number;
  manualReview: number;
  lastInspection: string | null;
  risk: "LOW" | "MEDIUM" | "HIGH";
  reasons: string[];
}

export function sellerProfiles(): SellerProfile[] {
  const byName = new Map<string, Inspection[]>();
  for (const i of listInspections()) {
    const list = byName.get(i.seller) ?? [];
    list.push(i);
    byName.set(i.seller, list);
  }

  return [...byName.entries()].map(([name, list]) => {
    const nonCompliant = list.filter((i) => i.finalStatus === "NON_COMPLIANT").length;
    const manualReview = list.filter((i) => i.finalStatus === "MANUAL_REVIEW_REQUIRED").length;
    const recent = list.slice(0, 5);
    const recentNonCompliant = recent.filter((i) => i.finalStatus === "NON_COMPLIANT").length;

    const reasons: string[] = [];
    let points = 0;
    if (recentNonCompliant > 0) {
      points += recentNonCompliant * 2;
      reasons.push(`${recentNonCompliant} non-compliant result(s) in the last ${recent.length} inspection(s)`);
    }
    if (nonCompliant > 1) {
      points += 2;
      reasons.push(`${nonCompliant} non-compliant results on record — repeat pattern`);
    }
    if (manualReview > 0) {
      points += manualReview;
      reasons.push(`${manualReview} inspection(s) awaiting manual review`);
    }
    if (reasons.length === 0) reasons.push("No non-compliant results recorded on any inspection.");

    const risk: SellerProfile["risk"] = points >= 5 ? "HIGH" : points >= 2 ? "MEDIUM" : "LOW";

    return {
      name,
      district: list[0]?.district ?? "—",
      inspections: list.length,
      nonCompliant,
      manualReview,
      lastInspection: list[0]?.createdAt ?? null,
      risk,
      reasons,
    };
  });
}

/* ------------------------------------------------------------------ */
/* Offline OCR queue                                                   */
/* ------------------------------------------------------------------ */

export interface OcrQueueImage {
  key: string;
  label: string;
  dataUrl: string;
}

export interface OcrJob {
  localId: string;
  images: OcrQueueImage[];
  queuedAt: string;
  attempts: number;
  lastError: string | null;
}

export function listOcrJobs(): OcrJob[] {
  return read<OcrJob[]>(OCR_QUEUE_KEY, []);
}

export function enqueueOcrJob(localId: string, images: OcrQueueImage[]): void {
  const all = listOcrJobs().filter((j) => j.localId !== localId);
  all.push({ localId, images, queuedAt: new Date().toISOString(), attempts: 0, lastError: null });
  write(OCR_QUEUE_KEY, all);
}

export function removeOcrJob(localId: string): void {
  write(OCR_QUEUE_KEY, listOcrJobs().filter((j) => j.localId !== localId));
}

export function markOcrJobFailed(localId: string, message: string): void {
  const all = listOcrJobs().map((j) =>
    j.localId === localId ? { ...j, attempts: j.attempts + 1, lastError: message } : j,
  );
  write(OCR_QUEUE_KEY, all);
  const insp = getInspection(localId);
  if (insp) {
    insp.extractionStatus = "OCR_FAILED";
    insp.extractionError = message;
    insp.updatedAt = new Date().toISOString();
    saveInspection(insp);
  }
}

/** Applies OCR output to a queued inspection, re-runs the rule engine and stores the result. */
export function applyExtraction(
  localId: string,
  fields: ExtractedField[],
  classification: InspectionClassification,
  productName: string,
): Inspection | undefined {
  const insp = getInspection(localId);
  if (!insp) return undefined;
  const output = runPipeline(classification, fields, insp.images, null);
  const updated: Inspection = {
    ...insp,
    classification,
    fields,
    productName,
    findings: output.findings,
    tally: output.tally,
    finalStatus: output.finalStatus,
    confidence: output.confidence,
    readability: output.readability,
    extractionStatus: "COMPLETE",
    extractionError: null,
    syncStatus: insp.syncStatus === "SYNCED" ? "PENDING_SYNC" : insp.syncStatus,
    updatedAt: new Date().toISOString(),
  };
  saveInspection(updated);
  return updated;
}

export function pendingWorkCount(): { ocr: number; sync: number } {
  const inspections = listInspections();
  return {
    ocr: listOcrJobs().length,
    sync: inspections.filter((i) => i.syncStatus !== "SYNCED").length,
  };
}

/* ------------------------------------------------------------------ */
/* Enforcement override (admin panel)                                  */
/* ------------------------------------------------------------------ */

/**
 * Records an enforcement decision that supersedes the rule-engine outcome for
 * reporting purposes. The original engine result is preserved in `systemStatus`
 * and every change is written to the audit trail.
 */
export function overrideFinalStatus(
  localId: string,
  status: FinalStatus | null,
  note: string,
  user: string,
): Inspection | undefined {
  const insp = getInspection(localId);
  if (!insp) return undefined;
  const system = insp.systemStatus ?? insp.finalStatus;
  const before = insp.finalStatus;
  const updated: Inspection = {
    ...insp,
    systemStatus: system,
    overrideStatus: status,
    overrideNote: note,
    overrideBy: status ? user : "",
    overrideAt: status ? new Date().toISOString() : "",
    finalStatus: status ?? system,
    syncStatus: insp.syncStatus === "SYNCED" ? "PENDING_SYNC" : insp.syncStatus,
    updatedAt: new Date().toISOString(),
  };
  saveInspection(updated);
  audit({
    user,
    action: status ? "ENFORCEMENT_OVERRIDE" : "ENFORCEMENT_OVERRIDE_CLEARED",
    entity: "Inspection",
    entityId: localId,
    before,
    after: `${updated.finalStatus}${note ? ` — ${note}` : ""}`,
  });
  return updated;
}
