import { CreatorNext } from "@/components/discover-next/creator-next";
import { getCreatorPage } from "@/lib/discover/creator-read";
import type { CreatorRead } from "@/lib/discover-next/creator";
import { createClient } from "@/lib/supabase/server";

/**
 * /competitors/<handle> under the new look: a followed creator's page (spec 2026-11-25-creator-page).
 * Signed out: nothing (the layout and the middleware send the visitor to log in). A creator not on the
 * caller's watchlist is the page's own "gone" state, not a 404: Back after a Remove lands here. A read that
 * fails is the page's failure state, and is logged.
 */
export async function creatorPage(params: Promise<{ handle: string }>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { handle } = await params;
  let read: CreatorRead;
  try {
    read = await getCreatorPage(supabase, handle, new Date());
  } catch (error) {
    console.error("[discover] creator read failed", error);
    read = { state: "failed" };
  }
  return <CreatorNext read={read} />;
}
