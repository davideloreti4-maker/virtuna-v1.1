/**
 * /audience/new — Create audience page (full page, mobile-first, not a modal).
 */

import { AudienceForm } from "@/components/audience/audience-form";

export const metadata = {
  title: "Create audience — Numen",
};

export default function NewAudiencePage() {
  return (
    <main className="mx-auto max-w-2xl p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Create audience</h1>
        <p className="mt-1 text-sm text-foreground-secondary">
          Name your audience, then calibrate it from your @handle or a description.
        </p>
      </div>
      <AudienceForm />
    </main>
  );
}
