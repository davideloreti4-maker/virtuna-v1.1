/**
 * Stimulus — the General input-adapter's normalized output contract (Phase 4).
 *
 * `Stimulus` is the flat, normalized object every General-path skill consumes:
 * raw per-kind input (text / file / image / person-video) → one shape, the way
 * `ContentPayload` is the normalized object the Socials pipeline consumes.
 *
 * DESIGN NOTES (locked by 04-RESEARCH / 04-PATTERNS):
 *   - ADDITIVE (D-02): `Stimulus` sits ALONGSIDE the Socials `AnalysisInput` /
 *     `ContentPayload` (types.ts:154-216). It NEVER replaces them; the creator
 *     (Socials) path is byte-untouched. URL ingestion stays the Socials path —
 *     `tiktok_url` is deliberately omitted from `StimulusKind` (unifies in P7 if
 *     ever).
 *   - PROFILER-READY (D-06): `subject` is set ONLY when the stimulus is a person
 *     being profiled (the Profile verb consumes `subject.goal` in P5). For a
 *     person-video, P4 only TAGS the reference — it does NOT run omni (the omni
 *     read runs when P5 actually simulates).
 *   - CARRIES THE RESOLVED TIER (D-03): `tier` is the resolved SIM-1 tier
 *     (`resolveSim1Tier(kind)`), carried so P5's engine badge reads it directly.
 *   - `source.filename` is DISPLAY-ONLY and NEVER used as a path (Pitfall 3 /
 *     T-04-01-01). The only safe path is `source.storagePath` (video persistence,
 *     reuses the existing video_upload storage key).
 *
 * Idiom mirrors types.ts: Zod-schema-at-boundary (`StimulusSchema`) + exported
 * TS interface (`Stimulus`). The schema is the boundary validator consumed by the
 * Wave 1–2 ingest / vision / normalize implementations.
 */

import { z } from "zod";

/**
 * The General-path stimulus kinds. `tiktok_url` is intentionally absent — URL
 * ingestion is the Socials path (D-02). Person-video = `"video"` (tier = Max).
 */
export type StimulusKind = "text" | "file_text" | "image" | "video";

/**
 * The resolved SIM-1 tier (D-03). `flash` → `QWEN_REASONING_MODEL` (qwen3.7-plus,
 * deaf, vision-capable); `max` → `QWEN_OMNI_MODEL` (qwen3.5-omni-flash, audio).
 * NOTE: omni-**flash** the model name ≠ SIM-1-**Flash** the tier (see tier.ts).
 */
export type Sim1Tier = "flash" | "max";

/**
 * Provenance for a `Stimulus`, untrusted-origin tagged.
 *   - `filename` — display ONLY, NEVER a path (Pitfall 3).
 *   - `storagePath` — the ONLY safe path interpolation; set ONLY for video
 *     (reuses the existing video_upload Supabase Storage key).
 */
export interface StimulusSource {
  origin: "text" | "file" | "image" | "video";
  filename?: string;
  mime?: string;
  storagePath?: string;
}

/**
 * Profiler tag (D-06) — present ONLY when the stimulus is a person being
 * profiled. `goal` is the user's goal scope, consumed by the Profile verb (P5).
 */
export interface StimulusSubject {
  isProfiledSubject: true;
  goal?: string;
}

/**
 * The normalized General-path stimulus. `content` is the normalized text
 * (raw text | file text | image vision-read | video transcript-later). For a
 * person-video, `content` may be empty in P4 (the omni read runs in P5).
 */
export interface Stimulus {
  kind: StimulusKind;
  content: string;
  source: StimulusSource;
  tier: Sim1Tier;
  subject?: StimulusSubject;
}

/**
 * Discriminated input union for `normalizeStimulus(...)` (Wave 1). Each member is
 * the raw, per-kind input the adapter accepts before normalization:
 *   - text       → in-memory string
 *   - file_text  → a `.txt` / `.md` `File` (read with `file.text()`, D-05)
 *   - image      → a screenshot `File` (base64 → vision read, IN-03)
 *   - video      → a person-video reference (storage key + profiler tag, D-06;
 *                  no omni run in P4)
 */
export type StimulusInput =
  | { kind: "text"; text: string }
  | { kind: "file_text"; file: File }
  | { kind: "image"; file: File }
  | {
      kind: "video";
      storagePath: string;
      filename?: string;
      goal?: string;
      isProfiledSubject?: boolean;
    };

/**
 * Boundary validator for the `Stimulus` contract — mirrors the
 * `AnalysisInputSchema` Zod style (types.ts:154). Consumed by the Wave 1–2
 * ingest / vision / normalize implementations to validate the normalized output
 * at the trust boundary.
 */
export const StimulusSchema = z.object({
  kind: z.enum(["text", "file_text", "image", "video"]),
  content: z.string(),
  source: z.object({
    origin: z.enum(["text", "file", "image", "video"]),
    filename: z.string().optional(),
    mime: z.string().optional(),
    storagePath: z.string().optional(),
  }),
  tier: z.enum(["flash", "max"]),
  subject: z
    .object({
      isProfiledSubject: z.literal(true),
      goal: z.string().optional(),
    })
    .optional(),
});
