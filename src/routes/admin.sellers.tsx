import { Panel, PanelHeader, StatusPill } from "@/components/ui";
import { listInspections, sellerProfiles, type SellerProfile } from "@/lib/store";
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
    setInspections(listInspections());
  }, []);

  return (
    <div className="space-y-4">
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
