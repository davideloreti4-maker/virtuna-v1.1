"use client";

import { useQuery, type QueryClient } from "@tanstack/react-query";

/** The signed address lasts an hour (api/videos/sign); ask again well before it runs out. */
const FRESH_MS = 50 * 60_000;

const signKey = (path: string | null) => ["video-sign", path] as const;

export type SignedVideoStatus = "idle" | "loading" | "ready" | "missing";

/**
 * The playable address of a stored video. `GET /api/videos/sign?path=…` answers `{ url }`; a file
 * that is gone (retention, never uploaded) answers 404 and is "missing". No path: "idle".
 */
export function useSignedVideo(path: string | null): { src: string | null; status: SignedVideoStatus } {
  const query = useQuery({
    queryKey: signKey(path),
    queryFn: async (): Promise<string | null> => {
      const response = await fetch(`/api/videos/sign?path=${encodeURIComponent(path ?? "")}`);
      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`Could not sign the video (${response.status})`);
      const body = (await response.json()) as { url?: unknown };
      return typeof body.url === "string" && body.url ? body.url : null;
    },
    enabled: path != null,
    staleTime: FRESH_MS,
    gcTime: FRESH_MS,
    retry: 1,
  });

  if (path == null) return { src: null, status: "idle" };
  if (query.data) return { src: query.data, status: "ready" };
  if (query.isPending) return { src: null, status: "loading" };
  return { src: null, status: "missing" };
}

/**
 * Put an address in place of the signed one, so `useSignedVideo(path)` answers it without asking
 * the server. For the dev page (`/dev/result?video=…`), which plays a local file on a recorded run.
 */
export function seedSignedVideo(client: QueryClient, path: string, url: string): void {
  client.setQueryData(signKey(path), url);
}
