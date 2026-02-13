import type { Metadata } from "next";
import { Suspense } from "react";
import { DashboardClient } from "./dashboard-client";

export const metadata: Metadata = {
  title: "Dashboard | Artificial Societies",
  description: "Manage your AI personas and research simulations.",
};

/**
 * Dashboard page with network visualization and test creation flow.
 * Server component wrapper for metadata, client component handles interactivity.
 * Suspense boundary required by Next.js 15 for useSearchParams in DashboardClient.
 */
export default function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <DashboardClient />
    </Suspense>
  );
}
