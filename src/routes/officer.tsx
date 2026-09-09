import { BottomNav, DesktopNav, RequireRole, TopBar, type NavItem } from "@/components/AppShell";
import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/officer")({
  component: OfficerLayout,
});

const items: NavItem[] = [
  { to: "/officer", label: "Dashboard", icon: "◧" },
  { to: "/officer/review", label: "Queue", icon: "◎" },
  { to: "/officer/sellers", label: "Sellers", icon: "◈" },
  { to: "/officer/reports", label: "Reports", icon: "▤" },
  { to: "/officer/analytics", label: "Analytics", icon: "◍" },
  { to: "/officer/notifications", label: "Notices", icon: "◉" },
  { to: "/officer/profile", label: "Profile", icon: "☰" },
];

function OfficerLayout() {
  return (
    <RequireRole allowed={["ENFORCEMENT_OFFICER", "SUPERVISOR", "ADMIN"]}>
      <div className="flex min-h-screen flex-col bg-background">
        <TopBar title="Enforcement officer" />
        <DesktopNav items={items} />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-5">
          <Outlet />
        </main>
        <BottomNav items={items.slice(0, 5)} />
      </div>
    </RequireRole>
  );
}
