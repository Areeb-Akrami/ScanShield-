import { RequireRole } from "@/components/AppShell";
import { cn } from "@/lib/utils";
import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/users")({
  component: UsersLayout,
});

const tabs = [
  { to: "/admin/users/staff", label: "Inspectors & officers" },
  { to: "/admin/users/customers", label: "Customers" },
];

function UsersLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <RequireRole allowed={["ADMIN"]}>
      <div className="space-y-4">
        <div>
          <h1 className="text-lg font-semibold">User management</h1>
          <p className="text-sm text-muted-foreground">
            Staff accounts and customer accounts are managed separately.
          </p>
        </div>
        <nav className="flex gap-1 border-b border-border">
          {tabs.map((t) => {
            const active = pathname.startsWith(t.to);
            return (
              <Link
                key={t.to}
                to={t.to}
                className={cn(
                  "border-b-2 px-3 py-2 text-sm font-medium",
                  active
                    ? "border-accent text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>
        <Outlet />
      </div>
    </RequireRole>
  );
}
