/**
 * presets.ts — the presets (part 3, Task 12; the controller's addendum, X105; Task 12b's `sentences`): seven ready-made styles,
 * designed and judged by eye on the owner's take, each named by its look and never after a person (X99). Their numbers are in
 * `presets.json` (numbers and the words of the look only: no video, link or creator); here each becomes a `StyleProfile`, checked
 * when the module loads. `PRESET_IDS` is the order the page shows them in.
 *
 * Every preset has `source: { kind: "preset", name }`, `pace.cutsPerMin: null` (a preset says nothing of its cuts beyond its
 * punch-ins), no `pace.quiet` (so the first cut keeps its pause as it is) and nothing unmatched. `bold-pop` holds, as its own
 * numbers, what the house style was until 2026-11-24 (the native default, X127), so no preset changes when the house does; it is
 * offered last.
 */
import { z } from "zod";
import { StyleProfileSchema, type StyleProfile } from "./profile";
import data from "./presets.json";

export interface Preset {
  id: PresetId;
  /** Named by its look, never after a person (X99). */
  name: string;
  /** One line of what it looks like, for the creator. */
  description: string;
  profile: StyleProfile;
}

/** The presets' ids, in the order they are offered. `presets.json` holds exactly these. */
export const PRESET_IDS = ["sentences", "clean", "one-word", "highlighter", "key-words", "mono", "bold-pop"] as const;
export type PresetId = (typeof PRESET_IDS)[number];

const Head = { id: z.enum(PRESET_IDS), name: z.string().min(1).max(40), description: z.string().min(1).max(120), pauseMs: StyleProfileSchema.shape.pace.shape.pauseMs };
const { captions, title, punchIns } = StyleProfileSchema.shape;
/** An entry of `presets.json`: its own pace, captions, title, punch-ins and look. */
const EntrySchema = z.strictObject({ ...Head, captions, title, punchIns, look: StyleProfileSchema.shape.look.shape.preset });
const FileSchema = z.strictObject({ presets: z.array(EntrySchema) });

/** Frozen all the way down: a preset is shared by every caller. */
function frozen<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const each of Object.values(value)) frozen(each);
    Object.freeze(value);
  }
  return value;
}

function presetFrom(entry: z.infer<typeof EntrySchema>): Preset {
  const profile = StyleProfileSchema.parse({
    source: { kind: "preset", name: entry.name },
    pace: { pauseMs: entry.pauseMs, cutsPerMin: null },
    captions: entry.captions,
    title: entry.title,
    punchIns: entry.punchIns,
    look: { preset: entry.look },
    notMatched: [],
  });
  return { id: entry.id, name: entry.name, description: entry.description, profile };
}

function load(): readonly Preset[] {
  const presets = FileSchema.parse(data).presets.map(presetFrom);
  const ids = presets.map((preset) => preset.id);
  if (ids.join() !== PRESET_IDS.join()) throw new Error(`presets.json holds ${ids.join(", ")}; PRESET_IDS are ${PRESET_IDS.join(", ")}`);
  return frozen(presets);
}

export const PRESETS: readonly Preset[] = load();

/** The preset of this id; undefined for none. */
export function presetOf(id: string): Preset | undefined {
  return PRESETS.find((preset) => preset.id === id);
}
