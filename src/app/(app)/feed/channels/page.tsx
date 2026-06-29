import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { ChannelsClient } from "./channels-client";

export const metadata: Metadata = {
  title: "Channels | Numen",
  description: "Watch TikTok creators to build your persistent Videos feed.",
};

/**
 * Server component for /feed/channels (Discover Feed Phase 1.2).
 *
 * Auth-gated (defense-in-depth alongside the (app) layout guard, mirrors /discover).
 * The tabbed add panel + watchlist are owned by the client component; the scrape/track
 * writes happen in POST /api/channels/ingest + /api/tracked-accounts.
 */
export default async function ChannelsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  return <ChannelsClient />;
}
