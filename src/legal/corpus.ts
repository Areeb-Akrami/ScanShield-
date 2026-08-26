import rulesDoc from "../../legal_engine/rules.json";
import exemptionsDoc from "../../legal_engine/exemptions.json";
import versionsDoc from "../../legal_engine/rule_versions.json";
import categoriesDoc from "../../legal_engine/product_categories.json";
import sourcesDoc from "../../legal_engine/rule_sources.json";
import type { Exemption, LegalRule, MachineCheckability, VersionChain } from "./types";

export const RULES = rulesDoc.rules as unknown as LegalRule[];
export const EXEMPTIONS = exemptionsDoc.exemptions as unknown as Exemption[];
export const VERSION_CHAINS = versionsDoc.versions as unknown as VersionChain[];
export const PRODUCT_CATEGORIES = categoriesDoc.product_categories;
export const PACKAGE_TYPES = categoriesDoc.package_types;
export const TRANSACTION_CONTEXTS = categoriesDoc.transaction_contexts;
export const ORIGIN_CONTEXTS = categoriesDoc.origin_contexts;
export const SOURCE_DOCUMENTS = sourcesDoc.expected_documents;
export const CORPUS_STATE = sourcesDoc.corpus_state as "AWAITING_INGESTION" | "INGESTED";
export const CORPUS_NOTE = sourcesDoc.corpus_note;

export function sourceTitle(sourceId: string): string {
  return SOURCE_DOCUMENTS.find((s) => s.source_id === sourceId)?.title ?? sourceId;
}

export function ruleById(ruleId: string): LegalRule | undefined {
  return RULES.find((r) => r.rule_id === ruleId);
}

export function chainForRule(ruleId: string): VersionChain | undefined {
  return VERSION_CHAINS.find((c) => c.entries.some((e) => e.rule_id === ruleId));
}

export interface CorpusStatistics {
  sourceDocuments: number;
  sourcesIngested: number;
  provisions: number;
  versionChains: number;
  exemptions: number;
  productCategories: number;
  packageTypes: number;
  byCheckability: Record<MachineCheckability, number>;
  humanOrDocumentary: number;
  machineCheckable: number;
  aiAssisted: number;
}

export function corpusStatistics(asOf: string): CorpusStatistics & {
  current: number;
  future: number;
  superseded: number;
} {
  const byCheckability = {
    FULLY_MACHINE_CHECKABLE: 0,
    AI_ASSISTED: 0,
    PARTIALLY_MACHINE_CHECKABLE: 0,
    HUMAN_INSPECTION_REQUIRED: 0,
    DOCUMENTARY_CHECK_REQUIRED: 0,
    NOT_RELEVANT_TO_IMAGE_SCAN: 0,
  } as Record<MachineCheckability, number>;

  let current = 0;
  let future = 0;
  let superseded = 0;

  for (const rule of RULES) {
    byCheckability[rule.machine_checkability] += 1;
    if (rule.effective_from > asOf) future += 1;
    else if (rule.effective_to && rule.effective_to < asOf) superseded += 1;
    else current += 1;
  }

  return {
    sourceDocuments: SOURCE_DOCUMENTS.length,
    sourcesIngested: SOURCE_DOCUMENTS.filter((s) => s.ingested).length,
    provisions: RULES.length,
    versionChains: VERSION_CHAINS.length,
    exemptions: EXEMPTIONS.length,
    productCategories: PRODUCT_CATEGORIES.length,
    packageTypes: PACKAGE_TYPES.length,
    byCheckability,
    machineCheckable: byCheckability.FULLY_MACHINE_CHECKABLE,
    aiAssisted: byCheckability.AI_ASSISTED,
    humanOrDocumentary:
      byCheckability.HUMAN_INSPECTION_REQUIRED + byCheckability.DOCUMENTARY_CHECK_REQUIRED,
    current,
    future,
    superseded,
  };
}
