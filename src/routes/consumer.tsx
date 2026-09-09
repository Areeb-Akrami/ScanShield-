import { BottomNav, DesktopNav, RequireRole, TopBar, type NavItem } from "@/components/AppShell";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { ClipboardList, MessageSquare, ScanLine, Scale, User } from "lucide-react";

export const Route = createFileRoute("/consumer")({
  component: ConsumerLayout,
});

const items: NavItem[] = [
  { to: "/consumer", label: "Check", icon: <ScanLine className="h-5 w-5" /> },
  { to: "/consumer/checks", label: "My checks", icon: <ClipboardList className="h-5 w-5" /> },
  { to: "/consumer/complaints", label: "Complaints", icon: <MessageSquare className="h-5 w-5" /> },
  { to: "/consumer/rights", label: "Rights", icon: <Scale className="h-5 w-5" /> },
  { to: "/consumer/account", label: "Account", icon: <User className="h-5 w-5" /> },
];

function ConsumerLayout() {
  return (
    <RequireRole allowed={["CONSUMER", "FIELD_INSPECTOR", "ENFORCEMENT_OFFICER", "SUPERVISOR", "ADMIN"]}>
      <div className="flex min-h-screen flex-col bg-background">
        <TopBar title="Consumer self-check" />
        <DesktopNav items={items} />
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 pb-8">
          <Outlet />
        </main>
        <BottomNav items={items} />
      </div>
    </RequireRole>
  );
}
