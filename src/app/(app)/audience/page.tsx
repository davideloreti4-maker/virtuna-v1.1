/**
 * /audience — Audience Manager list page (the MOAT surface).
 * Renders inside (app)/layout.tsx → AppShell (sidebar, AuthGuard, providers).
 * AppShell owns the page <main>; AudienceManager renders the full-bleed radial
 * surface shell itself (relative min-h-full), mirroring /start · /grow — so do
 * NOT wrap it in a max-w container here.
 */

import { AudienceManager } from "@/components/audience/audience-manager";

export const metadata = {
  title: "Your audiences | Maven",
};

export default function AudiencePage() {
  return <AudienceManager />;
}
