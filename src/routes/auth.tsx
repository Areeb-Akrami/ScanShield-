import { ScanShieldMark, useAuthState } from "@/components/AppShell";
import { Button, Field, Panel, inputClass } from "@/components/ui";
import { homeForRole, resetPassword, signIn, signInWithGoogle, signUp } from "@/lib/auth";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { CheckCircle2, FileSearch, Lock, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — ScanShield" },
      {
        name: "description",
        content:
          "Sign in or create a ScanShield account to check packaged commodity compliance and access role-based enforcement workspaces.",
      },
      { property: "og:title", content: "Sign in — ScanShield" },
      { property: "og:description", content: "Secure, role-based access to the ScanShield compliance platform." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

type Mode = "signin" | "signup" | "forgot";

const TITLES: Record<Mode, { title: string; hint: string }> = {
  signin: { title: "Sign in", hint: "Access your workspace. Your role determines what you can see." },
  signup: {
    title: "Create account",
    hint: "New accounts are created as consumer accounts. Staff access is granted by an administrator.",
  },
  forgot: { title: "Reset password", hint: "Enter your email and we will send you a secure reset link." },
};

function AuthPage() {
  const navigate = useNavigate();
  const { status, session } = useAuthState();

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [district, setDistrict] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (status === "ready" && session) navigate({ to: homeForRole(session.role), replace: true });
  }, [status, session, navigate]);

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setNotice(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (mode === "signup" && password !== confirm) {
      setError("Both passwords must match.");
      return;
    }
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
          setNotice("Account created. Confirm your email address, then sign in.");
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

  const copy = TITLES[mode];

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel */}
      <aside className="hero-navy relative hidden flex-col justify-between p-10 lg:flex">
        <Link to="/" className="text-navy-foreground">
          <ScanShieldMark />
        </Link>
        <div className="max-w-md">
          <h2 className="text-3xl leading-tight font-semibold tracking-tight">
            Smarter package compliance. Safer markets.
          </h2>
          <p className="mt-3 text-sm leading-relaxed opacity-80">
            Evidence-backed Legal Metrology verification with AI-assisted extraction and human-reviewed
            decisions.
          </p>
          <ul className="mt-8 space-y-3 text-sm">
            {[
              [ShieldCheck, "Role-based access to every workspace"],
              [FileSearch, "Evidence-linked rule findings"],
              [Lock, "Audit-ready records for every decision"],
            ].map(([Icon, text]) => {
              const I = Icon as typeof ShieldCheck;
              return (
                <li key={String(text)} className="flex items-center gap-3 opacity-90">
                  <I className="h-4 w-4 shrink-0" aria-hidden />
                  {text as string}
                </li>
              );
            })}
          </ul>
        </div>
        <p className="text-xs opacity-60">Hackathon demo environment</p>
      </aside>

      {/* Form panel */}
      <main className="flex items-center justify-center bg-background px-5 py-10">
        <div className="w-full max-w-sm rise-in">
          <div className="mb-6 text-primary lg:hidden">
            <Link to="/">
              <ScanShieldMark />
            </Link>
          </div>

          <h1 className="text-2xl font-semibold tracking-tight">{copy.title}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">{copy.hint}</p>

          {mode !== "forgot" ? (
            <div className="mt-5 flex gap-1 rounded-lg bg-muted p-1 text-xs font-medium">
              {(["signin", "signup"] as Mode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => switchMode(m)}
                  className={
                    mode === m
                      ? "flex-1 rounded-md bg-card px-3 py-2 shadow-sm"
                      : "flex-1 rounded-md px-3 py-2 text-muted-foreground transition-colors hover:text-foreground"
                  }
                >
                  {m === "signin" ? "Sign in" : "Create account"}
                </button>
              ))}
            </div>
          ) : null}

          <Panel className="mt-4 p-5">
            <form onSubmit={submit} className="space-y-3.5">
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
                    <input value={district} onChange={(e) => setDistrict(e.target.value)} className={inputClass()} />
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

              {mode === "signup" ? (
                <Field label="Confirm password">
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className={inputClass()}
                    autoComplete="new-password"
                  />
                </Field>
              ) : null}

              {error ? (
                <p role="alert" className="rounded-md bg-fail/10 px-3 py-2 text-xs text-fail">
                  {error}
                </p>
              ) : null}
              {notice ? (
                <p className="flex items-start gap-2 rounded-md bg-pass/10 px-3 py-2 text-xs text-pass">
                  <CheckCircle2 className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
                  {notice}
                </p>
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

            {mode !== "forgot" ? (
              <>
                <div className="mt-4 flex items-center gap-3 text-[11px] text-muted-foreground">
                  <span className="h-px flex-1 bg-border" />
                  or
                  <span className="h-px flex-1 bg-border" />
                </div>
                <button
                  type="button"
                  onClick={() => void google()}
                  disabled={busy}
                  className="mt-3 w-full rounded-md border border-border px-3 py-2.5 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-60"
                >
                  Continue with Google
                </button>
              </>
            ) : null}

            <div className="mt-4 border-t border-border pt-3 text-xs">
              {mode === "forgot" ? (
                <button type="button" className="text-accent hover:underline" onClick={() => switchMode("signin")}>
                  Back to sign in
                </button>
              ) : (
                <button type="button" className="text-accent hover:underline" onClick={() => switchMode("forgot")}>
                  Forgot your password?
                </button>
              )}
            </div>
          </Panel>

          <p className="mt-5 text-center text-xs text-muted-foreground">
            <Link to="/" className="hover:underline">
              ← Back to home
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
