import { useSession } from "@/components/AppShell";
import { useOfflineSync } from "@/lib/offline-sync";

/** Offline-first status strip: shows queued OCR / sync work and drains it on reconnect. */
export function SyncBar() {
  const session = useSession();
  const { online, running, pending, message, runNow } = useOfflineSync(session?.email ?? "unknown");
  const queued = pending.ocr + pending.sync;

  if (online && queued === 0 && !running && !message) return null;

  return (
    <div
      className={`mb-4 flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-xs ${
        online ? "border-border bg-muted" : "border-review/40 bg-review/10 text-review-foreground"
      }`}
      role="status"
    >
      <span>
        {!online
          ? `Offline mode — ${pending.ocr} scan(s) awaiting OCR, ${pending.sync} record(s) awaiting sync. Work continues on this device.`
          : running
            ? "Processing queued scans and syncing records…"
            : queued > 0
              ? `${pending.ocr} queued scan(s) and ${pending.sync} record(s) ready to sync.`
              : (message ?? "")}
      </span>
      {online && !running && queued > 0 ? (
        <button
          onClick={() => void runNow()}
          className="rounded border border-border px-2 py-1 font-medium hover:bg-card"
        >
          Sync now
        </button>
      ) : null}
    </div>
  );
}
