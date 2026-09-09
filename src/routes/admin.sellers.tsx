import { Button, Panel, PanelHeader, StatusPill } from "@/components/ui";
import { listDbSellers, setSellerStatus, type DbSeller } from "@/lib/db";
import { useSession } from "@/components/AppShell";
import { listInspections, sellerProfiles, type SellerProfile } from "@/lib/store";
import { hydrateInspections } from "@/lib/store";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/admin/sellers")({
  head: () => ({
    meta: [
      { title: "Seller risk register — ScanShield" },
      { name: "description", content: "Seller compliance history and explainable risk scoring based on recorded inspection outcomes." },
      { property: "og:title", content: "Seller risk register — ScanShield" },
      { property: "og:description", content: "Explainable seller risk scoring from inspection history." },
    ],
  }),
  component: SellersPage,
});

function SellersPage() {
  const [profiles, setProfiles] = useState<SellerProfile[]>([]);
  const [inspections, setInspections] = useState(() => [] as ReturnType<typeof listInspections>);

  useEffect(() => {
    setProfiles(sellerProfiles());
    void hydrateInspections().then(setInspections);
  }, []);

  return (
    <div className="space-y-4">
      <RegisteredSellers />

      {profiles.length === 0 ? (
        <Panel className="p-4 text-sm text-muted-foreground">No sellers on record yet.</Panel>
      ) : (
        profiles.map((s) => (
          <Panel key={s.name}>
            <PanelHeader
              title={s.name}
              subtitle={`${s.district} · ${s.inspections} inspection(s) · last ${s.lastInspection ? new Date(s.lastInspection).toLocaleDateString() : "—"}`}
              action={<StatusPill token={s.risk} label={`${s.risk.toLowerCase()} risk`} />}
            />
            <div className="p-4">
              <p className="label-caps">Why this score</p>
              <ul className="mt-1 list-disc pl-5 text-xs text-muted-foreground">
                {s.reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
              <p className="label-caps mt-3">Inspection history</p>
              <ul className="mt-1 divide-y divide-border">
                {inspections
                  .filter((i) => i.seller === s.name)
                  .map((i) => (
                    <li key={i.localId} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <Link
                        to="/inspector/inspections/$id"
                        params={{ id: i.localId }}
                        className="min-w-0 truncate text-accent underline underline-offset-2"
                      >
                        {i.productName}
                      </Link>
                      <span className="flex items-center gap-2 text-xs text-muted-foreground">
                        {new Date(i.createdAt).toLocaleDateString()}
                        <StatusPill token={i.finalStatus} />
                      </span>
                    </li>
                  ))}
              </ul>
            </div>
          </Panel>
        ))
      )}
    </div>
  );
}

function riskToken(score: number) {
  if (score >= 0.66) return "HIGH";
  if (score >= 0.33) return "MEDIUM";
  return "LOW";
}

/** Sellers held in the central register, with their recorded risk and status. */
function RegisteredSellers() {
  const session = useSession();
  const isAdmin = session?.role === "ADMIN";
  const [rows, setRows] = useState<DbSeller[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = () => void listDbSellers().then(setRows);
  useEffect(load, []);

  async function toggle(seller: DbSeller) {
    setBusy(seller.id);
    await setSellerStatus(seller.id, seller.status === "flagged" ? "active" : "flagged");
    setBusy(null);
    load();
  }

  return (
    <Panel>
      <PanelHeader title={`Registered sellers (${rows.length})`} subtitle="Held in the central database." />
      {rows.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">No sellers are registered yet.</p>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">{s.name}</p>
                <p className="text-xs text-muted-foreground">
                  {[s.district, s.state].filter(Boolean).join(", ") || "Location not recorded"}
                  {s.contact_phone ? ` · ${s.contact_phone}` : ""}
                </p>
              </div>
              <span className="flex items-center gap-2">
                <StatusPill token={riskToken(Number(s.risk_score))} label={`risk ${Number(s.risk_score).toFixed(2)}`} />
                <StatusPill token={s.status === "flagged" ? "FAIL" : "PASS"} label={s.status} />
                {isAdmin ? (
                  <Button size="sm" variant="outline" disabled={busy === s.id} onClick={() => void toggle(s)}>
                    {s.status === "flagged" ? "Clear flag" : "Flag"}
                  </Button>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
