import { Button, Panel, PanelHeader, StatusPill, inputClass } from "@/components/ui";
import {
  getCase,
  openStored,
  prettyStatus,
  resultToken,
  statusToken,
  submitDecision,
  type CaseDetail,
  type DecisionType,
} from "@/lib/officer";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/officer/cases/$id")({
  head: () => ({
    meta: [
      { title: "Case file — ScanShield" },
      { name: "description", content: "Evidence, extracted declarations, rule findings and the enforcement decision history for one inspection." },
      { property: "og:title", content: "Case file — ScanShield" },
      { property: "og:description", content: "Evidence, rule findings and decision history for one inspection." },
    ],
  }),
  component: CaseFile,
});

const ACTIONS: Array<{ key: DecisionType; label: string; variant?: "primary" | "outline" | "danger" }> = [
  { key: "confirm_compliant", label: "Confirm compliant" },
  { key: "confirm_non_compliant", label: "Confirm violation" },
  { key: "request_rescan", label: "Request rescan" },
  { key: "send_for_review", label: "Send for review" },
];

function CaseFile() {
  const { id } = Route.useParams();
  const [detail, setDetail] = useState<CaseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<DecisionType | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [image, setImage] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    void getCase(id).then((d) => {
      setDetail(d);
      setLoading(false);
      void openStored("package-images", d?.package_image_url ?? null).then(setImage);
    });
  };

  useEffect(load, [id]);

  async function act(decision: DecisionType) {
    if (!detail) return;
    setBusy(decision);
    setMessage(null);
    const res = await submitDecision(detail.id, decision, note.trim(), detail.status);
    setBusy(null);
    if (res.error) {
      setMessage(res.error);
      return;
    }
    setNote("");
    setMessage("Decision recorded.");
    load();
  }

  if (loading) return <p className="p-4 text-sm text-muted-foreground">Loading case file…</p>;
  if (!detail) return <p className="p-4 text-sm text-muted-foreground">This case is not available to your account.</p>;

  const failures = detail.checks.filter((c) => c.result === "fail");
  const reviews = detail.checks.filter((c) => c.result === "manual_review" || c.result === "insufficient_evidence");
  const passes = detail.checks.filter((c) => c.result === "pass");

  return (
    <div className="space-y-4">
      <Link to="/officer/review" className="text-xs text-muted-foreground hover:underline">
        ← Back to review queue
      </Link>

      <Panel>
        <PanelHeader
          title={detail.product_name ?? "Unnamed product"}
          subtitle={`${detail.seller_name ?? "Unknown seller"} · ${detail.district ?? "—"} · ${new Date(detail.inspection_date).toLocaleString()}`}
          right={<StatusPill token={statusToken(detail.status)} />}
        />
        <dl className="divide-y divide-border text-sm">
          {[
            ["System evaluation", prettyStatus(detail.system_status ?? detail.status)],
            ["Extraction confidence", detail.confidence != null ? `${Math.round(Number(detail.confidence) * 100)}%` : "—"],
            ["Inspector", detail.inspector ?? "—"],
            ["Case reference", detail.local_id ?? detail.id],
            [
              "Geo-tag",
              detail.latitude != null && detail.longitude != null
                ? `${Number(detail.latitude).toFixed(5)}, ${Number(detail.longitude).toFixed(5)}`
                : "Not recorded",
            ],
          ].map(([k, v]) => (
            <div key={String(k)} className="flex justify-between gap-4 px-4 py-2.5">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="text-right font-medium">{v}</dd>
            </div>
          ))}
        </dl>
      </Panel>

      {image ? (
        <Panel>
          <PanelHeader title="Package evidence" subtitle="Captured panel stored in the private evidence bucket." />
          <div className="p-4">
            <img src={image} alt={`Package photograph for ${detail.product_name ?? "inspection"}`} loading="lazy" className="w-full rounded-md border border-border" />
          </div>
        </Panel>
      ) : null}

      <Panel>
        <PanelHeader title="Extracted declarations" subtitle="Values read from the package during inspection." />
        {detail.ocr.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No extraction records stored for this case.</p>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {detail.ocr.map((o) => (
              <li key={o.id} className="flex items-start justify-between gap-4 px-4 py-2.5">
                <span className="text-muted-foreground">{o.field_name.replaceAll("_", " ")}</span>
                <span className="text-right">
                  <span className="block font-medium">{o.detected_value ?? "Not detected"}</span>
                  <span className="block text-xs text-muted-foreground">
                    {o.status ?? "—"}
                    {o.confidence != null ? ` · ${Math.round(Number(o.confidence) * 100)}%` : ""}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel>
        <PanelHeader
          title="Rule findings"
          subtitle={`${failures.length} failed · ${reviews.length} need review · ${passes.length} passed`}
        />
        {detail.checks.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No rule findings stored for this case.</p>
        ) : (
          <ul className="divide-y divide-border">
            {[...failures, ...reviews, ...passes].map((c) => (
              <li key={c.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{c.rule_title ?? c.rule_key ?? "Rule"}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.rule_number ? `Rule ${c.rule_number} · ` : ""}
                      {c.rule_key}
                      {c.rule_version ? ` · v${c.rule_version}` : ""}
                    </p>
                  </div>
                  <StatusPill token={resultToken(c.result)} />
                </div>
                {c.reason ? <p className="mt-1.5 text-xs text-muted-foreground">{c.reason}</p> : null}
                {c.evidence ? <p className="mt-1 text-xs text-muted-foreground italic">{c.evidence}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel>
        <PanelHeader title="Record decision" subtitle="Stored in the immutable decision log with an audit entry." />
        <div className="space-y-3 p-4">
          <textarea
            className={inputClass("min-h-20")}
            placeholder="Decision note (optional but recommended)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            {ACTIONS.map((a) => (
              <Button key={a.key} variant="outline" disabled={busy !== null} onClick={() => void act(a.key)}>
                {busy === a.key ? "Saving…" : a.label}
              </Button>
            ))}
          </div>
          {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Decision history" />
        {detail.decisions.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No decision has been recorded for this case yet.</p>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {detail.decisions.map((d) => (
              <li key={d.id} className="px-4 py-2.5">
                <span className="font-medium">{prettyStatus(d.decision)}</span>{" "}
                <span className="text-muted-foreground">
                  · {d.officer ?? "officer"} · {new Date(d.created_at).toLocaleString()}
                </span>
                {d.note ? <p className="mt-1 text-xs text-muted-foreground">{d.note}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
