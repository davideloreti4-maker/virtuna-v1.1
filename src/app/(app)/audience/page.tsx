/**
 * /audience — Audience Manager list page.
 * Renders inside (app)/layout.tsx → AppShell (sidebar, AuthGuard, providers).
 * AppShell owns the page <main>; this is an in-shell content <div> (no nested <main>).
 */

import { AudienceManager } from "@/components/audience/audience-manager";

export const metadata = {
  title: "Your audiences | Numen",
};

export default function AudiencePage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-6 sm:p-6 space-y-6">
      <AudienceManager />
    </div>
  );
}
