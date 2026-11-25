"use client";

import { useEffect, useState } from "react";

type Meta = { file: File; durationSec: number | null; thumbnail: string | null };

/**
 * A picked video's length and a still frame, read in the browser before upload. Lifted from
 * `VideoUpload`'s effect so the new-look field's tile can show the same two things.
 *
 * It makes one object URL per file and revokes it once the frame is drawn, on a decode error,
 * when the file changes, and on unmount: an unrevoked URL pins the whole file in memory.
 *
 * The one change from the lifted code: what it read is stored WITH the file it belongs to, and
 * a different (or no) file reads as nulls. The original reset both values with a synchronous
 * setState in the effect, which `react-hooks/set-state-in-effect` refuses; keying them gives the
 * same nulls without it, and a direct A → B swap no longer shows A's frame under B's name.
 */
export function useVideoMeta(file: File | null): {
  durationSec: number | null;
  thumbnail: string | null;
} {
  const [meta, setMeta] = useState<Meta | null>(null);

  // Extract thumbnail and duration from video file
  useEffect(() => {
    if (!file) return;

    const objectUrl = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;

    const cleanup = () => {
      URL.revokeObjectURL(objectUrl);
      video.removeAttribute("src");
      video.load();
    };

    video.onloadeddata = () => {
      const durationSec = video.duration;
      setMeta((m) => ({ file, durationSec, thumbnail: m?.file === file ? m.thumbnail : null }));

      // Seek to a small offset to get a meaningful frame
      video.currentTime = Math.min(0.5, video.duration / 4);
    };

    video.onseeked = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const thumbnail = canvas.toDataURL("image/jpeg", 0.7);
          setMeta((m) => ({ file, durationSec: m?.file === file ? m.durationSec : null, thumbnail }));
        }
      } catch {
        // Thumbnail extraction failed silently — preview will show without thumbnail
      }
      cleanup();
    };

    video.onerror = () => {
      cleanup();
    };

    video.src = objectUrl;

    return () => {
      cleanup();
    };
  }, [file]);

  const current = meta !== null && meta.file === file ? meta : null;
  return { durationSec: current?.durationSec ?? null, thumbnail: current?.thumbnail ?? null };
}
