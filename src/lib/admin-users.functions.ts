/**
 * Administrator-only staff account creation.
 *
 * Creating an authentication account requires privileged access, so it runs on
 * the server after the caller has been verified as an administrator. Everything
 * else (profile edits, status changes) goes through ordinary RLS-protected
 * queries from the client.
 */
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createServerFn } from "@tanstack/react-start";

export interface CreateStaffInput {
  fullName: string;
  email: string;
  phone: string;
  employeeId: string;
  department: string;
  district: string;
  role: "inspector" | "enforcement_officer";
}

function temporaryPassword(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return `Sc$${Array.from(bytes, (b) => b.toString(36)).join("").slice(0, 14)}A1`;
}

export const createStaffAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: CreateStaffInput) => input)
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) return { error: "Only an administrator may create staff accounts." };

    const email = data.email.trim().toLowerCase();
    if (!email || !data.fullName.trim()) return { error: "Name and official email are required." };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    if (existing?.id) return { error: "An account already exists for this email address." };

    const password = temporaryPassword();
    const { data: created, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName.trim() },
    });
    if (authError || !created.user) {
      return { error: authError?.message ?? "The authentication account could not be created." };
    }

    const userId = created.user.id;
    // The profile trigger mirrors this role into user_roles, which is what RLS reads.
    const { error: profileError } = await supabaseAdmin.from("profiles").upsert(
      {
        id: userId,
        full_name: data.fullName.trim(),
        email,
        phone: data.phone.trim() || null,
        employee_id: data.employeeId.trim() || null,
        department: data.department.trim() || null,
        district: data.district.trim() || null,
        role: data.role,
        account_status: "active",
      },
      { onConflict: "id" },
    );
    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return { error: profileError.message };
    }

    await supabaseAdmin.from("audit_logs").insert({
      user_id: context.userId,
      action: "staff_created",
      entity_type: "profiles",
      entity_id: userId,
      metadata: { email, role: data.role, employee_id: data.employeeId, district: data.district },
    });

    return { userId, temporaryPassword: password };
  });
