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
  // CR-04: abort early when FILMSTRIP_EXTRACT_SECRET is not set rather than
  // silently sending "Bearer " (empty token). An absent secret means auth will
  // fail on the receiving route, so we skip the request entirely and log the
  // misconfiguration so it is visible in observability tooling.
  const secret = process.env.FILMSTRIP_EXTRACT_SECRET;
  if (!secret) {
    log.error("filmstrip trigger skipped: FILMSTRIP_EXTRACT_SECRET not set", { analysisId });
    return;
  }

  log.info("filmstrip generation triggered", { analysisId, segmentCount: segments.length });

  void fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/filmstrip/extract`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${secret}`,
    },
    body: JSON.stringify({ analysisId, segments, videoUrl }),
  }).catch((err: unknown) => {
    log.error("filmstrip trigger failed", { analysisId, error: String(err) });
  });
}
