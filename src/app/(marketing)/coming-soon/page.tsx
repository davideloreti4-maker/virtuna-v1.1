import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Coming Soon | Artificial Societies",
  description: "This page is under construction. Check back later.",
};

/**
 * Coming Soon page for unbuilt routes (Pricing, Blog, etc.)
 * Minimal, centered design matching the dark theme.
 */
export default function ComingSoonPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="text-center">
        <h1 className="font-display text-4xl font-[350] text-white md:text-5xl">
          Coming Soon
        </h1>
        <p className="mt-4 text-lg text-foreground-muted">
          This page is under construction. Check back later.
        </p>
        <Link
          href="/"
          className="mt-8 inline-block rounded bg-accent px-6 py-3 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/90"
        >
          Go back home
        </Link>
      </div>
    </main>
  );
}
