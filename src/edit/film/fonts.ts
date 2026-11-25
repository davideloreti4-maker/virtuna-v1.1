/**
 * fonts.ts — the kit's typefaces: files of our own, loaded before a frame is drawn, so the preview
 * and the posted file set the same letters.
 *
 * Each is the upright variable font from Google's open fonts, unchanged, with its licence beside
 * it in `public/edit/fonts/`. Their family names here are ours, so a font of the same name on a
 * viewer's machine is never used in its place.
 *
 * Their letters are set in English, whatever the language of the page the film is on (`lang` on
 * the film's root): a typeface's forms for another language (TikTok Sans' German "ß" between
 * capitals, 2026-11-21) are never used. The server's width tables (`scripts/edit-font-widths.ts`)
 * assume the same.
 */
import { loadFont } from "@remotion/fonts";
import { measureText } from "@remotion/layout-utils";
import { useEffect, useState } from "react";
import { useDelayRender } from "remotion";
import type { Captions } from "../../lib/edit";
import type { Measure } from "./layout";

export type FontId = Captions["font"];

/** Each typeface: the family name parts set, its file under the kit's folder, and the weights the file holds. */
export const FONT_FILES: Record<FontId, { family: string; file: string; weight: string }> = {
  inter: { family: "Edit Inter", file: "fonts/inter/Inter.ttf", weight: "100 900" },
  montserrat: { family: "Edit Montserrat", file: "fonts/montserrat/Montserrat.ttf", weight: "100 900" },
  tiktok: { family: "Edit TikTok Sans", file: "fonts/tiktoksans/TikTokSans.ttf", weight: "300 900" },
};

/** The optical size every size is drawn at (X94): the top of TikTok Sans' axis; Inter, whose axis ends at 32, takes 32. */
export const OPSZ = 36;

/**
 * How the kit's letters are set, measured and drawn alike (X94): each character as itself, and
 * every size in the design of large type. `MEASURED_AS` measures with these and the film draws
 * with them (`OWN` in Film.tsx).
 *
 * - No ligatures and no contextual alternates. The typefaces swap some runs of letters for other
 *   glyphs of other widths: Montserrat's "fi" (liga), Inter's arrows for "->" and "=>" and its ×
 *   for the x in "3x4" (calt). Chrome and Safari do not swap the same runs (Inter's "a -> b" came
 *   out 18 px apart, 2026-11-21), and the server, which measures from a table of single
 *   characters (`src/lib/edit/measure.ts`), cannot know them. So none is made.
 * - The optical size held at its top. Inter and TikTok Sans draw small type in a looser design,
 *   chosen from the type size; Montserrat has no such axis. Held at the top (Inter's 32, TikTok
 *   Sans' 36; a value over an axis' top is taken as its top), every size is drawn as large type
 *   always was (Inter's from 32 px, TikTok Sans' from 36), and a width is the same share of the
 *   size at every size.
 */
export const SET_AS = {
  fontVariantLigatures: "none",
  fontFeatureSettings: '"liga" 0, "clig" 0, "calt" 0',
  fontVariationSettings: `"opsz" ${OPSZ}`,
} as const;

/**
 * What a measurement is given besides the typeface, weight and size. Text is measured in a node
 * on the page itself, outside the film, where it would take whatever the page hands down; these
 * are the plain values of everything handed down that changes a width, which is what the film
 * draws with (`OWN` in Film.tsx, `SET_AS` above). So text is measured the same on any page.
 *
 * With one difference, on purpose: a measurement leaves kerning out. Chrome kerns a hyphen with
 * the letter after it and Safari does not, so the same words came out 0.2 % apart and a call-out
 * was set a pixel smaller in one browser than in the other (2026-11-19). Without kerning both
 * give the same width to a hundredth of a pixel, so the size and the line breaks the kit decides
 * from it are the same everywhere. What is drawn is kerned as the typeface asks, and centred in
 * the box its unkerned width gave it, which is a hair wider.
 *
 * Kerning is left out twice, as `font-kerning` and as `"kern" 0`. With the first alone, Safari
 * keeps the width it measured a word at, unkerned, and once a page has measured enough it lays
 * the same word out drawn, kerned, at that width (Montserrat's "3x4" at 192.20 px instead of
 * 186.58, 2026-11-21). Text set as the kit sets it is otherwise the same to it, so the feature
 * settings, which it keeps apart, keep the two apart.
 */
export const MEASURED_AS: Record<string, string> = {
  fontStyle: "normal",
  fontStretch: "100%",
  fontKerning: "none",
  ...SET_AS,
  fontFeatureSettings: `${SET_AS.fontFeatureSettings}, "kern" 0`,
  fontVariantCaps: "normal",
  fontOpticalSizing: "auto",
  letterSpacing: "normal",
  wordSpacing: "0px",
  textTransform: "none",
  textRendering: "auto",
};

/** The family name a part sets for one of the kit's typefaces. */
export function fontFamily(font: FontId): string {
  return FONT_FILES[font].family;
}

/**
 * The browser's measure of one of the kit's typefaces, for the boxes in `layout.ts`: `measureText`
 * with `MEASURED_AS`, letter-spacing in ems when there is any. In the browser only, once the
 * typeface is loaded; the server measures with its tables (`src/lib/edit/measure.ts`).
 */
export function measuredIn(font: FontId): Measure {
  const family = fontFamily(font);
  return (text, weight, size, trackingEm) =>
    measureText({ text, fontFamily: family, fontWeight: weight, fontSize: size, ...(trackingEm === undefined ? {} : { letterSpacing: `${trackingEm}em` }), validateFontIsLoaded: true, additionalStyles: MEASURED_AS }).width;
}

/**
 * Loads the typefaces an edit uses from the kit's folder and holds the render until they are in.
 * Gives back whether they are in: text is measured to be fitted, so nothing that sets text is
 * drawn before. A typeface that cannot be loaded fails the render: a film is never drawn in a
 * stand-in font.
 */
export function useFonts(kit: string, fonts: readonly FontId[]): boolean {
  const { delayRender, continueRender, cancelRender } = useDelayRender();
  const wanted = [...fonts].sort().join(",");
  const [handle] = useState(() => delayRender("Loading the edit's typefaces"));
  const [loaded, setLoaded] = useState<string | null>(null);
  useEffect(() => {
    const ids = wanted === "" ? [] : (wanted.split(",") as FontId[]);
    Promise.all(ids.map((id) => loadFont({ family: FONT_FILES[id].family, url: `${kit}/${FONT_FILES[id].file}`, weight: FONT_FILES[id].weight })))
      .then(() => {
        setLoaded(`${kit}|${wanted}`);
        continueRender(handle);
      })
      .catch((error: unknown) => cancelRender(error));
  }, [kit, wanted, handle, continueRender, cancelRender]);
  return loaded === `${kit}|${wanted}`;
}
