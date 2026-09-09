import { ConsumerResult } from "@/components/ConsumerResult";
import { checkImageUrl, getMyCheck, type ConsumerCheckPayload, type ConsumerCheckRow } from "@/lib/consumer";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/consumer/check/$id")({
  head: () => ({
    meta: [
      { title: "Check result — ScanShield" },
      { name: "description", content: "The saved result of a package check you ran with ScanShield." },
      { property: "og:title", content: "Check result — ScanShield" },
      { property: "og:description", content: "Saved package compliance result." },
    ],
  }),
  component: CheckDetail,
});

function CheckDetail() {
  const { id } = Route.useParams();
  const [row, setRow] = useState<ConsumerCheckRow | null | "missing">(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void getMyCheck(id).then(async (r) => {
      if (!active) return;
      setRow(r ?? "missing");
      if (r?.package_image_url) {
        const url = await checkImageUrl(r.package_image_url);
        if (active) setImageUrl(url);
      }
    });
    return () => {
      active = false;
    };
  }, [id]);

  return (
    <div className="space-y-4">
      <Link to="/consumer/checks" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> My checks
      </Link>
      {row === null ? (
        <p className="text-sm text-muted-foreground">Loading result…</p>
      ) : row === "missing" ? (
        <p className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground shadow-sm">
          This check is not available on your account.
        </p>
      ) : (
        <ConsumerResult
          payload={row.findings as ConsumerCheckPayload}
          status={row.status ?? "MANUAL_REVIEW_REQUIRED"}
          confidence={row.confidence}
          createdAt={row.created_at}
          imageUrl={imageUrl}
        />
      )}
    </div>
  );
}
