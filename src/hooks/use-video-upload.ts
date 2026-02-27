"use client";

import { useState, useCallback, useRef } from "react";
import { nanoid } from "nanoid";
import { createClient } from "@/lib/supabase/client";

interface UseVideoUploadReturn {
  progress: number | undefined;
  upload: (file: File, userId: string) => Promise<string>;
  abort: () => void;
  reset: () => void;
}

/**
 * Hook for uploading video files to Supabase Storage with simulated progress.
 *
 * Supabase JS `storage.upload()` doesn't expose XHR progress events, so we
 * simulate progress: 0→90% over an estimated duration based on file size,
 * then jump to 100% on completion.
 */
export function useVideoUpload(): UseVideoUploadReturn {
  const [progress, setProgress] = useState<number | undefined>(undefined);
  const abortRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cleanup = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const upload = useCallback(
    async (file: File, userId: string): Promise<string> => {
      abortRef.current = false;
      setProgress(0);

      // Estimate upload time: ~1s per MB (conservative for most connections)
      const estimatedMs = Math.max(2000, (file.size / (1024 * 1024)) * 1000);
      const startTime = Date.now();

      // Simulate progress 0→90 over estimated time
      intervalRef.current = setInterval(() => {
        if (abortRef.current) {
          cleanup();
          return;
        }
        const elapsed = Date.now() - startTime;
        const simulated = Math.min(90, (elapsed / estimatedMs) * 90);
        setProgress(Math.round(simulated));
      }, 200);

      try {
        const ext = file.name.split(".").pop()?.toLowerCase() ?? "mp4";
        const storagePath = `${userId}/${nanoid()}.${ext}`;

        const supabase = createClient();
        const { error } = await supabase.storage
          .from("videos")
          .upload(storagePath, file, {
            cacheControl: "3600",
            upsert: false,
          });

        if (abortRef.current) {
          // Upload completed but user cancelled — best-effort delete
          await supabase.storage.from("videos").remove([storagePath]);
          throw new Error("Upload cancelled");
        }

        if (error) {
          throw new Error(`Video upload failed: ${error.message}`);
        }

        cleanup();
        setProgress(100);
        return storagePath;
      } catch (err) {
        cleanup();
        setProgress(undefined);
        throw err;
      }
    },
    [cleanup]
  );

  const abort = useCallback(() => {
    abortRef.current = true;
    cleanup();
    setProgress(undefined);
  }, [cleanup]);

  const reset = useCallback(() => {
    abortRef.current = false;
    cleanup();
    setProgress(undefined);
  }, [cleanup]);

  return { progress, upload, abort, reset };
}
