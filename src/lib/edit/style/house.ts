/**
 * house.ts — the house style (part 3, Task 10b, F; the native default, 2026-11-24, Task 8): what a first cut looks like when
 * no style is asked for. `DEFAULT_STYLE` (profile.ts) stays the kit's own settings as they stand; this is what a first cut
 * applies without a style. Read from references 3 and 4 (short videos captioned as the apps' own text is) and the rulings of
 * 2026-11-24; the two sizes ruled by the controller from Task 8's sheet of three candidates (52/68, 58/76, 64/84).
 *
 * - captions: `plain`, `tiktok`, weight 600, 64 px, at 0.72, five words a page, no highlight colour: plain white sentence
 *   captions in the typeface's own spacing, a stressed word at the same weight (Task 3); 64 px sits between references 4's
 *   and 3's captions and was the most readable of the three on the owner's close-up; the fit (`placeCaptions`) loses words
 *   before size where they must move off the face;
 * - title: a `label`, dark letters (`#111111`, the light box) at 600, 72 px, at 0.20, staying to the film's end (`frames` is
 *   then unused): the hook reads as a label over the whole video; 72 px is between the two references' labels and the
 *   largest size at which a hook of 44 characters still sets on two lines; no marked word in colour;
 * - punch-ins: 4 a minute at 1.10: light, a cut that moves without a jump;
 * - look: natural, not the model's choice (X129); the pace stays the model's (X87), and the value here stands for it
 *   until it has, as `DEFAULT_STYLE`'s does.
 */
import { DEFAULT_STYLE, type StyleProfile } from "./profile";

export const HOUSE_STYLE: StyleProfile = Object.freeze({
  source: { kind: "default", name: null },
  pace: DEFAULT_STYLE.pace,
  captions: { on: true, look: "plain", font: "tiktok", size: 64, y: 0.72, maxWords: 5, highlight: null, weight: 600 },
  title: { on: true, y: 0.2, frames: 75, look: "label", size: 72, stays: true, ink: "#111111", weight: 600 },
  punchIns: { perMin: 4, zoom: 1.1 },
  look: { preset: "natural" },
  notMatched: [],
});
