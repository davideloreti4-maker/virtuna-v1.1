/**
 * THE AUDIO MIX INVARIANT — one guard, on both paths that actually run.
 *
 * `silence_ratio + voiceover_ratio + music_ratio` is a partition of the audio track: it must sum
 * to 1.0. Every prompt in the engine says so ("must sum to ~1.0 (±0.1). Check the arithmetic
 * before you answer"), and the refine that enforces it has existed since Phase 6 — at
 * `types.ts:637`, on the LEGACY Gemini schema. Neither schema in the live path
 * (`qwen/schemas.ts`, `qwen/split/schemas.ts`) carried a cross-field check, so a violating mix
 * passed Zod in silence and went on to Apollo. Same shape as the wiring guard that scanned one
 * directory while a paid route ran free: the guard existed, just not where the code ran.
 *
 * ── WHY THE SUM CHECK ALONE IS NOT ENOUGH (measured, 2026-08-05) ────────────────────────────
 * Four back-to-back reads of one 28.6s clip that is 97.6% audible speech (ffmpeg silencedetect:
 * 0.69s of silence), same prompt, temperature 0, seeded:
 *
 *   run 1  unified  silence 0.05 · voice 0.90 · music 0.05   sum 1.00   ✓ right
 *   run 2  unified  silence 0.05 · voice 0.00 · music 0.95   sum 1.00   ✗ WRONG, and it SUMS
 *   run 3  unified  silence 0.05 · voice 0.00 · music 0.00   sum 0.05   ✗ wrong, caught by sum
 *   run 4  unified  silence 0.05 · voice 0.90 · music 0.05   sum 1.00   ✓ right
 *
 * Run 2 is the one that matters: it calls a pure-dialogue skit 95% music and 0% voice, and a sum
 * check waves it through. So the second half of this guard is a CONTRADICTION test — the same
 * response that reports 0% voice also carries a verbatim transcript and a non-null speech score.
 * That is checkable with certainty and needs no ground truth: the read disagrees with itself.
 *
 * (The AUDIO LEG of the modality split — omni's one job since #433 — returned
 * `silence 0.05 · voice 0.95 · music 0` on all four runs. The instability is the UNIFIED read,
 * i.e. the fallback. The guard goes on both, because the fallback is still a path that ships.)
 *
 * ── WHAT HAPPENS WHEN IT TRIPS ──────────────────────────────────────────────────────────────
 * Nothing here throws and nothing here invents a number. A trip is reported as DRIFT, which both
 * callers already know how to handle: one bounded retry of the cheap call. If the retry still
 * contradicts itself, `blankAudioMix` nulls the three ratios and every consumer drops the mix —
 * Apollo's prompt loses its "Mix:" line rather than gaining a false one, and the perceptual
 * formula redistributes the weight it was giving to a figure nobody actually measured.
 *
 * A wrong mix presented confidently is worse than no mix, because only one of the two can be
 * argued with downstream.
 */

/** ±0.1, the same tolerance the prompts ask for and the legacy refine enforces. */
export const AUDIO_MIX_TOLERANCE = 0.1;

/** Voice below this reads as "no speech at all" — the threshold the drift predicates already use. */
const NO_VOICE_CEILING = 0.05;

/** The three ratios, as they arrive from either path (nullable once this module has blanked them). */
export interface AudioMixRatios {
  silence_ratio: number | null;
  voiceover_ratio: number | null;
  music_ratio: number | null;
}

/**
 * Evidence, taken from the SAME response, that the track contains speech. Both are independent of
 * the mix itself — that is the whole point, otherwise the check would be circular.
 */
export interface SpeechEvidence {
  /** A 0-10 score the model only emits when it heard someone speak (null = it heard nobody). */
  first_words_speech_score: number | null | undefined;
  /** The verbatim words from the first ~3s. A non-empty string is a transcript of real speech. */
  spoken_words: string | null | undefined;
}

/** True when the response itself attests to speech, without consulting the ratios. */
export function hasSpeechEvidence(e: SpeechEvidence): boolean {
  return e.first_words_speech_score != null || !!e.spoken_words?.trim();
}

/**
 * Check the mix against itself. Returns a short reason when it is unusable, or null when it holds.
 *
 * An all-null mix is NOT a violation — that is this module's own "we could not measure it" state,
 * and re-flagging it would retry a read that already told the truth.
 */
export function audioMixViolation(
  ratios: AudioMixRatios,
  evidence: SpeechEvidence,
): string | null {
  const { silence_ratio: s, voiceover_ratio: v, music_ratio: m } = ratios;

  if (s === null && v === null && m === null) return null; // already blanked — honest, leave it
  if (s === null || v === null || m === null) return "audio mix is partially absent";

  const sum = s + v + m;
  if (Math.abs(sum - 1.0) > AUDIO_MIX_TOLERANCE) {
    return `audio ratios sum to ${sum.toFixed(2)}, not ~1.0`;
  }

  // The contradiction test — run 2 above. The read says nobody spoke while quoting what they said.
  if (v <= NO_VOICE_CEILING && hasSpeechEvidence(evidence)) {
    return `voiceover_ratio is ${v} on a read that reports speech`;
  }

  return null;
}

/**
 * Drop the mix. Called only after the bounded retry has ALSO come back contradictory — never as a
 * first response, and never to paper over a single bad read that a retry could fix.
 *
 * `audio_description`, `voice_clarity_0_10` and the hook scores are deliberately untouched: they
 * are separate observations, and the model being wrong about the proportions is not evidence that
 * it misheard the content.
 */
export function blankAudioMix<T extends AudioMixRatios>(ratios: T): T {
  return { ...ratios, silence_ratio: null, voiceover_ratio: null, music_ratio: null };
}
