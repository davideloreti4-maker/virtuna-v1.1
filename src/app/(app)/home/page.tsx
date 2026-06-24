import type { Metadata } from "next";
import { HomePageLayout } from "@/components/app/home/home-page-layout";

export const metadata: Metadata = {
  title: "Home | Numen",
  description: "Start a Simulation — paste a TikTok link or upload a video.",
};

/**
 * /home — the clean authed landing (SHELL-01, D-18/D-23).
 *
 * A server page inside the (app) group, so it inherits that layout's server
 * getUser() auth gate (redirect /login if unauthenticated) and the AppShell
 * sidebar. Delegates all layout logic to HomePageLayout (client component) so
 * it can react to thread-presence state:
 *
 *   Empty home: greeting at fixed hero anchor + composer below.
 *   Thread active: same greeting anchor — skill content scrolls underneath,
 *   composer pinned at bottom.
 *
 * LOCKED omissions: NO starter chips (D-18), NO demo affordance (D-25 — the
 * first-run demo is Phase 5), NO Simulation list under the composer (the
 * sidebar owns history). The composer is centered here (no route id); on the
 * /analyze/[id] permalink the same composer drops bottom-pinned (its own
 * data-layout signal). What renders above the pinned composer is Phase 2.
 */
export default function HomePage() {
  return <HomePageLayout />;
}
