import { GovStripe, ScanShieldMark } from "@/components/AppShell";
import { Button, Field, Panel, inputClass } from "@/components/ui";
import { supabase } from "@/integrations/supabase/client";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Set a new password — ScanShield" },
      { name: "description", content: "Choose a new password for your ScanShield account." },
      { property: "og:title", content: "Set a new password — ScanShield" },
      { property: "og:description", content: "Complete your ScanShield password reset." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setDone(true);
    setTimeout(() => navigate({ to: "/", replace: true }), 1200);
  }

  return (
    <div className="min-h-screen bg-background">
      <GovStripe />
      <main className="mx-auto max-w-md px-5 py-16">
        <div className="text-primary">
          <ScanShieldMark />
        </div>
        <Panel className="mt-6 p-5">
          <h1 className="text-sm font-semibold">Set a new password</h1>
          {done ? (
            <p className="mt-3 rounded-md bg-pass/10 px-3 py-2 text-xs text-pass">
              Password updated. Taking you to sign in…
            </p>
          ) : (
            <form onSubmit={submit} className="mt-4 space-y-3">
              <Field label="New password">
                <input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClass()}
                  autoComplete="new-password"
                />
              </Field>
              {error ? (
                <p role="alert" className="rounded-md bg-fail/10 px-3 py-2 text-xs text-fail">
                  {error}
                </p>
              ) : null}
              <Button type="submit" size="lg" className="w-full" disabled={busy}>
                {busy ? "Updating…" : "Update password"}
              </Button>
            </form>
          )}
        </Panel>
      </main>
    </div>
  );
}
