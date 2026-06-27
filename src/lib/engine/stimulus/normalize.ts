/**
 * `normalizeStimulus` (IN-01/02/03 + D-06) — the General-path adapter door.
 *
 * Additive General-path sibling of the Socials `normalizeInput` (../normalize.ts:42):
 * it takes ANY raw per-kind input (text / `.txt`/`.md` file / screenshot image /
 * person-video reference) and emits ONE flat, Zod-validated `Stimulus`, the same way
 * `normalizeInput` flattens the Socials input into its payload. It is a SEPARATE
 * function — it never imports or mutates the Socials `../normalize` or `../types`
 * schemas, so the creator (Socials) path stays byte-untouched (D-02). Converges with
 * Socials only at P7, if ever.
 *
 * WHAT IT CARRIES:
 *   - The resolved SIM-1 tier (D-03): `tier` is ALWAYS `resolveSim1Tier(kind)`, never
 *     a user choice — P5's engine badge reads it directly.
 *   - The profiler subject/goal tag (D-06): for a person-video the reference is only
 *     TAGGED (subject.isProfiledSubject + goal). No omni run happens in P4 — the omni
 *     read is deferred to P5's `simulate()`, so `content` stays empty for video.
 *
 * HARD RULES:
 *   - `source.filename` is DISPLAY-ONLY and NEVER a path (Pitfall 3 / T-04-04-03).
 *     The only safe path is `source.storagePath` (video, the existing video_upload
 *     storage key — never a user filename).
 *   - Output is validated with `StimulusSchema.parse` at the boundary before return
 *     (V5 / T-04-04-01) — a malformed normalized object never reaches P5.
 *   - Zero new packages (D-05).
 */

import { resolveSim1Tier } from "./tier";
import { readTextFile } from "./ingest";
import { readImageWithVision } from "./vision";
import { StimulusSchema } from "./types";
import type { Stimulus, StimulusInput } from "./types";

/**
 * Normalize raw per-kind input into a single tier-carrying, Zod-validated `Stimulus`.
 *
 * Exhaustive over the `StimulusInput` discriminated union:
 *   - `text`       → raw content, `source.origin:"text"`, `tier:"flash"`.
 *   - `file_text`  → `content = await readTextFile(file)`, `source.origin:"file"`,
 *                    `source.filename` (display only), `tier:"flash"`.
 *   - `image`      → `content = await readImageWithVision(file)`,
 *                    `source.origin:"image"`, `tier:"flash"`.
 *   - `video`      → `content:""` (omni deferred to P5 — D-06), `source.origin:"video"`,
 *                    `source.storagePath` set, `tier:"max"`, plus the profiler subject
 *                    tag (`isProfiledSubject` + `goal`) when the subject is profiled.
 *
 * @throws via the leaf readers (bad MIME / extension / oversize) or `StimulusSchema`
 *         if the assembled object is malformed.
 */
export async function normalizeStimulus(
  input: StimulusInput,
): Promise<Stimulus> {
  let stimulus: Stimulus;

  switch (input.kind) {
    case "text": {
      stimulus = {
        kind: "text",
        content: input.text,
        source: { origin: "text" },
        tier: resolveSim1Tier("text"),
      };
      break;
    }

    case "file_text": {
      stimulus = {
        kind: "file_text",
        content: await readTextFile(input.file),
        source: {
          origin: "file",
          // filename is DISPLAY-ONLY provenance — never a path (Pitfall 3).
          filename: input.file.name,
          mime: input.file.type || undefined,
        },
        tier: resolveSim1Tier("file_text"),
      };
      break;
    }

    case "image": {
      stimulus = {
        kind: "image",
        content: await readImageWithVision(input.file),
        source: {
          origin: "image",
          // display-only provenance (Pitfall 3).
          filename: input.file.name,
          mime: input.file.type || undefined,
        },
        tier: resolveSim1Tier("image"),
      };
      break;
    }

    case "video": {
      stimulus = {
        kind: "video",
        // D-06: P4 only TAGS the reference — the omni read runs in P5, so content
        // stays empty here. No omni call, no new video infra.
        content: "",
        source: {
          origin: "video",
          // storagePath is the ONLY safe path (existing video_upload storage key).
          storagePath: input.storagePath,
          // filename is DISPLAY-ONLY (Pitfall 3) — never used as a path.
          filename: input.filename,
        },
        tier: resolveSim1Tier("video"),
        ...(input.isProfiledSubject
          ? { subject: { isProfiledSubject: true as const, goal: input.goal } }
          : {}),
      };
      break;
    }

    default: {
      // Exhaustiveness guard over the discriminated union.
      const _exhaustive: never = input;
      throw new Error(
        `Unsupported stimulus kind: ${JSON.stringify(_exhaustive)}`,
      );
    }
  }

  // Boundary validation (V5 / T-04-04-01): a malformed object never reaches P5.
  return StimulusSchema.parse(stimulus);
}
