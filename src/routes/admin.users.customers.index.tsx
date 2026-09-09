import { Panel, inputClass } from "@/components/ui";
import { listCustomers, setAccountStatus, type CustomerSummary } from "@/lib/admin-users";
import { cn } from "@/lib/utils";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/admin/users/customers/")({
  head: () => ({
    meta: [
      { title: "Customers — ScanShield admin" },
      { name: "description", content: "Customer accounts with package check and complaint counts, and account status administration." },
      { property: "og:title", content: "Customers — ScanShield admin" },
      { property: "og:description", content: "Customer account administration for ScanShield." },
    ],
  }),
  component: CustomersPage,
});

export function StatusTag({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[11px] font-medium",
        status === "active"
          ? "bg-pass/15 text-pass"
          : status === "suspended"
            ? "bg-review/20 text-review"
            : "bg-muted text-muted-foreground",
      )}
    >
      {status}
    </span>
  );
}

function CustomersPage() {
  const [rows, setRows] = useState<CustomerSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setRows(await listCustomers());
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  async function change(u: CustomerSummary, status: "active" | "suspended" | "deactivated") {
    const verb = status === "active" ? "Restore" : status === "suspended" ? "Suspend" : "Deactivate";
    if (!window.confirm(`${verb} the account for ${u.full_name ?? u.email}?`)) return;
    const { error } = await setAccountStatus(u.id, status, "customer");
    setMessage(error ?? `Customer account ${status}.`);
    void load();
  }

  const visible = rows.filter((r) => {
    if (statusFilter !== "all" && r.account_status !== statusFilter) return false;
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return [r.full_name, r.email, r.phone, r.district].filter(Boolean).some((v) => String(v).toLowerCase().includes(q));
  });

  return (
    <div className="space-y-4">
      {message ? <Panel className="p-3 text-sm">{message}</Panel> : null}
      <Panel>
        <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
          <input
            className={inputClass("max-w-xs")}
            placeholder="Search name, email, phone…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select className={inputClass("max-w-[10rem]")} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="deactivated">Deactivated</option>
          </select>
          <span className="ml-auto text-xs text-muted-foreground">{visible.length} customer(s)</span>
        </div>

        {loading ? (
          <p className="p-4 text-sm text-muted-foreground">Loading customers…</p>
        ) : visible.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No customer accounts match this view.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[52rem] text-sm">
              <thead className="bg-surface text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Phone</th>
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">Checks</th>
                  <th className="px-3 py-2">Complaints</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Created</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visible.map((u) => (
                  <tr key={u.id}>
                    <td className="px-3 py-2 font-medium">{u.full_name ?? "—"}</td>
                    <td className="px-3 py-2">{u.phone ?? "—"}</td>
                    <td className="px-3 py-2">{u.email ?? "—"}</td>
                    <td className="px-3 py-2">{u.checks}</td>
                    <td className="px-3 py-2">{u.complaints}</td>
                    <td className="px-3 py-2"><StatusTag status={u.account_status} /></td>
                    <td className="px-3 py-2">{new Date(u.created_at).toLocaleDateString()}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2 text-xs">
                        <Link to="/admin/users/customers/$id" params={{ id: u.id }} className="underline underline-offset-2">
                          View
                        </Link>
                        {u.account_status !== "suspended" ? (
                          <button className="underline underline-offset-2 text-review" onClick={() => void change(u, "suspended")}>Suspend</button>
                        ) : null}
                        {u.account_status !== "active" ? (
                          <button className="underline underline-offset-2 text-pass" onClick={() => void change(u, "active")}>Restore</button>
                        ) : null}
                        {u.account_status !== "deactivated" ? (
                          <button className="underline underline-offset-2 text-fail" onClick={() => void change(u, "deactivated")}>Deactivate</button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
