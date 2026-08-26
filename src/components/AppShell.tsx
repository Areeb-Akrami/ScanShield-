import { getSession, homeForRole, signOut, type Session } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

export interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
}

export function GovStripe() {
  return <div className="gov-stripe h-1 w-full" aria-hidden />;
}

export function ScanShieldMark({ small = false }: { small?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <svg viewBox="0 0 24 24" className={small ? "h-5 w-5" : "h-6 w-6"} aria-hidden>
        <path
          d="M12 2.5 4.5 5.5v6c0 4.6 3.1 8.6 7.5 10 4.4-1.4 7.5-5.4 7.5-10v-6L12 2.5Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
        />
        <path d="M8 11.5h8M8 9h8M8 14h5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
      <span className={cn("font-semibold tracking-tight", small ? "text-sm" : "text-base")}>
        Scan<span className="text-accent">Shield</span>
      </span>
    </span>
  );
}

export function useSession(): Session | null {
  const [session, setSession] = useState<Session | null>(null);
  useEffect(() => {
    setSession(getSession());
  }, []);
  return session;
}

export function useOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online;
}

export function TopBar({ title, subtitle }: { title: string; subtitle?: string }) {
  const session = useSession();
  const online = useOnline();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-primary text-primary-foreground">
      <GovStripe />
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <Link to="/" className="opacity-95">
            <ScanShieldMark small />
          </Link>
          <p className="mt-0.5 truncate text-xs opacity-80">
            {title}
            {subtitle ? ` · ${subtitle}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span
            className={cn(
              "hidden items-center gap-1.5 text-[11px] font-medium sm:inline-flex",
              online ? "opacity-90" : "opacity-100",
            )}
          >
            <span className={cn("h-2 w-2 rounded-full", online ? "bg-pass" : "bg-review")} />
            {online ? "Online" : "Offline mode"}
          </span>
          {session ? (
            <button
              onClick={() => {
                signOut();
                navigate({ to: "/" });
              }}
              className="rounded border border-primary-foreground/30 px-2.5 py-1 text-[11px] font-medium hover:bg-primary-foreground/10"
            >
              {session.name.split(" ")[0]} · Sign out
            </button>
          ) : (
            <Link to="/" className="text-[11px] underline underline-offset-2">
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

export function BottomNav({ items }: { items: NavItem[] }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="sticky bottom-0 z-20 border-t border-border bg-card lg:hidden">
      <ul className="mx-auto grid max-w-6xl grid-cols-5">
        {items.map((item) => {
          const active = pathname === item.to || (item.to !== "/" && pathname.startsWith(`${item.to}/`));
          return (
            <li key={item.to}>
              <Link
                to={item.to}
                className={cn(
                  "flex min-h-[56px] flex-col items-center justify-center gap-1 px-1 py-2 text-[10px] font-medium",
                  active ? "text-accent" : "text-muted-foreground",
                )}
              >
                <span aria-hidden>{item.icon}</span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function DesktopNav({ items }: { items: NavItem[] }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="hidden border-b border-border bg-surface lg:block">
      <ul className="mx-auto flex max-w-6xl gap-1 px-4">
        {items.map((item) => {
          const active = pathname === item.to || (item.to !== "/" && pathname.startsWith(`${item.to}/`));
          return (
            <li key={item.to}>
              <Link
                to={item.to}
                className={cn(
                  "inline-flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium",
                  active
                    ? "border-accent text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function RequireRole({
  allowed,
  children,
}: {
  allowed: Session["role"][];
  children: ReactNode;
}) {
  const [state, setState] = useState<"checking" | "ok" | "denied">("checking");
  const navigate = useNavigate();

  useEffect(() => {
    const s = getSession();
    if (!s) {
      navigate({ to: "/" });
      return;
    }
    if (!allowed.includes(s.role)) {
      setState("denied");
      return;
    }
    setState("ok");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (state === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Verifying session…
      </div>
    );
  }
  if (state === "denied") {
    const s = getSession();
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
        <h1 className="text-lg font-semibold">Access restricted</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Your role ({s?.role.replaceAll("_", " ").toLowerCase()}) is not authorised for this area.
          Role-based authorisation is enforced on every workspace.
        </p>
        <Link
          to={s ? homeForRole(s.role) : "/"}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Go to my workspace
        </Link>
      </div>
    );
  }
  return <>{children}</>;
}
