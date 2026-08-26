import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";

/* ---------------- Button ---------------- */

type Variant = "primary" | "outline" | "ghost" | "danger" | "accent";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary: "bg-primary text-primary-foreground hover:opacity-90",
  accent: "bg-accent text-accent-foreground hover:opacity-90",
  outline: "border border-border bg-card text-foreground hover:bg-muted",
  ghost: "text-foreground hover:bg-muted",
  danger: "bg-destructive text-destructive-foreground hover:opacity-90",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-5 text-base",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
}

/* ---------------- Panel ---------------- */

export function Panel({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("panel", className)} {...props} />;
}

export function PanelHeader({
  title,
  subtitle,
  action,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border px-4 py-3">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

/* ---------------- Status pills ---------------- */

export type StatusToken =
  | "PASS"
  | "FAIL"
  | "MANUAL_REVIEW_REQUIRED"
  | "RESCAN_REQUIRED"
  | "INSUFFICIENT_EVIDENCE"
  | "NOT_APPLICABLE"
  | "COMPLIANT"
  | "NON_COMPLIANT"
  | "PARTIALLY_VERIFIED"
  | "HIGH"
  | "MEDIUM"
  | "LOW"
  | "DEMO";

const tokenStyles: Record<string, string> = {
  PASS: "bg-pass/12 text-pass border-pass/30",
  COMPLIANT: "bg-pass/12 text-pass border-pass/30",
  LOW: "bg-pass/12 text-pass border-pass/30",
  FAIL: "bg-fail/12 text-fail border-fail/30",
  NON_COMPLIANT: "bg-fail/12 text-fail border-fail/30",
  HIGH: "bg-fail/12 text-fail border-fail/30",
  MANUAL_REVIEW_REQUIRED: "bg-review/18 text-review-foreground border-review/45",
  MEDIUM: "bg-review/18 text-review-foreground border-review/45",
  PARTIALLY_VERIFIED: "bg-review/18 text-review-foreground border-review/45",
  RESCAN_REQUIRED: "bg-rescan/12 text-rescan border-rescan/30",
  INSUFFICIENT_EVIDENCE: "bg-na/12 text-muted-foreground border-na/30",
  NOT_APPLICABLE: "bg-na/12 text-muted-foreground border-na/30",
  DEMO: "bg-demo/25 text-demo-foreground border-demo/50",
};

export const STATUS_LABELS: Record<string, string> = {
  PASS: "Pass",
  FAIL: "Fail",
  MANUAL_REVIEW_REQUIRED: "Manual review required",
  RESCAN_REQUIRED: "Rescan required",
  INSUFFICIENT_EVIDENCE: "Insufficient evidence",
  NOT_APPLICABLE: "Not applicable",
  COMPLIANT: "Compliant",
  NON_COMPLIANT: "Non-compliant",
  PARTIALLY_VERIFIED: "Partially verified",
};

export function StatusPill({
  token,
  label,
  className,
}: {
  token: string;
  label?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        tokenStyles[token] ?? tokenStyles["NOT_APPLICABLE"],
        className,
      )}
    >
      {label ?? STATUS_LABELS[token] ?? token.replaceAll("_", " ")}
    </span>
  );
}

export function DemoBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded border border-demo/50 bg-demo/25 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-demo-foreground uppercase",
        className,
      )}
      title="Demo data — not official government data"
    >
      Demo data
    </span>
  );
}

/* ---------------- Stat ---------------- */

export function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "pass" | "fail" | "review" | "default";
}) {
  const toneClass =
    tone === "pass" ? "text-pass" : tone === "fail" ? "text-fail" : tone === "review" ? "text-review-foreground" : "text-foreground";
  return (
    <div className="panel p-4">
      <p className="label-caps">{label}</p>
      <p className={cn("mt-1.5 text-2xl font-semibold tabular-nums", toneClass)}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="label-caps">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

export function inputClass(extra?: string) {
  return cn(
    "w-full rounded-md border border-input bg-card px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30",
    extra,
  );
}
