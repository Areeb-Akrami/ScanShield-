import { fileToDataUrl } from "@/lib/imaging";
import { ISSUE_TYPES, listMyComplaints, submitComplaint, type ComplaintRow } from "@/lib/consumer";
import { createFileRoute } from "@tanstack/react-router";
import { MessageSquarePlus, Paperclip } from "lucide-react";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/consumer/complaints")({
  head: () => ({
    meta: [
      { title: "Raise a complaint — ScanShield" },
      {
        name: "description",
        content: "Report a suspected labelling problem on a packaged commodity and follow the status of your report.",
      },
      { property: "og:title", content: "Raise a complaint — ScanShield" },
      { property: "og:description", content: "Submit and track a packaged-goods labelling complaint." },
    ],
  }),
  component: ComplaintsPage,
});

const STATUS_LABEL: Record<string, string> = {
  submitted: "Submitted",
  under_review: "Under review",
  resolved: "Resolved",
  closed: "Closed",
};

const inputCls =
  "w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30";

function ComplaintsPage() {
  const [open, setOpen] = useState(false);
  const [product, setProduct] = useState("");
  const [seller, setSeller] = useState("");
  const [issueType, setIssueType] = useState(ISSUE_TYPES[0]!);
  const [description, setDescription] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<ComplaintRow[] | null>(null);

  useEffect(() => {
    void listMyComplaints().then(setRows);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const result = await submitComplaint({ product, seller, issueType, description, imageDataUrl: image });
    setBusy(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setOpen(false);
    setProduct("");
    setSeller("");
    setDescription("");
    setImage(null);
    setRows(await listMyComplaints());
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold tracking-tight">Complaints</h1>
        {!open ? (
          <button
            onClick={() => setOpen(true)}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-foreground"
          >
            <MessageSquarePlus className="h-4 w-4" /> Raise a complaint
          </button>
        ) : null}
      </div>

      {open ? (
        <form onSubmit={submit} className="space-y-3 rounded-2xl border border-border bg-card p-5 shadow-sm">
          <label className="block text-sm font-medium">
            Product
            <input required value={product} onChange={(e) => setProduct(e.target.value)} className={`mt-1.5 ${inputCls}`} />
          </label>
          <label className="block text-sm font-medium">
            Shop / seller (optional)
            <input value={seller} onChange={(e) => setSeller(e.target.value)} className={`mt-1.5 ${inputCls}`} />
          </label>
          <label className="block text-sm font-medium">
            Issue type
            <select value={issueType} onChange={(e) => setIssueType(e.target.value)} className={`mt-1.5 ${inputCls}`}>
              {ISSUE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium">
            Description
            <textarea
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={`mt-1.5 min-h-24 ${inputCls}`}
            />
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
            <Paperclip className="h-4 w-4" />
            {image ? "Photo attached — choose another" : "Attach a photo (optional)"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) setImage(await fileToDataUrl(file));
              }}
            />
          </label>
          {image ? <img src={image} alt="Attached evidence" className="w-full rounded-xl object-contain" /> : null}
          {error ? <p className="text-sm text-fail">{error}</p> : null}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="min-h-11 flex-1 rounded-xl border border-border px-4 text-sm font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="min-h-11 flex-1 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-foreground disabled:opacity-60"
            >
              {busy ? "Submitting…" : "Submit complaint"}
            </button>
          </div>
        </form>
      ) : null}

      {rows === null ? (
        <p className="text-sm text-muted-foreground">Loading your complaints…</p>
      ) : rows.length === 0 ? (
        <p className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground shadow-sm">
          You have not raised a complaint yet. A complaint is checked by an authorised officer before any action is
          taken against a seller.
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((c) => (
            <li key={c.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold">{c.product}</p>
                <span className="rounded-full border border-border px-2.5 py-0.5 text-[11px] font-semibold">
                  {STATUS_LABEL[c.status] ?? c.status}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {c.issue_type} · {new Date(c.created_at).toLocaleDateString()}
              </p>
              <p className="mt-2 text-sm">{c.description}</p>
              <p className="mt-2 font-mono text-[11px] text-muted-foreground">Reference {c.id.slice(0, 8).toUpperCase()}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
