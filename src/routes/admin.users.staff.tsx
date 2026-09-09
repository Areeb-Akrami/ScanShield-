import { Button, Field, Panel, PanelHeader, inputClass } from "@/components/ui";
import { createStaffAccount } from "@/lib/admin-users.functions";
import {
  listUsersByRole,
  setAccountStatus,
  updateUserProfile,
  userActivity,
  type ManagedUser,
  type StaffRole,
} from "@/lib/admin-users";
import { cn } from "@/lib/utils";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";

export const Route = createFileRoute("/admin/users/staff")({
  head: () => ({
    meta: [
      { title: "Inspectors & officers — ScanShield admin" },
      { name: "description", content: "Create, edit, activate and deactivate Legal Metrology inspector and enforcement officer accounts." },
      { property: "og:title", content: "Inspectors & officers — ScanShield admin" },
      { property: "og:description", content: "Staff account administration for ScanShield." },
    ],
  }),
  component: StaffPage,
});

const ROLE_LABEL: Record<StaffRole, string> = {
  inspector: "Inspector",
  enforcement_officer: "Enforcement officer",
};

function StatusTag({ status }: { status: string }) {
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

interface FormState {
  fullName: string;
  email: string;
  phone: string;
  employeeId: string;
  department: string;
  district: string;
}

const EMPTY: FormState = { fullName: "", email: "", phone: "", employeeId: "", department: "", district: "" };

function StaffPage() {
  const [role, setRole] = useState<StaffRole>("inspector");
  const [rows, setRows] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [detail, setDetail] = useState<ManagedUser | null>(null);
  const [editing, setEditing] = useState(false);
  const [activity, setActivity] = useState<Awaited<ReturnType<typeof userActivity>>>([]);

  const createStaff = useServerFn(createStaffAccount);

  const load = useCallback(async () => {
    setLoading(true);
    setRows(await listUsersByRole([role]));
    setLoading(false);
  }, [role]);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = rows.filter((r) => {
    if (statusFilter !== "all" && r.account_status !== statusFilter) return false;
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return [r.full_name, r.email, r.employee_id, r.district, r.department]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(q));
  });

  async function submitNew() {
    setBusy(true);
    setMessage(null);
    const result = await createStaff({ data: { ...form, role } });
    setBusy(false);
    if ("error" in result && result.error) {
      setMessage({ kind: "error", text: result.error });
      return;
    }
    const pwd = (result as { temporaryPassword?: string }).temporaryPassword;
    setMessage({
      kind: "ok",
      text: `${ROLE_LABEL[role]} account created. Temporary password: ${pwd}. Share it securely — it is shown only once.`,
    });
    setForm(EMPTY);
    setCreating(false);
    void load();
  }

  async function changeStatus(user: ManagedUser, status: "active" | "deactivated") {
    const verb = status === "active" ? "Activate" : "Deactivate";
    if (!window.confirm(`${verb} the account for ${user.full_name ?? user.email}?`)) return;
    const { error } = await setAccountStatus(user.id, status, "staff");
    setMessage(error ? { kind: "error", text: error } : { kind: "ok", text: `Account ${status}.` });
    void load();
    if (detail?.id === user.id) setDetail({ ...user, account_status: status });
  }

  async function openActivity(user: ManagedUser) {
    setDetail(user);
    setEditing(false);
    setActivity(await userActivity(user.id));
  }

  async function saveEdit() {
    if (!detail) return;
    setBusy(true);
    const { error } = await updateUserProfile(detail.id, {
      full_name: detail.full_name ?? "",
      phone: detail.phone,
      employee_id: detail.employee_id,
      department: detail.department,
      district: detail.district,
    });
    setBusy(false);
    setMessage(error ? { kind: "error", text: error } : { kind: "ok", text: "Staff profile updated." });
    setEditing(false);
    void load();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {(["inspector", "enforcement_officer"] as StaffRole[]).map((r) => (
          <button
            key={r}
            onClick={() => {
              setRole(r);
              setDetail(null);
              setCreating(false);
            }}
            className={cn(
              "rounded border px-3 py-1.5 text-sm font-medium",
              role === r ? "border-accent bg-accent/10 text-foreground" : "border-border text-muted-foreground",
            )}
          >
            {r === "inspector" ? "Inspectors" : "Enforcement officers"}
          </button>
        ))}
        <div className="ml-auto">
          <Button onClick={() => { setCreating((v) => !v); setMessage(null); }}>
            + Add {ROLE_LABEL[role].toLowerCase()}
          </Button>
        </div>
      </div>

      {message ? (
        <Panel
          className={cn(
            "p-3 text-sm",
            message.kind === "ok" ? "border-pass/40 text-foreground" : "border-fail/50 text-fail",
          )}
        >
          {message.text}
        </Panel>
      ) : null}

      {creating ? (
        <Panel>
          <PanelHeader
            title={`Add ${ROLE_LABEL[role].toLowerCase()}`}
            subtitle="Creates a real sign-in account and the matching staff profile."
          />
          <div className="grid gap-3 p-4 sm:grid-cols-2">
            <Field label="Full name">
              <input className={inputClass()} value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
            </Field>
            <Field label="Official email">
              <input type="email" className={inputClass()} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
            <Field label="Phone">
              <input className={inputClass()} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
            <Field label="Employee ID">
              <input className={inputClass()} value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} />
            </Field>
            <Field label="Department">
              <input className={inputClass()} value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
            </Field>
            <Field label="District">
              <input className={inputClass()} value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })} />
            </Field>
            <div className="sm:col-span-2">
              <Button onClick={() => void submitNew()} disabled={busy}>
                {busy ? "Creating…" : `Create ${ROLE_LABEL[role].toLowerCase()}`}
              </Button>
            </div>
          </div>
        </Panel>
      ) : null}

      <Panel>
        <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
          <input
            className={inputClass("max-w-xs")}
            placeholder="Search name, email, employee ID…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select className={inputClass("max-w-[10rem]")} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="deactivated">Deactivated</option>
          </select>
          <span className="ml-auto text-xs text-muted-foreground">{visible.length} account(s)</span>
        </div>

        {loading ? (
          <p className="p-4 text-sm text-muted-foreground">Loading accounts…</p>
        ) : visible.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No {ROLE_LABEL[role].toLowerCase()} accounts yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[54rem] text-sm">
              <thead className="bg-surface text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Employee ID</th>
                  <th className="px-3 py-2">Department</th>
                  <th className="px-3 py-2">District</th>
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">Phone</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Created</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visible.map((u) => (
                  <tr key={u.id}>
                    <td className="px-3 py-2 font-medium">{u.full_name ?? "—"}</td>
                    <td className="px-3 py-2">{u.employee_id ?? "—"}</td>
                    <td className="px-3 py-2">{u.department ?? "—"}</td>
                    <td className="px-3 py-2">{u.district ?? "—"}</td>
                    <td className="px-3 py-2">{u.email ?? "—"}</td>
                    <td className="px-3 py-2">{u.phone ?? "—"}</td>
                    <td className="px-3 py-2"><StatusTag status={u.account_status} /></td>
                    <td className="px-3 py-2">{new Date(u.created_at).toLocaleDateString()}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2 text-xs">
                        <button className="underline underline-offset-2" onClick={() => { setDetail(u); setEditing(false); setActivity([]); }}>View</button>
                        <button className="underline underline-offset-2" onClick={() => { setDetail(u); setEditing(true); }}>Edit</button>
                        {u.account_status === "active" ? (
                          <button className="underline underline-offset-2 text-fail" onClick={() => void changeStatus(u, "deactivated")}>Deactivate</button>
                        ) : (
                          <button className="underline underline-offset-2 text-pass" onClick={() => void changeStatus(u, "active")}>Activate</button>
                        )}
                        <button className="underline underline-offset-2" onClick={() => void openActivity(u)}>Activity</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {detail ? (
        <Panel>
          <PanelHeader
            title={detail.full_name ?? detail.email ?? "Staff account"}
            subtitle={`${ROLE_LABEL[(detail.role as StaffRole) ?? "inspector"]} · ${detail.email ?? "—"}`}
            action={<button className="text-xs underline underline-offset-2" onClick={() => setDetail(null)}>Close</button>}
          />
          <div className="grid gap-3 p-4 sm:grid-cols-2">
            <Field label="Full name">
              <input className={inputClass()} disabled={!editing} value={detail.full_name ?? ""} onChange={(e) => setDetail({ ...detail, full_name: e.target.value })} />
            </Field>
            <Field label="Phone">
              <input className={inputClass()} disabled={!editing} value={detail.phone ?? ""} onChange={(e) => setDetail({ ...detail, phone: e.target.value })} />
            </Field>
            <Field label="Employee ID">
              <input className={inputClass()} disabled={!editing} value={detail.employee_id ?? ""} onChange={(e) => setDetail({ ...detail, employee_id: e.target.value })} />
            </Field>
            <Field label="Department">
              <input className={inputClass()} disabled={!editing} value={detail.department ?? ""} onChange={(e) => setDetail({ ...detail, department: e.target.value })} />
            </Field>
            <Field label="District">
              <input className={inputClass()} disabled={!editing} value={detail.district ?? ""} onChange={(e) => setDetail({ ...detail, district: e.target.value })} />
            </Field>
            <div className="flex items-end gap-2">
              {editing ? (
                <Button onClick={() => void saveEdit()} disabled={busy}>{busy ? "Saving…" : "Save changes"}</Button>
              ) : (
                <Button onClick={() => setEditing(true)}>Edit profile</Button>
              )}
              <Button variant="ghost" onClick={() => void openActivity(detail)}>View activity</Button>
            </div>
          </div>
          {activity.length > 0 ? (
            <ul className="divide-y divide-border border-t border-border">
              {activity.map((a) => (
                <li key={a.id} className="flex flex-wrap justify-between gap-2 px-4 py-2 text-xs">
                  <span className="font-medium">{a.action.replaceAll("_", " ")}</span>
                  <span className="text-muted-foreground">{new Date(a.created_at).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </Panel>
      ) : null}
    </div>
  );
}
