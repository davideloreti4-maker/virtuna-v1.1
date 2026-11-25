/**
 * The video of a run this device started, so the running screen can play it while the run is in
 * flight (the stored row carries no file until the run finishes). Kept in memory only: after a
 * reload, or on another device, the running screen has no video and shows the scene frames.
 *
 * An entry that is dropped (replaced by another video for the same run, or pushed out by newer
 * runs) is let go: a `blob:` address is revoked (`URL.revokeObjectURL`), so the browser frees the
 * file it holds for it. A signed https address needs nothing.
 */

/** A device starts few runs between reloads; the oldest are let go. */
const KEPT = 8;
const videos = new Map<string, string>();

function letGo(src: string): void {
  if (src.startsWith("blob:") && typeof URL.revokeObjectURL === "function") URL.revokeObjectURL(src);
}

/** `src` is something a video element can play: an object URL of the file, or a signed address. */
export function rememberRunVideo(id: string, src: string): void {
  const before = videos.get(id);
  if (before !== undefined && before !== src) letGo(before);
  videos.delete(id);
  videos.set(id, src);
  while (videos.size > KEPT) {
    const [oldest, oldSrc] = videos.entries().next().value!;
    videos.delete(oldest);
    letGo(oldSrc);
  }
}

export function runVideoOf(id: string): string | null {
  return videos.get(id) ?? null;
}

/** For tests: forgets every run (and lets their videos go). */
export function forgetRunVideos(): void {
  for (const src of videos.values()) letGo(src);
  videos.clear();
}
