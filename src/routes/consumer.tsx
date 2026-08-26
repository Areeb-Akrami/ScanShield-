import { BottomNav, DesktopNav, RequireRole, TopBar, type NavItem } from "@/components/AppShell";
import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/consumer")({
  component: ConsumerLayout,
});

const items: NavItem[] = [
  { to: "/consumer", label: "Check", icon: "◎" },
  { to: "/consumer/rights", label: "Rights", icon: "§" },
  { to: "/consumer/complaints", label: "Complaints", icon: "✎" },
];

function ConsumerLayout() {
  return (
    <RequireRole allowed={["CONSUMER", "FIELD_INSPECTOR", "ENFORCEMENT_OFFICER", "SUPERVISOR", "ADMIN"]}>
      <div className="flex min-h-screen flex-col bg-background">
        <TopBar title="Consumer self-check" />
        <DesktopNav items={items} />
        <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-5">
          <Outlet />
        </main>
        <BottomNav items={items} />
      </div>
    </RequireRole>
  );
}
