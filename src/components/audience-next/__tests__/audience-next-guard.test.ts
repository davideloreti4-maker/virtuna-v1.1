import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

// ─────────────────────────────────────────────────────────────────────────────
// Audience's new-look parts follow Library's, You's and Earn's rules (library-next-guard.test.ts, same
// method):
//   1. No colour literals and no Tailwind palette colour: colours come from the new look's tokens.
//   2. No glass. Audience is a page: nothing here filters a backdrop, as a class or inline.
//   3. No paid route by name (`/api/tools`, `/api/analyze`): nothing on this page spends credits.
//   4. Nothing from the old audience screens (`@/components/audience`), and never the server read
//      (`read-audience-page`): the page reads on the server and hands its result in.
//   5. Every part but the containers (`audience-next.tsx`, `new-audience-next.tsx`, once they exist)
//      sends nothing: no `fetch`, no address under `/api/`, no query or mutation hook, nothing from
//      `@/hooks/queries`. The containers send only through the part's own hook module: no `fetch` of
//      their own, no `/api/` address, and of `@/hooks/queries` only `use-audience-next`.
//   6. The words: no string and no JSX text says Test, thread, calibrate, persona, Simulated or
//      Audiences (spec section 6). The code value `verb: "Test"` (the composer's launch verb, never
//      shown) is the one exception. Comments and module names do not count.
// PURE FS test (default `node` env).
// ─────────────────────────────────────────────────────────────────────────────

const DIR = join(__dirname, "..");

const FILES = readdirSync(DIR, { withFileTypes: true })
  .filter((e) => e.isFile() && /\.tsx?$/.test(e.name))
  .map((e) => e.name);

/** The parts that send (rule 5), when present. */
const CONTAINERS = ["audience-next.tsx", "new-audience-next.tsx"];
const PARTS = FILES.filter((file) => !CONTAINERS.includes(file));
const PRESENT_CONTAINERS = FILES.filter((file) => CONTAINERS.includes(file));

/** The one module of `@/hooks/queries` a container may import. */
const ALLOWED_QUERY_MODULES = ["@/hooks/queries/use-audience-next"];

/** Every module a source names: `import … from`, `export … from`, a bare `import "…"`, `import()`, `require()`. */
const modulesOf = (src: string): string[] =>
  [...src.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+|\brequire\s*\(\s*)["'`]([^"'`]+)["'`]/g)].map((m) => m[1]!);
const queryModulesOf = (src: string) => modulesOf(src).filter((m) => /^@\/hooks\/queries(?:\/|$)/.test(m));
const refusedQueryModules = (src: string) => queryModulesOf(src).filter((m) => !ALLOWED_QUERY_MODULES.includes(m));

/** Rule 4: the old screens' folder (not this one, `audience-next`), and the server read. */
const FORBIDDEN_MODULE = /^@\/components\/audience(?:\/|$)|(?:^|\/)read-audience-page(?:\.ts)?$/;
const forbiddenModules = (src: string) => modulesOf(src).filter((m) => FORBIDDEN_MODULE.test(m));

/** Source with comments removed, so prose like "#559" or "rgba" in a comment cannot trip it. */
function code(file: string): string {
  return readFileSync(join(DIR, file), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const BLUR_CLASS = /\bbackdrop-|\[backdrop/;
const PALETTE = [
  "white", "black", "slate", "gray", "zinc", "neutral", "stone", "mauve", "olive", "mist", "taupe",
  "red", "orange", "amber", "yellow", "lime", "green", "emerald", "teal", "cyan", "sky", "blue",
  "indigo", "violet", "purple", "fuchsia", "pink", "rose",
].join("|");
const COLOUR_UTILITY =
  "text|bg|from|via|to|border(?:-[xytrblse])?|ring(?:-offset)?|inset-ring|outline|divide|fill|stroke|" +
  "shadow|inset-shadow|drop-shadow|decoration|caret|accent|placeholder";
const PALETTE_CLASS = new RegExp(`\\b(?:${COLOUR_UTILITY})-(?:(?:${PALETTE})\\b|\\[(?:color:)?(?:${PALETTE})\\])`, "g");
const SENDS = /\bfetch\s*\(|['"`]\/api\/|\buse(?:Query|Mutation|InfiniteQuery)\b|@\/hooks\/queries/;
const PAID = /\/api\/(?:tools|analyze)\b/;

/**
 * Rule 6's words. Thread, calibrate and persona are refused at the start of a sentence too ("Calibrating…").
 * Persona only as the word itself: "personal" is an audience's type, which the containers send. Test,
 * Simulated and Audiences as written: "test" in a made-up handle passes.
 */
const BANNED_WORDS = /\b(?:Test|[Tt]hreads?|[Cc]alibrat\w*|[Pp]ersonas?|Simulated|Audiences)\b/;

/**
 * Every text a source shows or holds as a value: string literals, template pieces and JSX text. Not module
 * names (`import … from "…"`), and not the code value `verb: "Test"`.
 */
function textsOf(source: string, name = "sample.tsx"): string[] {
  const file = ts.createSourceFile(name, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const out: string[] = [];
  const isModuleName = (node: ts.Node) =>
    (ts.isImportDeclaration(node.parent) || ts.isExportDeclaration(node.parent)) && node.parent.moduleSpecifier === node;
  const isLaunchVerb = (node: ts.StringLiteral) =>
    node.text === "Test" && ts.isPropertyAssignment(node.parent) && node.parent.name.getText(file) === "verb";
  const visit = (node: ts.Node) => {
    if (ts.isStringLiteral(node)) {
      if (!isModuleName(node) && !isLaunchVerb(node)) out.push(node.text);
    } else if (ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
      out.push(node.text);
    } else if (ts.isJsxText(node)) {
      out.push(node.text);
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      return; // a dynamic import's module name
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return out;
}
const bannedIn = (source: string, name?: string) => textsOf(source, name).filter((t) => BANNED_WORDS.test(t));

describe("the guard itself", () => {
  it.each(["text-white", "bg-black", "md:bg-zinc-900", "ring-white/30", "bg-[white]", "fill-white"])("refuses the palette colour %s", (sample) => {
    expect(`className="h-6 ${sample}"`.match(PALETTE_CLASS)).not.toBeNull();
  });

  it.each(["text-foreground", "bg-surface-sunken", "text-above", "text-below-text", "shadow-[var(--shadow-rest)]", "fill-foreground-secondary"])(
    "lets the token %s through",
    (sample) => {
      expect(`className="${sample}"`.match(PALETTE_CLASS)).toBeNull();
    },
  );

  it.each(["backdrop-blur-xl", "[backdrop-filter:blur(4px)]"])("refuses the glass %s", (sample) => {
    expect(BLUR_CLASS.test(`className="${sample}"`)).toBe(true);
  });

  it.each(['await fetch(url)', 'const href = "/api/audiences"', "useMutation({ mutationFn })", 'import { x } from "@/hooks/queries/use-audience-next"'])(
    "refuses the request %s",
    (sample) => {
      expect(SENDS.test(sample)).toBe(true);
    },
  );

  it.each(['"/api/tools/hooks"', '"/api/analyze"'])("knows the paid route %s", (sample) => {
    expect(PAID.test(sample)).toBe(true);
  });

  it("sees a container's query modules, and refuses all but the part's own", () => {
    const src =
      'import { useRenameAudience } from "@/hooks/queries/use-audience-next";\n' +
      'import { useAudiences } from "@/hooks/queries/use-audiences";\nimport { x } from "@/hooks/queries";';
    expect(queryModulesOf(src)).toHaveLength(3);
    expect(refusedQueryModules(src)).toEqual(["@/hooks/queries/use-audiences", "@/hooks/queries"]);
  });

  it("refuses the old screens and the server read, and lets this folder through", () => {
    expect(forbiddenModules('import { x } from "@/components/audience/audience-create";')).toHaveLength(1);
    expect(forbiddenModules('import { groupAudiences } from "@/components/audience";')).toHaveLength(1);
    expect(forbiddenModules('import { readAudiencePage } from "@/lib/audience-next/read-audience-page";')).toHaveLength(1);
    expect(forbiddenModules('import { Face } from "@/components/audience-next/face";')).toEqual([]);
    expect(forbiddenModules('import { Face } from "./face";')).toEqual([]);
  });

  it.each([
    'const a = "Test your hook";',
    "const b = <p>Open the thread</p>;",
    "const c = `Calibrating ${n}`;",
    'const d = { label: "Simulated" };',
    "const e = <b>Your Audiences</b>;",
    'const f = "persona";',
  ])("refuses the words in %s", (sample) => {
    expect(bannedIn(sample)).not.toEqual([]);
  });

  it.each([
    'import { AudienceRing } from "@/components/result/audience-ring";\nimport type { Archetype } from "@/lib/engine/wave3/persona-registry";',
    'import { x } from "@/components/thread-next/field-icons";',
    'const href = buildThreadLaunchHref({ input: "", verb: "Test" });',
    "const g = <p>These are general viewers</p>;",
    'const h = "@nia.tests";',
    "// a comment about the thread\nconst i = 1;",
  ])("lets through %s", (sample) => {
    expect(bannedIn(sample)).toEqual([]);
  });

  it.each(['const t = { type: "personal" };', "const u = <p>A personal note</p>;"])("lets the audience type through: %s", (sample) => {
    expect(bannedIn(sample)).toEqual([]);
  });

  it.each(['const v = "persona";', "const w = <b>Personas</b>;", 'const x = "the personas";'])("still refuses the word itself: %s", (sample) => {
    expect(bannedIn(sample)).not.toEqual([]);
  });

  it("the launch verb is the only exception: Test elsewhere is refused", () => {
    expect(bannedIn('const x = { label: "Test" };')).toEqual(["Test"]);
  });
});

describe("audience-next: tokens only, no glass, no requests in the parts, the part's words", () => {
  it("finds the parts (guards against a walker that matches nothing)", () => {
    for (const file of ["audience-screen.tsx", "ring-card.tsx", "face.tsx", "source-card.tsx", "figures.tsx", "groups-card.tsx", "texts-card.tsx", "videos-card.tsx"]) {
      expect(FILES).toContain(file);
    }
    expect(PARTS.length + PRESENT_CONTAINERS.length).toBe(FILES.length);
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
    const src = code(file);
    expect(src.match(BLUR_CLASS)).toBeNull();
    expect(/backdrop-?filter/i.test(src)).toBe(false);
  });

  it.each(FILES)("%s names no paid route", (file) => {
    expect(code(file).match(PAID)).toBeNull();
  });

  it.each(FILES)("%s imports nothing from the old audience screens and never the server read", (file) => {
    expect(forbiddenModules(code(file))).toEqual([]);
  });

  it.each(PARTS)("%s sends nothing", (file) => {
    expect(code(file).match(SENDS)).toBeNull();
  });

  it("the containers, once they exist, send only through the part's own hook module", () => {
    for (const file of PRESENT_CONTAINERS) {
      const src = code(file);
      expect(src.match(/\bfetch\s*\(/), file).toBeNull();
      expect(src.match(/['"`]\/api\//), file).toBeNull();
      expect(refusedQueryModules(src), file).toEqual([]);
    }
  });

  it.each(FILES)("%s says none of the words the part never uses", (file) => {
    expect(bannedIn(readFileSync(join(DIR, file), "utf8"), file)).toEqual([]);
  });
});
