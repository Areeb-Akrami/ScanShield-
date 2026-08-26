import { useSession } from "@/components/AppShell";
import { Button, Field, Panel, PanelHeader, inputClass } from "@/components/ui";
import { audit, listAudit } from "@/lib/store";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/consumer/complaints")({
  head: () => ({
    meta: [
      { title: "Raise a complaint — ScanShield" },
      { name: "description", content: "Report a suspected labelling problem on a packaged commodity for verification by an authorised officer." },
      { property: "og:title", content: "Raise a complaint — ScanShield" },
      { property: "og:description", content: "Submit a packaged-goods labelling complaint with shop details." },
    ],
  }),
  component: ComplaintsPage,
});

function ComplaintsPage() {
  const session = useSession();
  const [shop, setShop] = useState("");
  const [product, setProduct] = useState("");
  const [detail, setDetail] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  const [mine, setMine] = useState<ReturnType<typeof listAudit>>([]);

  useEffect(() => {
    setMine(listAudit().filter((a) => a.action === "COMPLAINT_SUBMITTED"));
  }, [sent]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const ref = `CMP-${Date.now().toString().slice(-6)}`;
    audit({
      user: session?.email ?? "consumer",
      action: "COMPLAINT_SUBMITTED",
      entity: "Complaint",
      entityId: ref,
      before: null,
      after: `${product} @ ${shop} — ${detail}`,
    });
    setSent(ref);
    setShop("");
    setProduct("");
    setDetail("");
  }

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeader title="Raise a complaint" subtitle="Complaints are queued for verification. No action is taken on a report alone." />
        <form onSubmit={submit} className="space-y-3 p-4">
          <Field label="Shop / seller">
            <input required value={shop} onChange={(e) => setShop(e.target.value)} className={inputClass()} />
          </Field>
          <Field label="Product">
            <input required value={product} onChange={(e) => setProduct(e.target.value)} className={inputClass()} />
          </Field>
          <Field label="What looked wrong">
            <textarea required value={detail} onChange={(e) => setDetail(e.target.value)} className={inputClass("min-h-24")} />
          </Field>
          <Button type="submit">Submit complaint</Button>
          {sent ? (
            <p className="rounded-md bg-pass/10 px-3 py-2 text-xs text-pass">
              Complaint recorded with reference {sent}. An officer will verify the pack physically.
            </p>
          ) : null}
        </form>
      </Panel>

      <Panel>
        <PanelHeader title="Complaints recorded on this device" />
        {mine.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No complaints submitted yet.</p>
        ) : (
          <ul className="divide-y divide-border text-xs">
            {mine.map((a) => (
              <li key={a.id} className="px-4 py-2.5">
                <span className="font-mono">{a.entityId}</span>{" "}
                <span className="text-muted-foreground">· {new Date(a.timestamp).toLocaleString()}</span>
                <p className="mt-0.5">{a.after}</p>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
