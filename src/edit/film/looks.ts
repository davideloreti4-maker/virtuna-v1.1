/**
 * looks.ts — the kit's colour looks: what each preset is, and how a look becomes the numbers one
 * colour pass takes.
 *
 * A look is a preset and adjustments on top, all on one scale from -1 to 1 where 0 changes
 * nothing. The numbers here are the kit's own; nothing outside this file knows the engine's.
 */
import { NEUTRAL, type Adjust, type Look } from "../../lib/edit";

/**
 * What each preset is, on the same scale as the adjustments. Set by looking at renders of a real
 * take, 2026-11-19. None leans on vibrance: the colour pass's vibrance adds colour to what is
 * nearly grey, which turned a grey wall orange and brought out blotches in a dark laptop.
 */
export const LOOKS: Record<Look["preset"], Adjust> = {
  natural: NEUTRAL,
  vivid: { ...NEUTRAL, contrast: 0.2, saturation: 0.3 },
  warm: { ...NEUTRAL, warmth: 0.25, tint: 0.05, highlights: -0.1, contrast: 0.1, saturation: 0.05 },
  cool: { ...NEUTRAL, warmth: -0.25, contrast: 0.1, saturation: -0.05 },
  mono: { ...NEUTRAL, saturation: -1, contrast: 0.2 },
  soft: { ...NEUTRAL, shadows: 0.15, highlights: -0.15, contrast: -0.15, saturation: -0.1 },
};

/** The numbers one colour pass takes: exposure in stops, contrast and saturation as multipliers, the rest from -1 to 1. */
export interface Grade {
  exposure: number;
  temperature: number;
  tint: number;
  shadows: number;
  highlights: number;
  contrast: number;
  saturation: number;
  vibrance: number;
}

/** How much of the colour pass's vibrance the whole way up is. Up, that vibrance adds colour, most to what has least; down, it only takes away, so down is given in full. */
const VIBRANCE_UP = 0.12;

/** A look as one colour pass, or null when it changes nothing, so no pass is run at all. */
export function gradeOf(look: Look): Grade | null {
  const preset = LOOKS[look.preset];
  const at = (key: keyof Adjust) => Math.min(1, Math.max(-1, preset[key] + look.adjust[key]));
  if ((Object.keys(NEUTRAL) as (keyof Adjust)[]).every((key) => at(key) === 0)) return null;
  return {
    exposure: at("exposure") * 1.5,
    temperature: at("warmth") * 0.6,
    tint: at("tint") * 0.6,
    shadows: at("shadows"),
    highlights: at("highlights"),
    contrast: 1 + at("contrast") * 0.5,
    saturation: 1 + at("saturation"),
    vibrance: at("vibrance") * (at("vibrance") > 0 ? VIBRANCE_UP : 1),
  };
}

/** How bright the eye takes red, green and blue to be, in light itself and in stored values: the colour pass's own two sets. */
const BRIGHT_LIGHT = [0.2126, 0.7152, 0.0722] as const;
const BRIGHT_STORED = [0.213, 0.715, 0.072] as const;

/**
 * The nearest two plain colour matrices come to a grade, for a browser that cannot run the colour
 * pass. `light` works on light itself, `encoded` on the stored values after it; each is four rows
 * of five, as a filter takes them. Exposure, warmth, tint, contrast and saturation are the colour
 * pass's own sums. Vibrance is stood in with some saturation; shadows and highlights are left out.
 * Only a preview may use this: what is posted always runs the colour pass itself.
 */
export function standInOf(grade: Grade): { light: number[]; encoded: number[] } {
  const raw = [0.3 * grade.temperature + 0.15 * grade.tint, -0.3 * grade.tint, -0.3 * grade.temperature + 0.15 * grade.tint].map((stops) => 2 ** stops);
  const brightness = raw.reduce((sum, value, i) => sum + value * (BRIGHT_LIGHT[i] ?? 0), 0);
  const [red = 1, green = 1, blue = 1] = raw.map((value) => (value * 2 ** grade.exposure) / brightness);
  const contrast = grade.contrast;
  const colour = grade.saturation * (grade.vibrance >= 0 ? 1 + 2 * grade.vibrance : 1 + grade.vibrance); // twice: nearest on real footage, which is mostly dull colours
  // Contrast about the middle grey, then colour about each pixel's own brightness, as one matrix.
  const row = (channel: number) => [...BRIGHT_STORED.map((weight, i) => contrast * (weight * (1 - colour) + (i === channel ? colour : 0))), 0, (1 - contrast) / 2];
  return {
    light: [red, 0, 0, 0, 0, 0, green, 0, 0, 0, 0, 0, blue, 0, 0, 0, 0, 0, 1, 0],
    encoded: [...row(0), ...row(1), ...row(2), 0, 0, 0, 1, 0],
  };
}
