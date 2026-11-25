import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

// ─────────────────────────────────────────────────────────────────────────────
// The posted parts (plan 2026-11-24-after-posting, Task 3) follow You's and Library's rules (same method
// as you-next-guard.test.ts):
//   1. Tokens only: no colour literal, no Tailwind palette colour, no type size outside the role scale.
//   2. No glass: the card and the row sit on a page.
//   3. The card and the ask row are presentational: no request, no query or mutation hook.
//   4. The sheet and the container read and send only through `@/hooks/queries/use-posted`: no `fetch`
//      of their own, no address under `/api/`, no other data hook.
//   5. Text from outside the app is never read here: no caption, no stored post link.
//   6. The old result board (`/analyze/[id]`) is untouched: nothing under its route imports these parts
//      or their hooks.
// PURE FS test (default `node` env).
// ─────────────────────────────────────────────────────────────────────────────

const DIR = join(__dirname, "..");
const SRC = join(__dirname, "..", "..", "..");
const FILES = readdirSync(DIR, { withFileTypes: true }).filter((e) => e.isFile() && /\.tsx?$/.test(e.name)).map((e) => e.name);
const READERS = ["posted-sheet.tsx", "after-posting.tsx"];
const PARTS = FILES.filter((file) => !READERS.includes(file));

/** Source with comments removed, so prose like "#559" or "rgba" in a comment cannot trip it. */
function code(path: string): string {
  return readFileSync(path, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}
const own = (file: string) => code(join(DIR, file));
/** Every module under `@/hooks/queries` a source imports. */
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
const OUTSIDE_TEXT = /\bcaption\b|\bpost_url\b|\bpostUrl\b/;

/** Every source file under a folder, recursively. */
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : /\.tsx?$/.test(name) ? [path] : [];
  });
}

describe("the guard itself", () => {
  it.each(["text-white", "bg-black", "placeholder:text-gray-400", "text-green-600"])("refuses the palette colour %s", (sample) => {
    expect(`className="h-6 ${sample}"`.match(PALETTE_CLASS)).not.toBeNull();
  });
  it.each(["text-above", "text-below-text", "bg-surface-sunken", "text-foreground-secondary", "decoration-border-hover"])("lets the token %s through", (sample) => {
    expect(`className="${sample}"`.match(PALETTE_CLASS)).toBeNull();
  });
  it.each(['await fetch(url)', 'const href = "/api/posted"', "useMutation({ mutationFn })", 'import { usePosted } from "@/hooks/queries/use-posted"'])(
    "refuses the request %s in a part",
    (sample) => {
      expect(SENDS.test(sample)).toBe(true);
    },
  );
  it.each(["text-[13px]", "md:text-[12.5px]"])("refuses the size %s", (sample) => {
    expect(sample.match(ARBITRARY_SIZE)).not.toBeNull();
  });
});

describe("posted-next: tokens only, no glass, requests only through use-posted", () => {
  it("finds the parts (guards against a walker that matches nothing)", () => {
    for (const file of ["after-posting-card.tsx", "posted-ask.tsx", "posted-sheet.tsx", "after-posting.tsx"]) expect(FILES).toContain(file);
  });

  it.each(FILES)("%s carries no colour literal and no palette colour", (file) => {
    const src = own(file);
    expect(src.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).toEqual([]);
    expect(src.match(/\b(?:rgba?|hsla?|oklch)\(/g) ?? []).toEqual([]);
    expect(src.match(PALETTE_CLASS) ?? []).toEqual([]);
  });

  it.each(FILES)("%s uses no glass and no type size outside the role scale", (file) => {
    expect(GLASS.test(own(file))).toBe(false);
    expect(own(file).match(ARBITRARY_SIZE) ?? []).toEqual([]);
  });

  it.each(PARTS)("%s sends nothing", (file) => {
    expect(own(file).match(SENDS)).toBeNull();
  });

  it.each(READERS)("%s reads and sends only through use-posted", (file) => {
    const src = own(file);
    expect(src.match(/\bfetch\s*\(/)).toBeNull();
    expect(src.match(/['"`]\/api\//)).toBeNull();
    expect(queryModulesOf(src).filter((m) => m !== "@/hooks/queries/use-posted")).toEqual([]);
    expect(queryModulesOf(src)).toContain("@/hooks/queries/use-posted");
  });

  it.each(FILES)("%s never reads text from outside the app (a caption, the stored link)", (file) => {
    expect(own(file).match(OUTSIDE_TEXT)).toBeNull();
  });
});

describe("the old result board stays as it was", () => {
  it("nothing under /analyze imports the posted parts or their hooks", () => {
    const files = walk(join(SRC, "app", "(app)", "analyze"));
    expect(files.length).toBeGreaterThan(0);
    const importers = files.filter((path) => /posted-next|use-posted/.test(code(path)));
    expect(importers.map((path) => relative(SRC, path))).toEqual([]);
  });
});
