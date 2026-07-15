import type { Metadata } from "next";
import { HomePageLayout } from "@/components/app/home/home-page-layout";

export const metadata: Metadata = {
  title: "New thread | Maven",
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
 * P7 unlock (UX-05 / D-04): the previously-LOCKED-empty region now seeds the 3
 * starter chips + the show-once first-run demo — rendered by the composer in its
 * no-conversation region (HomeStarter), so the chip handlers reach the real
 * composer-internal flows directly. The earlier P5 lock (chips + demo deferred to
 * Phase 5 under D-18/D-25) is now retired. Still no Simulation
 * list under the composer (the sidebar owns history). The composer is
 * centered here (no route id); on the /analyze/[id] permalink the same composer
 * drops bottom-pinned (its own data-layout signal).
 */
export default function HomePage() {
  return <HomePageLayout />;
}
