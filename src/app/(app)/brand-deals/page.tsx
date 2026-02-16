import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Earnings | Virtuna",
  description: "Track your earnings and brand deal opportunities.",
};

/**
 * Earnings (Brand Deals) page placeholder.
 * Will be populated with real earnings data in a later phase.
 */
export default function BrandDealsPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <h1 className="text-2xl font-semibold text-foreground">Earnings</h1>
      <p className="mt-2 text-sm text-foreground-muted">
        Brand deal tracking and earnings coming soon.
      </p>
    </div>
  );
}
