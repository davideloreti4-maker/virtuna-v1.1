/**
 * parts.ts — the kit's parts as an edit sees them: a name, where a part may sit, whether it runs
 * on over a cut, what file it plays, and the shape of its settings.
 *
 * No drawing code lives here. The kit's components read these same schemas, so what an edit may
 * hold and what the kit can draw are one list. Positions are fractions of the stage, 0 to 1.
 * Sizes are pixels on the 1080-wide stage; the smallest allowed are what stays readable on a phone
 * (a title 48, as small as two of five references set their hooks (Task K1); other words 44).
 */
import { z } from "zod";
import { Hex, Ms, Unit, Weight, text } from "./atoms";

const Volume = z.number().min(0).max(2);

/** The kit's typefaces, each a file of our own under a licence that allows a creator's post. */
export const FONTS = ["inter", "montserrat", "tiktok"] as const;
const Font = z.enum(FONTS);

export interface PartSpec {
  /** Where it may sit: on a shot, at a moment of the shot's own file, or on the film. */
  where: readonly ("shot" | "film")[];
  /**
   * On a shot: true when it runs on over the cuts that follow, as a sound rings out and a cutaway
   * hides a cut; false when it belongs to its shot's picture and ends when that footage does.
   */
  spills: boolean;
  /**
   * The kinds of file it plays; null when it plays none. A part that plays a file says in its
   * settings where in the file it starts, as `startMs`.
   */
  plays: readonly ("video" | "image" | "audio")[] | null;
  /** The shape of its settings. Strict: an unknown setting is refused. */
  props: z.ZodType;
}

export const PARTS = {
  /** The hook: a line or two over the picture. */
  title: {
    where: ["film", "shot"],
    spills: true,
    plays: null,
    props: z.strictObject({
      text: text(80),
      font: Font,
      look: z.enum(["bold", "label", "outline"]),
      y: Unit,
      size: z.number().min(48).max(220),
      color: Hex,
      /** The colour of words wrapped in asterisks, like *this*; null for none. */
      accent: Hex.nullable(),
      weight: Weight.optional(), // left out: 700 for a label, else 800
    }),
  },
  /** One or two words that land on a moment of the picture. */
  callout: {
    where: ["shot", "film"],
    spills: false,
    plays: null,
    props: z.strictObject({
      text: text(40),
      font: Font,
      look: z.enum(["pop", "label"]),
      x: Unit,
      y: Unit,
      size: z.number().min(44).max(200),
      color: Hex,
      weight: Weight.optional(), // left out: 800
    }),
  },
  /** A thin bar that fills as the film plays. */
  progress: {
    where: ["film"],
    spills: false,
    plays: null,
    props: z.strictObject({ edge: z.enum(["top", "bottom"]), color: Hex }),
  },
  /** A clip or a picture over the speaker while the voice goes on. */
  cutaway: {
    where: ["shot", "film"],
    spills: true,
    plays: ["video", "image"],
    props: z.strictObject({
      fit: z.enum(["cover", "contain"]),
      /** Where in its own file it starts; 0 for a picture. */
      startMs: Ms,
      volume: Volume,
    }),
  },
  /** A sound: an effect on a moment, or a voice over the film. */
  sound: {
    where: ["shot", "film"],
    spills: true,
    plays: ["audio"],
    props: z.strictObject({
      /** Where in its own file it starts. */
      startMs: Ms,
      volume: Volume,
      fadeInMs: z.number().int().min(0).max(5000),
      fadeOutMs: z.number().int().min(0).max(5000),
    }),
  },
} as const satisfies Record<string, PartSpec>;

export type PartId = keyof typeof PARTS;
export const PART_IDS = Object.keys(PARTS) as [PartId, ...PartId[]];

/** The part of that name, or undefined. A name every object already has finds nothing. */
export function partOf(name: string): PartSpec | undefined {
  return Object.hasOwn(PARTS, name) ? PARTS[name as PartId] : undefined;
}
