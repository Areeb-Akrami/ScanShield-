import { supabase } from "@/integrations/supabase/client";

export type Role = "CONSUMER" | "FIELD_INSPECTOR" | "ENFORCEMENT_OFFICER" | "SUPERVISOR" | "ADMIN";
export type DbRole = "consumer" | "inspector" | "enforcement_officer" | "admin";

export interface Session {
  userId: string;
  name: string;
  email: string;
  role: Role;
  district: string;
  employeeId?: string | null;
  department?: string | null;
  accountStatus?: "active" | "suspended" | "deactivated";
  issuedAt: string;
  expiresAt: string;
}

const CACHE_KEY = "scanshield.session";

export function toAppRole(role: string | null | undefined): Role {
  switch (role) {
    case "admin":
      return "ADMIN";
    case "enforcement_officer":
      return "ENFORCEMENT_OFFICER";
    case "inspector":
      return "FIELD_INSPECTOR";
    default:
      return "CONSUMER";
  }
}

export function toDbRole(role: Role): DbRole {
  switch (role) {
    case "ADMIN":
      return "admin";
    case "ENFORCEMENT_OFFICER":
    case "SUPERVISOR":
      return "enforcement_officer";
    case "FIELD_INSPECTOR":
      return "inspector";
    default:
      return "consumer";
  }
}

export function roleLabel(role: Role): string {
  return role.replaceAll("_", " ").toLowerCase();
}

/* ------------------------------------------------------------------ */
/* Reactive session store                                              */
/* ------------------------------------------------------------------ */

type AuthState = { status: "loading" | "ready"; session: Session | null };

let state: AuthState = { status: "loading", session: readCache() };
const listeners = new Set<() => void>();

function readCache(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

function setState(next: AuthState) {
  state = next;
  if (typeof window !== "undefined") {
    if (next.session) localStorage.setItem(CACHE_KEY, JSON.stringify(next.session));
    else localStorage.removeItem(CACHE_KEY);
  }
  listeners.forEach((l) => l());
}

export function subscribeAuth(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function authSnapshot(): AuthState {
  return state;
}

/** Synchronous read used across the app. Null until the session is restored. */
export function getSession(): Session | null {
  return state.session;
}

/* ------------------------------------------------------------------ */
/* Profile loading                                                     */
/* ------------------------------------------------------------------ */

async function loadProfile(userId: string, email: string, expiresAt: string): Promise<Session> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, district, employee_id, department, role, account_status")
    .eq("id", userId)
    .maybeSingle();

  if (!profile) {
    // First sign-in after registration: create the profile row. A database
    // trigger forces the role to `consumer` unless an administrator creates it.
    await supabase.from("profiles").upsert({ id: userId, email, full_name: email.split("@")[0] ?? email }, { onConflict: "id", ignoreDuplicates: true });
  }

  const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const dbRole =
    (roles ?? []).map((r) => r.role as DbRole).sort((a, b) => rank(b) - rank(a))[0] ??
    ((profile?.role as DbRole | undefined) ?? "consumer");

  return {
    userId,
    name: profile?.full_name || email.split("@")[0] || email,
    email: profile?.email || email,
    role: toAppRole(dbRole),
    district: profile?.district ?? "—",
    employeeId: profile?.employee_id ?? null,
    department: profile?.department ?? null,
    accountStatus: (profile?.account_status as Session["accountStatus"]) ?? "active",
    issuedAt: new Date().toISOString(),
    expiresAt,
  };
}

function rank(role: DbRole): number {
  return { consumer: 0, inspector: 1, enforcement_officer: 2, admin: 3 }[role] ?? 0;
}

async function refreshFromSupabase() {
  const { data } = await supabase.auth.getSession();
  const s = data.session;
  if (!s?.user) {
    setState({ status: "ready", session: null });
    return;
  }
  const expiresAt = new Date((s.expires_at ?? Date.now() / 1000 + 3600) * 1000).toISOString();
  try {
    const session = await loadProfile(s.user.id, s.user.email ?? "", expiresAt);
    setState({ status: "ready", session });
  } catch {
    setState({ status: "ready", session: state.session });
  }
}

let started = false;
export function initAuth() {
  if (started || typeof window === "undefined") return;
  started = true;
  void refreshFromSupabase();
  supabase.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT") {
      setState({ status: "ready", session: null });
      return;
    }
    if (event === "SIGNED_IN" || event === "USER_UPDATED" || event === "TOKEN_REFRESHED") {
      void refreshFromSupabase();
    }
  });
}

if (typeof window !== "undefined") initAuth();

/* ------------------------------------------------------------------ */
/* Actions                                                             */
/* ------------------------------------------------------------------ */

export async function signIn(email: string, password: string): Promise<Session | { error: string }> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error || !data.session?.user) {
    return { error: error?.message ?? "Email or password is incorrect." };
  }
  const expiresAt = new Date((data.session.expires_at ?? Date.now() / 1000 + 3600) * 1000).toISOString();
  const session = await loadProfile(data.session.user.id, data.session.user.email ?? email, expiresAt);
  if (session.accountStatus && session.accountStatus !== "active") {
    await supabase.auth.signOut();
    setState({ status: "ready", session: null });
    return {
      error:
        session.accountStatus === "suspended"
          ? "This account has been suspended by an administrator."
          : "This account has been deactivated.",
    };
  }
  setState({ status: "ready", session });
  return session;
}

export async function signUp(input: {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  district?: string;
}): Promise<{ needsConfirmation: boolean } | { error: string }> {
  const { data, error } = await supabase.auth.signUp({
    email: input.email.trim(),
    password: input.password,
    options: {
      emailRedirectTo: window.location.origin,
      data: { full_name: input.fullName },
    },
  });
  if (error) return { error: error.message };

  if (data.session?.user) {
    await supabase.from("profiles").insert({
      id: data.session.user.id,
      email: input.email.trim(),
      full_name: input.fullName,
      phone: input.phone || null,
      district: input.district || null,
    });
    await refreshFromSupabase();
    return { needsConfirmation: false };
  }
  return { needsConfirmation: true };
}

export async function signInWithGoogle(): Promise<{ error: string } | void> {
  const { lovable } = await import("@/integrations/lovable/index");
  const result = await lovable.auth.signInWithOAuth("google", {
    redirect_uri: window.location.origin,
  });
  if (result.error) return { error: String(result.error) };
  if (result.redirected) return;
  await refreshFromSupabase();
}

export async function resetPassword(email: string): Promise<{ error?: string | undefined }> {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  return { error: error?.message };
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
  setState({ status: "ready", session: null });
}

/* ------------------------------------------------------------------ */
/* Routing helpers (unchanged contract)                                */
/* ------------------------------------------------------------------ */

export function homeForRole(role: Role): string {
  if (role === "CONSUMER") return "/consumer";
  if (role === "ADMIN" || role === "SUPERVISOR" || role === "ENFORCEMENT_OFFICER") return "/admin";
  return "/inspector";
}

export function canAccessAdmin(role: Role): boolean {
  return role === "ADMIN" || role === "SUPERVISOR" || role === "ENFORCEMENT_OFFICER";
}
