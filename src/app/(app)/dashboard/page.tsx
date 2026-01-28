import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard | Artificial Societies",
  description: "Manage your AI personas and research simulations.",
};

/**
 * Dashboard page.
 * Network visualization area will be built in Plan 04.
 */
export default function DashboardPage() {
  return (
    <div className="h-full w-full">
      {/* Accessible heading - hidden visually */}
      <h1 className="sr-only">Dashboard</h1>

      {/* Main content area - network visualization goes here in Plan 04 */}
      <div className="flex h-full items-center justify-center">
        {/* Placeholder for network visualization */}
      </div>
    </div>
  );
}
