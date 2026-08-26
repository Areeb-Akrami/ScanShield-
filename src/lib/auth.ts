export type Role = "CONSUMER" | "FIELD_INSPECTOR" | "ENFORCEMENT_OFFICER" | "SUPERVISOR" | "ADMIN";

export interface Session {
  userId: string;
  name: string;
  email: string;
  role: Role;
  district: string;
  issuedAt: string;
  expiresAt: string;
}

const KEY = "scanshield.session";
const SESSION_HOURS = 8;

/**
 * Demo credential set. Placeholder identities only — no real accounts exist and
 * no secret material is stored in code. Replace with Lovable Cloud auth
 * (JWT + hashed passwords + RLS) when the backend is enabled.
 */
export const DEMO_ACCOUNTS: Array<{
  email: string;
  password: string;
  name: string;
  role: Role;
  district: string;
}> = [
  { email: "inspector@scanshield.gov.in", password: "demo1234", name: "R. Deshmukh", role: "FIELD_INSPECTOR", district: "Nashik" },
  { email: "officer@scanshield.gov.in", password: "demo1234", name: "S. Iyer", role: "ENFORCEMENT_OFFICER", district: "Pune" },
  { email: "admin@scanshield.gov.in", password: "demo1234", name: "A. Kulkarni", role: "ADMIN", district: "State HQ" },
  { email: "consumer@example.com", password: "demo1234", name: "Priya M.", role: "CONSUMER", district: "Mumbai" },
];

export function signIn(email: string, password: string): Session | { error: string } {
  const acct = DEMO_ACCOUNTS.find((a) => a.email.toLowerCase() === email.trim().toLowerCase());
  if (!acct || acct.password !== password) {
    return { error: "Email or password is incorrect. Check the demo credentials listed below." };
  }
  const now = new Date();
  const session: Session = {
    userId: acct.email,
    name: acct.name,
    email: acct.email,
    role: acct.role,
    district: acct.district,
    issuedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + SESSION_HOURS * 3600_000).toISOString(),
  };
  localStorage.setItem(KEY, JSON.stringify(session));
  return session;
}

export function getSession(): Session | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as Session;
    if (new Date(s.expiresAt) < new Date()) {
      localStorage.removeItem(KEY);
      return null;
    }
    return s;
  } catch {
    return null;
  }
}

export function signOut(): void {
  localStorage.removeItem(KEY);
}

export function homeForRole(role: Role): string {
  if (role === "CONSUMER") return "/consumer";
  if (role === "ADMIN" || role === "SUPERVISOR" || role === "ENFORCEMENT_OFFICER") return "/admin";
  return "/inspector";
}

export function canAccessAdmin(role: Role): boolean {
  return role === "ADMIN" || role === "SUPERVISOR" || role === "ENFORCEMENT_OFFICER";
}
