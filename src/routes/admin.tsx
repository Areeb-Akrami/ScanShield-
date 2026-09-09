import { BottomNav, DesktopNav, RequireRole, TopBar, useSession, type NavItem } from "@/components/AppShell";
import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

/** Shared with enforcement officers, who review inspections in this dashboard. */
const coreItems: NavItem[] = [
  { to: "/admin", label: "Overview", icon: "◧" },
  { to: "/admin/inspections", label: "Review", icon: "◎" },
  { to: "/admin/rules", label: "Rules", icon: "§" },
  { to: "/admin/sellers", label: "Sellers", icon: "◈" },
  { to: "/admin/audit", label: "Audit", icon: "▤" },
];

/** Administrator-only areas. Each page also enforces the role itself. */
const adminItems: NavItem[] = [
  { to: "/admin/users", label: "Users", icon: "☰" },
  { to: "/admin/analytics", label: "Analytics", icon: "◍" },
  { to: "/admin/sources", label: "Sources", icon: "▣" },
  { to: "/admin/notifications", label: "Notices", icon: "◉" },
  { to: "/admin/settings", label: "Settings", icon: "⚙" },
];

function AdminLayout() {
  const session = useSession();
  const isAdmin = session?.role === "ADMIN";
  const desktopItems = isAdmin ? [...coreItems, ...adminItems] : coreItems;
  // The bottom bar stays legible on a phone, so it carries the core areas only.
  const bottomItems = isAdmin ? [...coreItems.slice(0, 4), adminItems[0]!] : coreItems;

  return (
    <RequireRole allowed={["ENFORCEMENT_OFFICER", "SUPERVISOR", "ADMIN"]}>
      <div className="flex min-h-screen flex-col bg-background">
        <TopBar title="Enforcement dashboard" />
        <DesktopNav items={desktopItems} />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-5">
          <Outlet />
        </main>
        <BottomNav items={bottomItems} />
      </div>
    </RequireRole>
  );
}
