import { BottomNav, DesktopNav, RequireRole, TopBar, type NavItem } from "@/components/AppShell";
import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

const items: NavItem[] = [
  { to: "/admin", label: "Overview", icon: "◧" },
  { to: "/admin/inspections", label: "Review", icon: "◎" },
  { to: "/admin/rules", label: "Rules", icon: "§" },
  { to: "/admin/sellers", label: "Sellers", icon: "◈" },
  { to: "/admin/audit", label: "Audit", icon: "▤" },
];

function AdminLayout() {
  return (
    <RequireRole allowed={["ENFORCEMENT_OFFICER", "SUPERVISOR", "ADMIN"]}>
      <div className="flex min-h-screen flex-col bg-background">
        <TopBar title="Enforcement dashboard" />
        <DesktopNav items={items} />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-5">
          <Outlet />
        </main>
        <BottomNav items={items} />
      </div>
    </RequireRole>
  );
}
