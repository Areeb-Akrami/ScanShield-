/**
 * Administrator reads and updates for user management.
 *
 * These run through the ordinary Supabase client: row-level security already
 * restricts profile reads to staff and profile writes to the account owner or
 * an administrator, so authorisation is enforced by the database, not the UI.
 */
import { supabase } from "@/integrations/supabase/client";

export type AccountStatus = "active" | "suspended" | "deactivated";
export type StaffRole = "inspector" | "enforcement_officer";

export interface ManagedUser {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  role: string;
  employee_id: string | null;
  department: string | null;
  district: string | null;
  account_status: AccountStatus;
  created_at: string;
}

const COLUMNS =
  "id, full_name, email, phone, role, employee_id, department, district, account_status, created_at";

export async function listUsersByRole(roles: string[]): Promise<ManagedUser[]> {
  const { data } = await supabase
    .from("profiles")
    .select(COLUMNS)
    .in("role", roles as never)
    .order("created_at", { ascending: false });
  return (data ?? []) as ManagedUser[];
}

export async function getUser(id: string): Promise<ManagedUser | null> {
  const { data } = await supabase.from("profiles").select(COLUMNS).eq("id", id).maybeSingle();
  return (data as ManagedUser | null) ?? null;
}

async function audit(action: string, entityId: string, metadata: Record<string, unknown>) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return;
  await supabase.from("audit_logs").insert({
    user_id: auth.user.id,
    action,
    entity_type: "profiles",
    entity_id: entityId,
    metadata: metadata as never,
  });
}

export async function updateUserProfile(
  id: string,
  patch: {
    full_name?: string;
    phone?: string | null;
    employee_id?: string | null;
    department?: string | null;
    district?: string | null;
  },
): Promise<{ error?: string }> {
  const { error } = await supabase.from("profiles").update(patch).eq("id", id);
  if (error) return { error: error.message };
  await audit("staff_updated", id, patch);
  return {};
}

export async function setAccountStatus(
  id: string,
  status: AccountStatus,
  who: "staff" | "customer",
): Promise<{ error?: string }> {
  const { error } = await supabase.from("profiles").update({ account_status: status }).eq("id", id);
  if (error) return { error: error.message };
  const action =
    status === "active"
      ? who === "staff"
        ? "staff_activated"
        : "customer_restored"
      : who === "staff"
        ? "staff_deactivated"
        : status === "suspended"
          ? "customer_suspended"
          : "customer_deactivated";
  await audit(action, id, { account_status: status });
  return {};
}

export async function changeUserRole(id: string, role: string): Promise<{ error?: string }> {
  const { error } = await supabase.from("profiles").update({ role: role as never }).eq("id", id);
  if (error) return { error: error.message };
  await audit("role_changed", id, { role });
  return {};
}

/** Recent audit entries recorded for, or by, one account. */
export async function userActivity(id: string) {
  const { data } = await supabase
    .from("audit_logs")
    .select("id, action, entity_type, entity_id, metadata, created_at, user_id")
    .or(`user_id.eq.${id},entity_id.eq.${id}`)
    .order("created_at", { ascending: false })
    .limit(50);
  return data ?? [];
}

export interface CustomerSummary extends ManagedUser {
  checks: number;
  complaints: number;
}

export async function listCustomers(): Promise<CustomerSummary[]> {
  const rows = await listUsersByRole(["consumer"]);
  const [{ data: checks }, { data: complaints }] = await Promise.all([
    supabase.from("consumer_checks").select("consumer_id"),
    supabase.from("complaints").select("consumer_id"),
  ]);
  const count = (list: { consumer_id: string | null }[] | null, id: string) =>
    (list ?? []).filter((r) => r.consumer_id === id).length;
  return rows.map((r) => ({
    ...r,
    checks: count(checks, r.id),
    complaints: count(complaints, r.id),
  }));
}

export async function customerChecks(id: string) {
  const { data } = await supabase
    .from("consumer_checks")
    .select("id, product_name, status, confidence, findings, created_at")
    .eq("consumer_id", id)
    .order("created_at", { ascending: false })
    .limit(100);
  return data ?? [];
}

export async function customerComplaints(id: string) {
  const { data } = await supabase
    .from("complaints")
    .select("id, product, issue_type, status, created_at")
    .eq("consumer_id", id)
    .order("created_at", { ascending: false })
    .limit(100);
  return data ?? [];
}
