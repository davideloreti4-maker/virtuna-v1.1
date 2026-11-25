import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { VideoNext } from "@/components/discover-next/video-next";
import { getLibraryVideo } from "@/lib/discover-next/library-video-read";
import type { LibraryVideo } from "@/lib/discover-next/video";
import { NEW_LOOK_ENABLED } from "@/lib/flags/new-look";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Video | Maven",
};

/**
 * /feed/video/[id]: a library video's page (spec 3.3). New look only: with the flag off it does not
 * exist. Signed out: nothing (the (app) layout and the middleware send the visitor to log in).
 *
 * The video is read here, after the session check, through the library's service read (the library's
 * table has no row policies, so the browser cannot read it). A video that is not in the library is the
 * page's own "gone" state, not a 404: a saved video can outlive its row, and the page says so with a
 * way back. A read that fails is the page's failure state, with Try again.
 */
export default async function VideoPage({ params }: { params: Promise<{ id: string }> }) {
  if (!NEW_LOOK_ENABLED) notFound();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { id } = await params;
  let video: LibraryVideo | null;
  try {
    video = await getLibraryVideo(id);
  } catch (error) {
    console.error("[discover] video read failed", error);
    return <VideoNext video={null} failed />;
  }
  // Gone, the id rides along: a saved row of that video may still open its original.
  return video ? <VideoNext video={video} /> : <VideoNext video={null} id={id} />;
}
