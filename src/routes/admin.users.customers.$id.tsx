import { Button, Panel, PanelHeader, StatusPill } from "@/components/ui";
import {
  customerChecks,
  customerComplaints,
  getUser,
  setAccountStatus,
  userActivity,
  type ManagedUser,
} from "@/lib/admin-users";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";

export const Route = createFileRoute("/admin/users/customers/$id")({
  head: () => ({
    meta: [
      { title: "Customer account — ScanShield admin" },
      {
        name: "description",
        content:
          "Customer profile, package check history, complaints and account status administration in ScanShield.",
      },
      { property: "og:title", content: "Customer account — ScanShield admin" },
      { property: "og:description", content: "Customer account administration for ScanShield." },
    ],
  }),
  component: CustomerDetail,
});

/** Compact, read-only summary of a stored consumer check result. */
function CheckFindings({ findings }: { findings: unknown }) {
  const list = Array.isArray(findings) ? findings : [];
  if (list.length === 0)
    return <p className="text-xs text-muted-foreground">No stored declaration findings for this check.</p>;
  return (
    <ul className="space-y-1 text-xs">
      {list.slice(0, 40).map((f, i) => {
        const row = (f ?? {}) as Record<string, unknown>;
        const label = String(row["title"] ?? row["ruleKey"] ?? row["rule_key"] ?? row["field"] ?? "Finding");
        const result = String(row["result"] ?? row["status"] ?? "—").replaceAll("_", " ").toLowerCase();
        const reason = row["reason"] ?? row["detail"];
        return (
          <li key={i} className="flex flex-wrap justify-between gap-2">
            <span>{label}</span>
            <span className="text-muted-foreground">
              {result}
              {reason ? ` — ${String(reason)}` : ""}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function CustomerDetail() {
  const { id } = Route.useParams();
  const [user, setUser] = useState<ManagedUser | null>(null);
  const [checks, setChecks] = useState<Awaited<ReturnType<typeof customerChecks>>>([]);
  const [complaints, setComplaints] = useState<Awaited<ReturnType<typeof customerComplaints>>>([]);
  const [activity, setActivity] = useState<Awaited<ReturnType<typeof userActivity>>>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [openCheck, setOpenCheck] = useState<string | null>(null);
  const [openComplaint, setOpenComplaint] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [u, c, k, a] = await Promise.all([
      getUser(id),
      customerChecks(id),
      customerComplaints(id),
      userActivity(id),
    ]);
    setUser(u);
    setChecks(c);
    setComplaints(k);
    setActivity(a);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function change(status: "active" | "suspended" | "deactivated") {
    if (!user) return;
    const verb = status === "active" ? "Restore" : status === "suspended" ? "Suspend" : "Deactivate";
    if (!window.confirm(`${verb} this customer account?`)) return;
    const { error } = await setAccountStatus(user.id, status, "customer");
    setMessage(error ?? `Account ${status}.`);
    void load();
  }

  if (loading) return <Panel className="p-4 text-sm text-muted-foreground">Loading customer…</Panel>;
  if (!user) return <Panel className="p-4 text-sm text-muted-foreground">This customer account was not found.</Panel>;

  return (
    <div className="space-y-4">
      <Link to="/admin/users/customers" className="text-sm underline underline-offset-2">
        ← All customers
      </Link>
      {message ? <Panel className="p-3 text-sm">{message}</Panel> : null}

      <Panel>
        <PanelHeader title={user.full_name ?? "Customer"} subtitle={user.email ?? "—"} />
        <dl className="grid gap-3 p-4 text-sm sm:grid-cols-3">
          <div><dt className="label-caps">Phone</dt><dd>{user.phone ?? "—"}</dd></div>
          <div><dt className="label-caps">District</dt><dd>{user.district ?? "—"}</dd></div>
          <div><dt className="label-caps">Account status</dt><dd>{user.account_status}</dd></div>
          <div><dt className="label-caps">Created</dt><dd>{new Date(user.created_at).toLocaleString()}</dd></div>
        </dl>
        <div className="flex flex-wrap gap-2 border-t border-border p-4">
          {user.account_status !== "suspended" ? <Button variant="ghost" onClick={() => void change("suspended")}>Suspend</Button> : null}
          {user.account_status !== "active" ? <Button onClick={() => void change("active")}>Restore</Button> : null}
          {user.account_status !== "deactivated" ? <Button variant="ghost" onClick={() => void change("deactivated")}>Deactivate</Button> : null}
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Package checks" subtitle={`${checks.length} recorded`} />
        {checks.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">This customer has not checked a package yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {checks.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                <span>{c.product_name ?? "—"}</span>
                <span className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleString()}</span>
                  <StatusPill token={(c.status ?? "MANUAL_REVIEW_REQUIRED") as never} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel>
        <PanelHeader title="Complaints" subtitle={`${complaints.length} submitted`} />
        {complaints.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No complaints from this customer.</p>
        ) : (
          <ul className="divide-y divide-border">
            {complaints.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                <span>
                  <span className="font-medium">{c.product}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{c.issue_type}</span>
                </span>
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Ref {c.id.slice(0, 8).toUpperCase()}</span>
                  <span>{c.status}</span>
                  <span>{new Date(c.created_at).toLocaleDateString()}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel>
        <PanelHeader title="Recent activity" />
        {activity.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No recorded account activity.</p>
        ) : (
          <ul className="divide-y divide-border">
            {activity.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-xs">
                <span className="font-medium">{a.action.replaceAll("_", " ")}</span>
                <span className="text-muted-foreground">{new Date(a.created_at).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
