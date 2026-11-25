/**
 * The checks a picked video must pass before upload, shared by `VideoUpload` and the new-look
 * message field so both refuse the same files with the same words. Lifted verbatim from
 * `src/components/app/video-upload.tsx`; change a message here and both surfaces change.
 */

/** 200 MB — the upload limit. */
export const VIDEO_MAX_BYTES = 200 * 1024 * 1024; // 200MB

/** The file input's `accept`. Broader than the type list below on purpose: the picker offers
 *  any video and `validateVideoFile` names the formats when one is refused. */
export const VIDEO_ACCEPT = "video/*";

const ACCEPTED_VIDEO_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-msvideo",
  "video/x-matroska",
];

/** Format bytes into human-readable string (e.g. "14.2 MB") */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/** A clip's length as a tile shows it, "0:29" (VideoUpload's format). The field's tile and the
 *  thread's tile above a live Simulate turn. Null when the length is not a finite number of
 *  seconds ≥ 0 (a webm recorded in the browser reports Infinity until played): show no length. */
export function formatLength(seconds: number): string | null {
  if (!Number.isFinite(seconds) || seconds < 0) return null;
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

/** null when the file can be uploaded, else the message to show. */
export function validateVideoFile(f: File): string | null {
  if (!ACCEPTED_VIDEO_TYPES.includes(f.type) && !f.name.match(/\.(mp4|mov|webm|avi|mkv)$/i)) {
    return "Please select a video file (MP4, MOV, WebM)";
  }
  if (f.size > VIDEO_MAX_BYTES) {
    return `File too large (${formatFileSize(f.size)}). Maximum size is 200MB.`;
  }
  return null;
}
