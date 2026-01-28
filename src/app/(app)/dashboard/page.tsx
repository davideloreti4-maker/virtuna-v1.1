import type { Metadata } from "next";
import {
  NetworkVisualization,
  FilterPillGroup,
  ContextBar,
} from "@/components/app";

export const metadata: Metadata = {
  title: "Dashboard | Artificial Societies",
  description: "Manage your AI personas and research simulations.",
};

/**
 * Dashboard page with network visualization.
 * Shows animated dot visualization with context bar and filter pills.
 */
export default function DashboardPage() {
  return (
    <div className="relative flex h-full flex-col bg-background">
      {/* Top bar with context and filters */}
      <div className="relative z-10 flex items-center justify-between px-6 py-4">
        <ContextBar location="Switzerland" />
        <FilterPillGroup />
      </div>

      {/* Network visualization fills remaining space */}
      <div className="relative flex-1">
        <NetworkVisualization />
      </div>

      {/* Accessible heading - hidden visually */}
      <h1 className="sr-only">Dashboard</h1>
    </div>
  );
}
