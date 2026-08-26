import { CORPUS_STATE } from "@/legal/corpus";

export function CorpusBanner({ compact = false }: { compact?: boolean }) {
  if (CORPUS_STATE !== "AWAITING_INGESTION") return null;
  return (
    <div className="rounded-md border border-demo/50 bg-demo/15 px-3 py-2 text-xs leading-relaxed text-demo-foreground">
      <span className="font-bold uppercase tracking-wide">Legal corpus not ingested — </span>
      {compact ? (
        <>rule text is provisional. Results are structural only.</>
      ) : (
        <>
          <code>/legal_sources/</code> was not present, so no official text has been loaded. Every rule
          record is <strong>PROVISIONAL_UNVERIFIED</strong> and verbatim requirement text is deliberately
          empty. The engine, effective-date logic and exemptions are fully functional; upload the official
          documents to populate them. No output here may be relied on as a legal determination.
        </>
      )}
    </div>
  );
}
