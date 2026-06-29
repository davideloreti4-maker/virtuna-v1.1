import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { FeedClient } from "./feed-client";

export const metadata: Metadata = {
  title: "Videos | Numen",
  description: "Outliers from the channels you watch, plus what's trending — Remix any winner into a Read.",
};

/**
 * Server component for /feed (Discover Feed Phase 2.2).
 *
 * Auth-gated (defense-in-depth alongside the (app) layout guard, mirrors /discover +
 * /feed/channels). The Watched | Trending tabs, filters, sort, and infinite-scroll grid
 * are owned by the client component; the filtered/sorted/keyset read happens in
 * GET /api/feed (Phase 2.1).
 */
export default async function FeedPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  return <FeedClient />;
}
