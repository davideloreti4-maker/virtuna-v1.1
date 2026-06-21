import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { DiscoverClient } from "./discover-client";

export const metadata: Metadata = {
  title: "Discover | Numen",
  description: "Surface the outliers already beating their own baseline — then Remix the winner.",
};

/**
 * Server component for the /discover view (Phase 08, Plan 03 — D-13/D-14/D-16).
 *
 * Auth-gated (defense-in-depth alongside the (app) layout guard). The browsable
 * outlier grid + one-entry-two-modes pull are owned by the client component; the
 * actual scrape/rank/cache happens server-side in POST /api/discover (08-02).
 */
export default async function DiscoverPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  return <DiscoverClient />;
}
