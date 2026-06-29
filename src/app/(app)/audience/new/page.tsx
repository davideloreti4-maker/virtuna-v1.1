/**
 * /audience/new — Create audience page (full page, mobile-first, not a modal).
 * Renders inside (app)/layout.tsx → AppShell. In-shell content <div> (no nested <main>).
 */

import { AudienceForm } from "@/components/audience/audience-form";

export const metadata = {
  title: "Create audience | Numen",
};

export default async function NewAudiencePage({
  searchParams,
}: {
  // Next 16 — searchParams is a Promise.
  searchParams: Promise<{ mode?: string }>;
}) {
  const sp = await searchParams;
  // D-08 — the description Build path lands a General SIM; any other/absent value
  // keeps the byte-identical Socials default.
  const initialMode = sp.mode === "general" ? "general" : undefined;
  return (
    <div className="max-w-2xl mx-auto px-4 py-6 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-medium text-foreground">Create audience</h1>
        <p className="mt-1 text-sm text-foreground-secondary">
          Name your audience, then calibrate it from your @handle or a description.
        </p>
      </div>
      <AudienceForm initialMode={initialMode} />
    </div>
  );
}
