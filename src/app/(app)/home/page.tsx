import type { Metadata } from "next";
import { HomeGreeting } from "@/components/app/home/home-greeting";
import { Composer } from "@/components/app/home/composer";

export const metadata: Metadata = {
  title: "Home | Numen",
  description: "Start a Simulation — paste a TikTok link or upload a video.",
};

/**
 * /home — the clean authed landing (SHELL-01, D-18/D-23).
 *
 * A server page inside the (app) group, so it inherits that layout's server
 * getUser() auth gate (redirect /login if unauthenticated) and the AppShell
 * sidebar. It composes the two client pieces — the serif greeting and the
 * centered universal composer — in the ~760px readable column (D-17).
 *
 * LOCKED omissions: NO starter chips (D-18), NO demo affordance (D-25 — the
 * first-run demo is Phase 5), NO Simulation list under the composer (the
 * sidebar owns history). The composer is centered here (no route id); on the
 * /analyze/[id] permalink the same composer drops bottom-pinned (its own
 * data-layout signal). What renders above the pinned composer is Phase 2.
 */
export default function HomePage() {
  return (
    <div className="flex min-h-full w-full flex-col items-center justify-center px-4 py-12">
      <div className="flex w-full max-w-[760px] flex-col items-center gap-8">
        <HomeGreeting />
        <Composer />
      </div>
    </div>
  );
}
