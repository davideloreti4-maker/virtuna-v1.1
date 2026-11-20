/**
 * Is this path a file in the caller's own folder of the private `videos` bucket?
 *
 * Uploads live at `<userId>/<file>` (`use-video-upload.ts`, `composer.tsx`,
 * `resolve-and-rehost.ts`). Every route that hands such a path to the service client must ask
 * this first: the service client is not bound by the bucket's policies, so this check is the
 * only one (/api/analyze, /api/videos/sign).
 *
 * Reading the first folder is not enough. The path reaches storage inside a URL
 * (`…/object/sign/videos/<path>`), and a URL parser rewrites it on the way: ".." climbs out of
 * the folder, "%2e%2e" and ".%2E" are read as "..", a backslash is read as a slash, tabs and
 * line breaks are dropped, and "?" or "#" cut the path short. So anything a URL would rewrite
 * is refused, and a path that passes names the same object as text and as a URL.
 */

/** Escapes, backslashes, the two URL delimiters, and control characters. */
const REWRITTEN_BY_A_URL = /[%\\?#\u0000-\u001f\u007f]/;

export function ownsVideoPath(path: string, userId: string): boolean {
  if (typeof path !== "string" || !userId) return false;
  if (REWRITTEN_BY_A_URL.test(path)) return false;
  const segments = path.split("/");
  if (segments.length < 2 || segments[0] !== userId) return false;
  // Trimmed, because a URL drops the spaces at its end: "<id>/.. " would arrive as "<id>/..".
  return segments.every((segment) => !["", ".", ".."].includes(segment.trim()));
}
