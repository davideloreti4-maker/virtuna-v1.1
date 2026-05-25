import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service | Virtuna",
  description: "Terms of Service for Virtuna.",
  alternates: {
    canonical: "https://virtuna.ai/terms",
  },
};

export default function TermsPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="text-center max-w-xl">
        <h1 className="text-4xl font-normal text-foreground md:text-5xl">
          Terms of Service
        </h1>
        <p className="mt-4 text-base text-foreground-muted">
          Coming soon. Last updated: 2026.
        </p>
      </div>
    </main>
  );
}
