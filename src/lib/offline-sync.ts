import { useCallback, useEffect, useRef, useState } from "react";
import {
  applyExtraction,
  audit,
  listOcrJobs,
  markOcrJobFailed,
  pendingWorkCount,
  processSyncQueue,
  removeOcrJob,
} from "@/lib/store";
import { mapVisionClassification, mapVisionFields, productNameOf } from "@/lib/ocr-mapping";
import { extractPackageFields } from "@/lib/vision.functions";

/**
 * Drains the offline work queues: first any OCR that could not run without
 * connectivity, then the inspection sync queue. Returns a human-readable summary.
 */
export async function drainOfflineQueues(user: string): Promise<{ ocr: number; synced: number; failed: number }> {
  let ocr = 0;
  let failed = 0;

  for (const job of listOcrJobs()) {
    try {
      const result = await extractPackageFields({
        data: { images: job.images.map((i) => ({ key: i.key, label: i.label, dataUrl: i.dataUrl })) },
      });
      const panels = new Set(job.images.map((i) => i.key));
      const fields = mapVisionFields(result, panels);
      const classification = mapVisionClassification(result);
      const updated = applyExtraction(job.localId, fields, classification, productNameOf(fields));
      removeOcrJob(job.localId);
      ocr += 1;
      audit({
        user,
        action: "OFFLINE_OCR_COMPLETED",
        entity: "Inspection",
        entityId: job.localId,
        before: "PENDING_OCR",
        after: updated ? updated.finalStatus : "COMPLETE",
      });
    } catch (e) {
      failed += 1;
      markOcrJobFailed(job.localId, e instanceof Error ? e.message : "Extraction failed while syncing.");
    }
  }

  const synced = processSyncQueue(user);
  return { ocr, synced, failed };
}

export function useOfflineSync(user: string) {
  const [online, setOnline] = useState(true);
  const [running, setRunning] = useState(false);
  const [pending, setPending] = useState({ ocr: 0, sync: 0 });
  const [message, setMessage] = useState<string | null>(null);
  const busy = useRef(false);

  const refresh = useCallback(() => setPending(pendingWorkCount()), []);

  const run = useCallback(async () => {
    if (busy.current || typeof navigator === "undefined" || !navigator.onLine) return;
    busy.current = true;
    setRunning(true);
    try {
      const { ocr, synced, failed } = await drainOfflineQueues(user);
      if (ocr || synced || failed) {
        setMessage(
          `${ocr} queued scan(s) processed · ${synced} record(s) synced${failed ? ` · ${failed} still pending` : ""}.`,
        );
      }
    } finally {
      busy.current = false;
      setRunning(false);
      refresh();
    }
  }, [user, refresh]);

  useEffect(() => {
    const update = () => {
      setOnline(navigator.onLine);
      refresh();
      if (navigator.onLine) void run();
    };
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    const timer = window.setInterval(update, 30000);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      window.clearInterval(timer);
    };
  }, [run, refresh]);

  return { online, running, pending, message, runNow: run, refresh };
}
