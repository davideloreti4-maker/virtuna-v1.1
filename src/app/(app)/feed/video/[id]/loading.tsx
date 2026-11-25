import { VideoNextLoading } from "@/components/discover-next/video-next";
import { NEW_LOOK_ENABLED } from "@/lib/flags/new-look";

/** A video's page while it is read: its own outline under the new look. Without it the page does not exist. */
export default function VideoLoading() {
  if (NEW_LOOK_ENABLED) return <VideoNextLoading />;
  return null;
}
