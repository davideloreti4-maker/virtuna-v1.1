import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Trending | Virtuna",
  description: "Discover trending content and sounds on TikTok.",
};

/**
 * Trending page placeholder.
 * Will be populated with real trending data in a later phase.
 */
export default function TrendingPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <h1 className="text-2xl font-semibold text-foreground">Trending</h1>
      <p className="mt-2 text-sm text-foreground-muted">
        Trending content analysis coming soon.
      </p>
    </div>
  );
}
