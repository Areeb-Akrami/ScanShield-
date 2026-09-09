import { CorpusBanner } from "@/components/CorpusBanner";
import { GovStripe, ScanShieldMark, useAuthState } from "@/components/AppShell";
import { Button, Field, Panel, inputClass } from "@/components/ui";
import { homeForRole, resetPassword, signIn, signInWithGoogle, signUp } from "@/lib/auth";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ScanShield — Legal Metrology Compliance Verification" },
      {
        name: "description",
        content:
          "AI-assisted verification of packaged commodity declarations under the Legal Metrology (Packaged Commodities) Rules, with a deterministic rule engine and human-supervised decisions.",
      },
      { property: "og:title", content: "ScanShield — Legal Metrology Compliance Verification" },
      {
        property: "og:description",
        content:
          "Field inspection, evidence capture and rule-engine validation for packaged commodity compliance.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SignInPage,
});

type Mode = "signin" | "signup" | "forgot";

function SignInPage() {
  const navigate = useNavigate();
  const { status, session } = useAuthState();

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [district, setDistrict] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (status === "ready" && session) navigate({ to: homeForRole(session.role), replace: true });
  }, [status, session, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      if (mode === "forgot") {
        const { error: err } = await resetPassword(email);
        if (err) setError(err);
        else setNotice("If that address has an account, a password reset link is on its way.");
        return;
      }
      if (mode === "signup") {
        const result = await signUp({ email, password, fullName, phone, district });
        if ("error" in result) {
          setError(result.error);
          return;
        }
        if (result.needsConfirmation) {
          setNotice("Account created. Check your email and confirm the address, then sign in.");
          setMode("signin");
        }
        return;
      }
      const result = await signIn(email, password);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      navigate({ to: homeForRole(result.role), replace: true });
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setError(null);
    setBusy(true);
    const result = await signInWithGoogle();
    setBusy(false);
    if (result?.error) setError(result.error);
  }

  return (
    <div className="min-h-screen bg-background">
      <GovStripe />
      <main className="mx-auto grid max-w-5xl gap-8 px-5 py-10 lg:grid-cols-[1.1fr_1fr] lg:py-16">
        <section>
          <div className="text-primary">
            <ScanShieldMark />
          </div>
          <h1 className="mt-6 text-3xl leading-tight font-semibold tracking-tight sm:text-4xl">
            Packaged commodity compliance verification
          </h1>
          <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground">
            ScanShield extracts declarations from package evidence, applies the configured Legal
            Metrology rule set through a deterministic engine, and routes every uncertain case to a
            human inspector. AI produces evidence — it never issues the legal conclusion.
          </p>

          <div className="mt-6 space-y-2 text-sm">
            {[
              ["Rule engine", "Applicability, effective dates and exemptions are evaluated separately from AI output."],
              ["Evidence-first", "Unreadable is not missing. Low confidence is not a violation."],
              ["Human-supervised", "Confirm, reject, edit, request rescan or mark not applicable — all audited."],
            ].map(([t, d]) => (
              <div key={t} className="flex gap-3">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                <p>
                  <span className="font-medium">{t}.</span>{" "}
                  <span className="text-muted-foreground">{d}</span>
                </p>
              </div>
            ))}
          </div>

          <div className="mt-6">
            <CorpusBanner />
          </div>
        </section>

        <Panel className="h-fit p-5">
          <div className="flex gap-1 rounded-md bg-muted p-1 text-xs font-medium">
            {(["signin", "signup"] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMode(m);
                  setError(null);
                  setNotice(null);
                }}
                className={
                  mode === m
                    ? "flex-1 rounded bg-card px-3 py-1.5 shadow-sm"
                    : "flex-1 rounded px-3 py-1.5 text-muted-foreground"
                }
              >
                {m === "signin" ? "Sign in" : "Create account"}
              </button>
            ))}
          </div>

          <p className="mt-3 text-xs text-muted-foreground">
            {mode === "forgot"
              ? "Enter your official email and we will send a reset link."
              : mode === "signup"
                ? "New accounts are created as consumer accounts. Inspector, enforcement and administrator access is granted by an administrator."
                : "Role-based access. Your session is restored automatically on this device."}
          </p>

          <form onSubmit={submit} className="mt-4 space-y-3">
            {mode === "signup" ? (
              <>
                <Field label="Full name">
                  <input
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className={inputClass()}
                    autoComplete="name"
                  />
                </Field>
                <Field label="Phone (optional)">
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className={inputClass()}
                    autoComplete="tel"
                  />
                </Field>
                <Field label="District (optional)">
                  <input
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    className={inputClass()}
                  />
                </Field>
              </>
            ) : null}

            <Field label="Email">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass()}
                autoComplete="username"
              />
            </Field>

            {mode !== "forgot" ? (
              <Field label="Password">
                <input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClass()}
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                />
              </Field>
            ) : null}

            {error ? (
              <p role="alert" className="rounded-md bg-fail/10 px-3 py-2 text-xs text-fail">
                {error}
              </p>
            ) : null}
            {notice ? (
              <p className="rounded-md bg-pass/10 px-3 py-2 text-xs text-pass">{notice}</p>
            ) : null}

            <Button type="submit" size="lg" className="w-full" disabled={busy}>
              {busy
                ? "Please wait…"
                : mode === "signup"
                  ? "Create account"
                  : mode === "forgot"
                    ? "Send reset link"
                    : "Sign in"}
            </Button>
          </form>

          <div className="mt-3 flex items-center gap-3 text-[11px] text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            or
            <span className="h-px flex-1 bg-border" />
          </div>

          <button
            type="button"
            onClick={() => void google()}
            disabled={busy}
            className="mt-3 w-full rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-60"
          >
            Continue with Google
          </button>

          <div className="mt-4 border-t border-border pt-3 text-xs">
            {mode === "forgot" ? (
              <button type="button" className="underline underline-offset-2" onClick={() => setMode("signin")}>
                Back to sign in
              </button>
            ) : (
              <button type="button" className="underline underline-offset-2" onClick={() => setMode("forgot")}>
                Forgot your password?
              </button>
            )}
          </div>
        </Panel>
      </main>
    </div>
  );
}
