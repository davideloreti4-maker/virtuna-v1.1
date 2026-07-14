/**
 * CalibratedPersonaSchema — the persona shape the ENGINE can actually consume.
 *
 * WHY THIS IS ITS OWN MODULE: it is a pure data contract, shared by the two write routes AND
 * the repo gate. Living inside `audience-repo.ts` (the DB-I/O module) meant every test that
 * `vi.mock`ed the repo also blanked the schema — a validation contract must not be collateral
 * damage of mocking persistence.
 *
 * WHY IT EXISTS: `archetype` is the engine's BINDING KEY, not a label. `buildAudienceRepaint`
 * projects personas into a `Record<archetype, repaint>` map, and the Flash prompt builders look
 * that map up by the archetype of each of the 10 engine slots. An archetype outside `ARCHETYPES`
 * therefore matches NO slot in ANY niche: its repaint reaches the model never, and — before this
 * schema — silently. `CalibratedPersona.archetype` was already typed `Archetype`, but every write
 * path validated `z.unknown()` (the IN-02 deferral), so the type was a claim the boundary never
 * enforced. One hand-written row ("Fitness Creators") stored `fitness` + `learner` and lost 45%
 * of its own declared share to the gap while every test stayed green.
 *
 * The vocabulary is deliberately the SAME one the synthesis LLM is already held to (`SynthSchema`
 * in enrich-signature.ts): the scrape path could never emit a bad slug — only the hand/API write
 * paths could, and now they cannot either.
 */

import { z } from "zod";
import { ARCHETYPES } from "@/lib/engine/wave3/persona-registry";

export const CalibratedPersonaSchema = z.object({
  /** The engine binding key. Outside this enum = the repaint is dead weight (see above). */
  archetype: z.enum(ARCHETYPES),
  repaint: z.string().max(2000),
  temperature: z.enum(["cold", "warm", "hot"]),
  disposition: z.enum([
    "scanner",
    "skeptic",
    "collector",
    "connector",
    "converter",
    "lurker",
  ]),
  share: z.number().min(0).max(1),
  /** Presentation-only (AUD-EDIT-01) — the engine never reads it. Absent on legacy personas. */
  label: z.string().max(120).optional(),
});

/** Array form used at every write boundary. `.max(50)` is the storage-DoS cap (WR-02). */
export const CalibratedPersonasSchema = z.array(CalibratedPersonaSchema).max(50);
