import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// ─────────────────────────────────────────────────────────────────────────────
// Earn's parts (plan 2026-11-24-earn, steps A and B) follow You's and the posted parts' rules (same method
// as you-next-guard.test.ts):
//   1. Tokens only: no colour literal and no palette colour, except in `save-card.ts`, which holds the
//      share card's own colours (the card is dark in both themes; the canvas needs literal colours).
//   2. No glass: Earn is a page.
//   3. The parts send nothing (no `fetch`, no `/api/` address, no query or mutation hook, nothing from
//      `@/hooks/queries`); the container alone reaches the server, and only through
//      `@/hooks/queries/use-earn`. `get-paid.tsx` enrols through the container's `onEnrol`.
//   4. No type size outside the role scale.
//   5. The QR is drawn as squares: no markup string, no `dangerouslySetInnerHTML`, no `renderSVG`.
//   6. Money is shown only through the words (relaxed on purpose for step B, ruling 22: the earned number
//      and the card "Get paid" name money): no part writes an amount by hand (`$` and a digit) or turns
//      cents into dollars itself (`/ 100`, `toFixed(`, a `NumberFormat`); `moneyWord` / `earnedLine` in
//      `src/lib/earn/earn-words.ts` do.
// PURE FS test (default `node` env).
// ─────────────────────────────────────────────────────────────────────────────

const DIR = join(__dirname, "..");
const FILES = readdirSync(DIR, { withFileTypes: true }).filter((e) => e.isFile() && /\.tsx?$/.test(e.name)).map((e) => e.name);
const CONTAINER = "earn-next.tsx";
const COLOURS = "save-card.ts";
const PARTS = FILES.filter((file) => file !== CONTAINER);

/** Source with comments removed, so prose like "#559" or "rgba" in a comment cannot trip it. */
function code(file: string): string {
  return readFileSync(join(DIR, file), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}
const queryModulesOf = (src: string) =>
  [...src.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)['"`](@\/hooks\/queries(?:\/[^'"`]*)?)['"`]/g)].map((m) => m[1]!);

const PALETTE = [
  "white", "black", "slate", "gray", "zinc", "neutral", "stone", "mauve", "olive", "mist", "taupe",
  "red", "orange", "amber", "yellow", "lime", "green", "emerald", "teal", "cyan", "sky", "blue",
  "indigo", "violet", "purple", "fuchsia", "pink", "rose",
].join("|");
const COLOUR_UTILITY =
  "text|bg|from|via|to|border(?:-[xytrblse])?|ring(?:-offset)?|inset-ring|outline|divide|fill|stroke|" +
  "shadow|inset-shadow|drop-shadow|decoration|caret|accent|placeholder";
const PALETTE_CLASS = new RegExp(`\\b(?:${COLOUR_UTILITY})-(?:(?:${PALETTE})\\b|\\[(?:color:)?(?:${PALETTE})\\])`, "g");
const GLASS = /\bbackdrop-|\[backdrop|backdrop-?filter/i;
const SENDS = /\bfetch\s*\(|['"`]\/api\/|\buse(?:Query|Mutation|InfiniteQuery)\b|@\/hooks\/queries/;
const ARBITRARY_SIZE = /\btext-\[\d+(\.\d+)?(px|rem|em)\]/g;
const MARKUP_STRING = /dangerouslySetInnerHTML|\brenderSVG\b|\binnerHTML\b/;
const MONEY = /\$\d|\/\s*100\b|\btoFixed\s*\(|\bNumberFormat\b/;

describe("the guard itself", () => {
  it.each(["text-white", "bg-black", "md:bg-zinc-900", "ring-white/30"])("refuses the palette colour %s", (sample) => {
    expect(`className="h-6 ${sample}"`.match(PALETTE_CLASS)).not.toBeNull();
  });
  it.each(["text-foreground-secondary", "bg-surface-sunken", "text-action-foreground"])("lets the token %s through", (sample) => {
    expect(`className="${sample}"`.match(PALETTE_CLASS)).toBeNull();
  });
  it.each(['await fetch("/api/earn")', 'import { useEarn } from "@/hooks/queries/use-earn"'])("refuses the request %s in a part", (sample) => {
    expect(SENDS.test(sample)).toBe(true);
  });
  it.each(["$58.80", "`$${(cents / 100).toFixed(2)}`", "cents/100", "new Intl.NumberFormat(\"en-US\", { style: \"currency\" })"])("refuses the hand-made money %s", (sample) => {
    expect(MONEY.test(sample)).toBe(true);
  });
  it.each(["earnedLine(whop.earnedCents)", "whop?.earnedCents != null", "moneyWord(cents)"])("lets the money through the words: %s", (sample) => {
    expect(MONEY.test(sample)).toBe(false);
  });
});

describe("earn-next", () => {
  it("finds the parts (guards against a walker that matches nothing)", () => {
    for (const file of ["earn-next.tsx", "earn-screen.tsx", "get-paid.tsx", "share-card.tsx", "qr.tsx", "save-card.ts"]) expect(FILES).toContain(file);
  });

  it.each(FILES.filter((file) => file !== COLOURS))("%s carries no colour literal and no palette colour", (file) => {
    const src = code(file);
    expect(src.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).toEqual([]);
    expect(src.match(/\b(?:rgba?|hsla?|oklch)\(/g) ?? []).toEqual([]);
    expect(src.match(PALETTE_CLASS) ?? []).toEqual([]);
  });

  it(`${COLOURS} holds its colours in SHARE_LOOK only`, () => {
    const src = code(COLOURS);
    const look = /export const SHARE_LOOK = \{[\s\S]*?\} as const;/.exec(src)![0];
    const outside = src.replace(look, "");
    expect(outside.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).toEqual([]);
    expect(outside.match(/\b(?:rgba?|hsla?|oklch)\(/g) ?? []).toEqual([]);
  });

  it.each(FILES)("%s uses no glass, no type size outside the role scale, no markup string, no hand-made money", (file) => {
    const src = code(file);
    expect(GLASS.test(src)).toBe(false);
    expect(src.match(ARBITRARY_SIZE) ?? []).toEqual([]);
    expect(src.match(MARKUP_STRING)).toBeNull();
    expect(src.match(MONEY)).toBeNull();
  });

  it.each(PARTS)("%s sends nothing", (file) => {
    expect(code(file).match(SENDS)).toBeNull();
  });

  it(`${CONTAINER} reads only through use-earn`, () => {
    const src = code(CONTAINER);
    expect(src.match(/\bfetch\s*\(/)).toBeNull();
    expect(src.match(/['"`]\/api\//)).toBeNull();
    expect(queryModulesOf(src)).toEqual(["@/hooks/queries/use-earn"]);
  });
});
