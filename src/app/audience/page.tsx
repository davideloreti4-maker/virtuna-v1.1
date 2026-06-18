/**
 * /audience — Audience Manager list page (server component shell).
 */

import { AudienceManager } from "@/components/audience/audience-manager";

export const metadata = {
  title: "Your audiences — Numen",
};

export default function AudiencePage() {
  return (
    <main className="mx-auto max-w-4xl p-6">
      <AudienceManager />
    </main>
  );
}
