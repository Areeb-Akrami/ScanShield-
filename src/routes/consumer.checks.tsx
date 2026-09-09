import { listMyChecks, type ConsumerCheckRow } from "@/lib/consumer";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, ClipboardList } from "lucide-react";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/consumer/checks")({
  head: () => ({
    meta: [
      { title: "My checks — ScanShield" },
      { name: "description", content: "Every package check you have run, saved privately to your ScanShield account." },
      { property: "og:title", content: "My checks — ScanShield" },
      { property: "og:description", content: "Your saved package compliance checks." },
    ],
  }),
  component: MyChecks,
});

const TONE: Record<string, string> = {
  COMPLIANT: "border-pass/40 bg-pass/10 text-pass",
  NON_COMPLIANT: "border-fail/40 bg-fail/10 text-fail",
};
const LABEL: Record<string, string> = {
  COMPLIANT: "Compliant",
  NON_COMPLIANT: "Potential non-compliance",
};

function MyChecks() {
  const [rows, setRows] = useState<ConsumerCheckRow[] | null>(null);

  useEffect(() => {
    void listMyChecks().then(setRows);
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold tracking-tight">My checks</h1>
      {rows === null ? (
        <p className="text-sm text-muted-foreground">Loading your checks…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
          <ClipboardList className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">You have not checked a package yet.</p>
          <Link
            to="/consumer"
            className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-accent px-5 text-sm font-semibold text-accent-foreground"
          >
            Check a package
          </Link>
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.id}>
              <Link
                to="/consumer/check/$id"
                params={{ id: r.id }}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-sm transition hover:border-accent"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{r.product_name ?? "Unidentified product"}</p>
                  <p className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</p>
                </div>
                <span
                  className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
                    TONE[r.status ?? ""] ?? "border-review/50 bg-review/15 text-review-foreground"
                  }`}
                >
                  {LABEL[r.status ?? ""] ?? "Needs review"}
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
