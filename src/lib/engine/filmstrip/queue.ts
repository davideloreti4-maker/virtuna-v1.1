/**
 * Filmstrip generation trigger (D-11).
 *
 * Fire-and-forget: dispatches a POST to /api/filmstrip/extract without awaiting.
 * Pipeline.ts calls this at wave_0_complete and immediately continues — filmstrip
 * latency must NEVER count against the 60s engine SLA.
 */
import { createLogger } from "@/lib/logger";
import type { SegmentGrid } from "@/lib/engine/types";

const log = createLogger({ module: "engine.filmstrip.queue" });

/**
 * Trigger background filmstrip generation for the given analysis.
 *
 * Returns void synchronously — the fetch promise is explicitly discarded.
 * Errors are logged but never propagated (graceful degradation).
 */
export function triggerFilmstripGeneration(
  analysisId: string,
  segments: SegmentGrid[],
  videoUrl: string,
): void {
  log.info("filmstrip generation triggered", { analysisId, segmentCount: segments.length });

  void fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/filmstrip/extract`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.FILMSTRIP_EXTRACT_SECRET ?? ""}`,
    },
    body: JSON.stringify({ analysisId, segments, videoUrl }),
  }).catch((err: unknown) => {
    log.error("filmstrip trigger failed", { analysisId, error: String(err) });
  });
}
