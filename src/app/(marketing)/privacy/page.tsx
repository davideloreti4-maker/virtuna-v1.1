import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | Virtuna",
  description: "Privacy Policy for Virtuna.",
  alternates: {
    canonical: "https://virtuna.ai/privacy",
  },
};

export default function PrivacyPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="text-center max-w-xl">
        <h1 className="text-4xl font-normal text-foreground md:text-5xl">
          Privacy Policy
        </h1>
        <p className="mt-4 text-base text-foreground-muted">
          Coming soon. Last updated: 2026.
        </p>
      </div>
    </main>
  );
}
