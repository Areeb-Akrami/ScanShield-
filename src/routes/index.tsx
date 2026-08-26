import { CorpusBanner } from "@/components/CorpusBanner";
import { GovStripe, ScanShieldMark } from "@/components/AppShell";
import { Button, Field, Panel, inputClass } from "@/components/ui";
import { DEMO_ACCOUNTS, getSession, homeForRole, signIn } from "@/lib/auth";
import { audit } from "@/lib/store";
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
    ],
  }),
  component: SignInPage,
});

function SignInPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("inspector@scanshield.gov.in");
  const [password, setPassword] = useState("demo1234");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const s = getSession();
    if (s) navigate({ to: homeForRole(s.role) });
  }, [navigate]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const result = signIn(email, password);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    audit({
      user: result.email,
      action: "LOGIN",
      entity: "Session",
      entityId: result.userId,
      before: null,
      after: result.role,
    });
    navigate({ to: homeForRole(result.role) });
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
          <h2 className="text-sm font-semibold">Sign in</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Role-based access. Sessions expire after 8 hours.
          </p>
          <form onSubmit={submit} className="mt-4 space-y-3">
            <Field label="Official email">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass()}
                autoComplete="username"
              />
            </Field>
            <Field label="Password">
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass()}
                autoComplete="current-password"
              />
            </Field>
            {error ? (
              <p role="alert" className="rounded-md bg-fail/10 px-3 py-2 text-xs text-fail">
                {error}
              </p>
            ) : null}
            <Button type="submit" size="lg" className="w-full">
              Sign in
            </Button>
          </form>

          <div className="mt-5 border-t border-border pt-4">
            <p className="label-caps">Demo credentials · password demo1234</p>
            <ul className="mt-2 space-y-1.5">
              {DEMO_ACCOUNTS.map((a) => (
                <li key={a.email}>
                  <button
                    onClick={() => {
                      setEmail(a.email);
                      setPassword(a.password);
                    }}
                    className="w-full rounded border border-border px-2.5 py-1.5 text-left text-xs hover:bg-muted"
                  >
                    <span className="font-medium">{a.role.replaceAll("_", " ")}</span>
                    <span className="text-muted-foreground"> · {a.email}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </Panel>
      </main>
    </div>
  );
}
