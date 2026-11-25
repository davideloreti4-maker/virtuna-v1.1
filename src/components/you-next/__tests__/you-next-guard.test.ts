import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// ─────────────────────────────────────────────────────────────────────────────
// You's new-look parts follow Library's rules (library-next-guard.test.ts, same method):
//   1. No colour literals and no Tailwind palette colour: colours come from the new look's tokens.
//   2. No glass: You is a page.
//   3. The parts send nothing: no fetch, no address under /api/, no query or mutation hook.
//   4. The container (`you-next.tsx`) reads only through the app's hooks, and only these:
//      `use-you`, `use-creator-profile`, `use-profile`.
//   5. Nothing here names a paid route, and nothing names `writing_style_sample` (a verbatim
//      caption that never reaches the page).
// PURE FS test (default `node` env).
// ─────────────────────────────────────────────────────────────────────────────

const DIR = join(__dirname, "..");
const FILES = readdirSync(DIR, { withFileTypes: true }).filter((e) => e.isFile() && /\.tsx?$/.test(e.name)).map((e) => e.name);
const CONTAINER = "you-next.tsx";
const PARTS = FILES.filter((file) => file !== CONTAINER);
const ALLOWED_QUERY_MODULES = ["@/hooks/queries/use-you", "@/hooks/queries/use-creator-profile", "@/hooks/queries/use-profile"];

/** Source with comments removed, so prose like "#559" or "rgba" in a comment cannot trip it. */
function code(file: string): string {
  return readFileSync(join(DIR, file), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}
/** Every module under `@/hooks/queries` a source imports (`import … from`, `export … from`, `import()`). */
const queryModulesOf = (src: string) =>
  [...src.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)['"`](@\/hooks\/queries(?:\/[^'"`]*)?)['"`]/g)].map((m) => m[1]!);

// The palette and the colour utilities as Library's guard has them (its list is the longer one).
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
const PAID = /\/api\/(?:tools|analyze|account-read)\b/;

describe("the guard itself", () => {
  it.each(["text-white", "bg-black", "placeholder:text-gray-400", "md:bg-zinc-900", "ring-white/30", "bg-[white]"])("refuses the palette colour %s", (sample) => {
    expect(`className="h-6 ${sample}"`.match(PALETTE_CLASS)).not.toBeNull();
  });

  it.each(["text-foreground-muted", "bg-surface-sunken", "bg-active", "hover:bg-hover", "text-action-foreground", "divide-border"])(
    "lets the token %s through",
    (sample) => {
      expect(`className="${sample}"`.match(PALETTE_CLASS)).toBeNull();
    },
  );

  it.each(["backdrop-blur-xl", "[backdrop-filter:blur(4px)]", "backdropFilter"])("refuses the glass %s", (sample) => {
    expect(GLASS.test(sample)).toBe(true);
  });

  it.each(['await fetch(url)', 'const href = "/api/you"', "useMutation({ mutationFn })", 'import { useYou } from "@/hooks/queries/use-you"'])(
    "refuses the request %s",
    (sample) => {
      expect(SENDS.test(sample)).toBe(true);
    },
  );

  it.each(['"/api/tools/hooks"', '"/api/analyze"', '"/api/account-read"'])("knows the paid route %s", (sample) => {
    expect(PAID.test(sample)).toBe(true);
  });

  it("sees the container's imports, and refuses the ones it may not use", () => {
    const src = 'import { useYou } from "@/hooks/queries/use-you";\nimport { useAnalyze } from "@/hooks/queries/use-analyze";\nimport { x } from "@/hooks/queries";';
    expect(queryModulesOf(src).filter((m) => !ALLOWED_QUERY_MODULES.includes(m))).toEqual(["@/hooks/queries/use-analyze", "@/hooks/queries"]);
  });
});

describe("you-next: tokens only, no glass, no requests in the parts", () => {
  it("finds the parts (guards against a walker that matches nothing)", () => {
    for (const file of [
      "you-words.ts", "row-parts.tsx", "fact-row.tsx", "niche-row.tsx", "goal-row.tsx",
      "who-block.tsx", "connect-row.tsx", "you-screen.tsx", "you-sign-up.tsx", "you-next.tsx", "account-menu.tsx",
    ]) expect(FILES).toContain(file);
  });

  it.each(FILES)("%s carries no colour literal", (file) => {
    const src = code(file);
    expect(src.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).toEqual([]);
    expect(src.match(/\b(?:rgba?|hsla?|oklch)\(/g) ?? []).toEqual([]);
  });

  it.each(FILES)("%s uses no Tailwind palette colour", (file) => {
    expect(code(file).match(PALETTE_CLASS) ?? []).toEqual([]);
  });

  it.each(FILES)("%s uses no glass", (file) => {
    expect(GLASS.test(code(file))).toBe(false);
  });

  it.each(PARTS)("%s sends nothing", (file) => {
    expect(code(file).match(SENDS)).toBeNull();
  });

  it.each(FILES)("%s names no paid route and never the verbatim caption", (file) => {
    const src = code(file);
    expect(src.match(PAID)).toBeNull();
    expect(src).not.toMatch(/writing_style_sample/);
  });

  it("the container, once it exists, reads only through the three hooks it may use", () => {
    if (!FILES.includes(CONTAINER)) return; // Task 5 adds it; from then on this holds.
    const src = code(CONTAINER);
    expect(src.match(/\bfetch\s*\(/)).toBeNull();
    expect(src.match(/['"`]\/api\//)).toBeNull();
    expect(queryModulesOf(src).filter((m) => !ALLOWED_QUERY_MODULES.includes(m))).toEqual([]);
  });
});
