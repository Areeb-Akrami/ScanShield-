import { BottomNav, DesktopNav, RequireRole, TopBar, type NavItem } from "@/components/AppShell";
import { SyncBar } from "@/components/SyncBar";
import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/inspector")({
  component: InspectorLayout,
});

const items: NavItem[] = [
  { to: "/inspector", label: "Home", icon: "◧" },
  { to: "/inspector/inspections", label: "Inspections", icon: "≣" },
  { to: "/inspector/scan", label: "Scan", icon: "◎" },
  { to: "/inspector/reports", label: "Reports", icon: "▤" },
  { to: "/inspector/profile", label: "Profile", icon: "◉" },
];

function InspectorLayout() {
  return (
    <RequireRole allowed={["FIELD_INSPECTOR", "ENFORCEMENT_OFFICER", "SUPERVISOR", "ADMIN"]}>
      <div className="flex min-h-screen flex-col bg-background">
        <TopBar title="Field inspector workspace" />
        <DesktopNav items={items} />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-5">
          <Outlet />
        </main>
        <BottomNav items={items} />
      </div>
    </RequireRole>
  );
}
