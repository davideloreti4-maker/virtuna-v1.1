/**
 * /audience/new — Create audience page (full page, mobile-first, not a modal).
 * Renders inside (app)/layout.tsx → AppShell. In-shell content <div> (no nested <main>).
 */

import { AudienceForm } from "@/components/audience/audience-form";

export const metadata = {
  title: "Create audience | Numen",
};

export default function NewAudiencePage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-6 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-medium text-foreground">Create audience</h1>
        <p className="mt-1 text-sm text-foreground-secondary">
          Name your audience, then calibrate it from your @handle or a description.
        </p>
      </div>
      <AudienceForm />
    </div>
  );
}
