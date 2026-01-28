import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard | Artificial Societies",
  description: "Manage your AI personas and research simulations.",
};

/**
 * Dashboard page placeholder.
 * Will be replaced with full dashboard UI in subsequent phases.
 */
export default function DashboardPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="font-display text-4xl font-[350] text-white md:text-5xl">
          Dashboard
        </h1>
        <p className="mt-4 text-lg text-foreground-muted">
          Dashboard coming soon
        </p>
      </div>
    </div>
  );
}
