import { GovStripe, ScanShieldMark, useAuthState } from "@/components/AppShell";
import { CorpusBanner } from "@/components/CorpusBanner";
import { homeForRole } from "@/lib/auth";
import heroImage from "@/assets/hero-package.jpg";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Archive,
  Camera,
  ClipboardCheck,
  Cpu,
  FileCheck2,
  FileSearch,
  Gavel,
  History,
  KeyRound,
  Layers,
  ScanLine,
  Scale,
  ScrollText,
  ShieldCheck,
  UserCheck,
  UserRound,
  Users,
} from "lucide-react";
import { useEffect } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ScanShield — AI-Powered Legal Metrology Compliance" },
      {
        name: "description",
        content:
          "Capture a packaged product, extract declarations with AI, evaluate Legal Metrology requirements and support human-reviewed compliance decisions.",
      },
      { property: "og:title", content: "ScanShield — AI-Powered Legal Metrology Compliance" },
      {
        property: "og:description",
        content:
          "AI-assisted extraction, deterministic rule checking and human-reviewed compliance decisions for packaged commodities.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LandingPage,
});

const WORKFLOW = [
  { icon: Camera, label: "Package" },
  { icon: Cpu, label: "AI / OCR" },
  { icon: Scale, label: "Legal Metrology check" },
  { icon: UserCheck, label: "Human review" },
  { icon: FileCheck2, label: "Result" },
];

const ROLES = [
  {
    icon: ScanLine,
    title: "Inspector",
    body: "Field inspection and package verification.",
    cta: "Inspector sign in",
  },
  {
    icon: Gavel,
    title: "Enforcement Officer",
    body: "Case review and enforcement decisions.",
    cta: "Officer sign in",
  },
  {
    icon: ShieldCheck,
    title: "Admin",
    body: "Users, rules, sources, analytics and audit.",
    cta: "Admin sign in",
  },
  {
    icon: UserRound,
    title: "Consumer",
    body: "Check a packaged product.",
    cta: "Check a package",
  },
];

const STEPS = [
  ["Capture package", "Photograph the panels that carry the mandatory declarations."],
  ["Extract declarations", "AI reads the visible text and records confidence for each field."],
  ["Check applicable requirements", "The rule engine applies only the provisions in force for that package."],
  ["Human review", "An inspector or officer confirms, corrects or requests a rescan."],
  ["Generate result", "A decision and evidence-linked report are recorded."],
];

const FEATURES = [
  [Cpu, "AI-assisted OCR", "Declarations are read from package evidence with per-field confidence."],
  [Scale, "Legal Metrology rule checking", "Applicability, effective dates and exemptions evaluated separately from AI output."],
  [FileSearch, "Evidence-based review", "Every finding links back to the image and extracted text behind it."],
  [UserCheck, "Human decision support", "AI produces evidence; a person issues the compliance decision."],
  [Layers, "Rule versioning", "Amendments create new versions; historic checks keep the version that applied."],
  [History, "Audit trail", "Immutable records of who decided what, and when."],
  [UserRound, "Consumer self-check", "Shoppers can verify a package and raise a complaint."],
  [ScrollText, "Compliance reports", "Printable, evidence-linked outputs from recorded inspections."],
] as const;

const TRUST = [
  [KeyRound, "Secure authentication"],
  [Users, "Role-based access"],
  [ClipboardCheck, "Evidence-backed compliance"],
  [Archive, "Audit-ready records"],
  [FileCheck2, "Persistent data"],
] as const;

function LandingPage() {
  const navigate = useNavigate();
  const { status, session } = useAuthState();

  useEffect(() => {
    if (status === "ready" && session) navigate({ to: homeForRole(session.role), replace: true });
  }, [status, session, navigate]);

  return (
    <div className="min-h-screen bg-background">
      <GovStripe />

      <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3">
          <span className="text-primary">
            <ScanShieldMark />
          </span>
          <nav className="flex items-center gap-2">
            <Link
              to="/auth"
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Staff portal
            </Link>
            <Link
              to="/auth"
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Sign in
            </Link>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="hero-navy">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-14 lg:grid-cols-[1.05fr_1fr] lg:py-20">
            <div className="rise-in">
              <span className="inline-flex items-center gap-2 rounded-full border border-navy-foreground/25 px-3 py-1 text-xs font-medium opacity-90">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
                AI-Powered Legal Metrology Compliance Platform
              </span>
              <h1 className="mt-5 text-4xl leading-[1.1] font-semibold tracking-tight sm:text-5xl">
                Smarter package compliance.
                <br />
                Safer markets.
              </h1>
              <p className="mt-4 max-w-xl text-base leading-relaxed opacity-80">
                Capture a packaged product, extract visible declarations with AI, evaluate applicable Legal
                Metrology requirements, and support human-reviewed compliance decisions.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link
                  to="/auth"
                  className="inline-flex h-12 items-center rounded-md bg-accent px-6 text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90"
                >
                  Check a package
                </Link>
                <Link
                  to="/auth"
                  className="inline-flex h-12 items-center rounded-md border border-navy-foreground/30 px-6 text-sm font-semibold transition-colors hover:bg-navy-foreground/10"
                >
                  Sign in
                </Link>
              </div>
              <p className="mt-5 text-xs opacity-60">Hackathon demo environment</p>
            </div>

            <div className="rise-in">
              <img
                src={heroImage}
                alt="Packaged carton and pouch being scanned for label declarations"
                width={1280}
                height={960}
                className="w-full rounded-xl border border-navy-foreground/15 shadow-2xl"
              />
            </div>
          </div>

          {/* Workflow strip */}
          <div className="border-t border-navy-foreground/12">
            <ol className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-5 text-xs font-medium sm:text-sm">
              {WORKFLOW.map((s, i) => (
                <li key={s.label} className="flex items-center gap-3">
                  <span className="flex items-center gap-2 opacity-90">
                    <s.icon className="h-4 w-4" aria-hidden />
                    {s.label}
                  </span>
                  {i < WORKFLOW.length - 1 ? <span className="opacity-40">→</span> : null}
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Roles */}
        <section className="mx-auto max-w-6xl px-5 py-14">
          <h2 className="text-2xl font-semibold tracking-tight">Built for every role</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Choosing a card only takes you to sign in — access is always decided by your authenticated role.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {ROLES.map((r) => (
              <div key={r.title} className="panel panel-hover flex flex-col p-5">
                <r.icon className="h-6 w-6 text-accent" aria-hidden />
                <h3 className="mt-3 text-base font-semibold">{r.title}</h3>
                <p className="mt-1.5 flex-1 text-sm text-muted-foreground">{r.body}</p>
                <Link
                  to="/auth"
                  className="mt-4 inline-flex h-10 items-center justify-center rounded-md border border-border text-sm font-medium transition-colors hover:bg-muted"
                >
                  {r.cta}
                </Link>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="border-y border-border bg-surface">
          <div className="mx-auto max-w-6xl px-5 py-14">
            <h2 className="text-2xl font-semibold tracking-tight">How it works</h2>
            <ol className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-5">
              {STEPS.map(([title, body], i) => (
                <li key={title} className="panel p-5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/12 text-xs font-semibold text-accent">
                    {i + 1}
                  </span>
                  <h3 className="mt-3 text-sm font-semibold">{title}</h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Features */}
        <section className="mx-auto max-w-6xl px-5 py-14">
          <h2 className="text-2xl font-semibold tracking-tight">Platform capabilities</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map(([Icon, title, body]) => (
              <div key={title} className="panel panel-hover p-5">
                <Icon className="h-5 w-5 text-accent" aria-hidden />
                <h3 className="mt-3 text-sm font-semibold">{title}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Trust */}
        <section className="border-t border-border bg-surface">
          <div className="mx-auto max-w-6xl px-5 py-12">
            <h2 className="text-2xl font-semibold tracking-tight">Built on verifiable practice</h2>
            <ul className="mt-6 flex flex-wrap gap-3">
              {TRUST.map(([Icon, label]) => (
                <li key={label} className="chip">
                  <Icon className="h-3.5 w-3.5" aria-hidden />
                  {label}
                </li>
              ))}
            </ul>
            <div className="mt-6 max-w-3xl">
              <CorpusBanner />
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-background">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-8 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-primary">
            <ScanShieldMark small />
          </span>
          <nav className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
            {["Privacy", "Terms", "Contact", "Security"].map((l) => (
              <Link key={l} to="/auth" className="hover:text-foreground">
                {l}
              </Link>
            ))}
          </nav>
          <p className="text-xs text-muted-foreground">Hackathon demo environment</p>
        </div>
      </footer>
    </div>
  );
}
