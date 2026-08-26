import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/inspector/inspections")({
  component: () => <Outlet />,
});
