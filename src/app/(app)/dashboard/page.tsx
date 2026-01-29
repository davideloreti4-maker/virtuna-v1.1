import type { Metadata } from "next";
import { DashboardClient } from "./dashboard-client";

export const metadata: Metadata = {
  title: "Dashboard | Artificial Societies",
  description: "Manage your AI personas and research simulations.",
};

/**
 * Dashboard page with network visualization and test creation flow.
 * Server component wrapper for metadata, client component handles interactivity.
 */
export default function DashboardPage() {
  return <DashboardClient />;
}
