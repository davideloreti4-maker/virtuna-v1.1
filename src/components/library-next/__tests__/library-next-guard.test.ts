import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// ─────────────────────────────────────────────────────────────────────────────
// Library's new-look parts follow the shell's, the thread's and Home's rules (home-next-guard.test.ts,
// same method):
//   1. No colour literals. A hex or rgb() here would not follow the theme; nor would a Tailwind
//      palette name (`text-white`, `from-black/60`): colours come from the new look's tokens.
//   2. No glass anywhere. Library is a page: nothing floats over scrolling content, so nothing here
//      filters a backdrop, neither as a class (which Lightning CSS would strip anyway) nor inline.
//   3. The screen sends nothing (spec 2026-11-23 §5: nothing in Library spends credits). The parts
//      here are presentational: no request of their own, no query or mutation hook, no paid route.
//   4. The container (`library-next.tsx`) reads the data and hands it in. It reads only through the
//      app's hooks: no `fetch` of its own and no address under `/api/` in its source (so no paid
//      route by name either). Its tests assert that no paid route is ever called. Of the app's data
//      hooks it may import only the ones Library reads with: `use-library` (the chats),
//      `use-saved-items` (the saved pieces and their remove), `use-threads` (rename, pin and
//      the sidebar's short list) and, after posting, `use-posted` (a chat's posted link removed,
//      and the one read of the posts' numbers a visit asks for: reads cost no credits). Nothing
//      else from `@/hooks/queries`, the folder's index included (it carries every hook, the paid
//      ones too).
//   5. Of the old saved shelf (`@/components/saved`) only its view-model mapping is used
//      (`buildRowVM` from `saved-item-vm`, a saved piece's own text). Not its `FORWARD` (a
//      piece's next step, a paid route by name) and not its `SavedRow` (the old look's row).
//   6. `@/lib/library/chat-summary` only for its types: at run time it reads chats through the
//      block registry, which would come into Library's and Home's bundle with it. Its words
//      (`insideLabel`, `measureWords`) are in the leaf `@/lib/library/piece-words`.
// PURE FS test (default `node` env).
// ─────────────────────────────────────────────────────────────────────────────

const DIR = join(__dirname, '..');

const FILES = readdirSync(DIR, { withFileTypes: true })
  .filter((e) => e.isFile() && /\.tsx?$/.test(e.name))
  .map((e) => e.name);

/** The one part that reads data (rule 4); every other part is presentational (rule 3). */
const CONTAINER = 'library-next.tsx';
const PARTS = FILES.filter((file) => file !== CONTAINER);

/** Rule 4: the data hooks the container may import, and nothing else from their folder. */
const ALLOWED_QUERY_MODULES = [
  '@/hooks/queries/use-library',
  '@/hooks/queries/use-saved-items',
  '@/hooks/queries/use-threads',
  '@/hooks/queries/use-posted',
];

/** Every module under `@/hooks/queries` a source imports (`import … from`, `export … from`, `import()`). */
function queryModulesOf(src: string): string[] {
  return [...src.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)['"`](@\/hooks\/queries(?:\/[^'"`]*)?)['"`]/g)].map((m) => m[1]!);
}
const refusedQueryModules = (src: string) => queryModulesOf(src).filter((module) => !ALLOWED_QUERY_MODULES.includes(module));

/** Rule 5: the one module of the old saved shelf a part may import, and what from it. */
const ALLOWED_SAVED = { module: '@/components/saved/saved-item-vm', names: ['buildRowVM'] };

/** Every import from `@/components/saved`, with the names it brings (`import { a, b as c } from …`). */
function savedImportsOf(src: string): Array<{ module: string; names: string[] }> {
  return [...src.matchAll(/import\s+(?:type\s+)?(\{[^}]*\}|[\w*\s,]+?)\s+from\s*['"`](@\/components\/saved(?:\/[^'"`]*)?)['"`]/g)].map((m) => ({
    module: m[2]!,
    names: m[1]!
      .replace(/[{}]/g, '')
      .split(',')
      .map((part) => part.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0]!)
      .filter(Boolean),
  }));
}
const refusedSaved = (src: string) =>
  savedImportsOf(src).filter(({ module, names }) => module !== ALLOWED_SAVED.module || names.some((name) => !ALLOWED_SAVED.names.includes(name)));

/** Rule 6: an import of `chat-summary` that is not type-only (it would run, and bundle, the module). */
const RUNTIME_SUMMARY = /import\s+(?!type\b)[^;]*?from\s*['"`]@\/lib\/library\/chat-summary['"`]/;

/** Source with comments removed, so prose like "#559" or "rgba" in a comment cannot trip it. */
function code(file: string): string {
  return readFileSync(join(DIR, file), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/** Any Tailwind backdrop utility (`backdrop-blur-xl`, `backdrop-brightness-50`, …), or an
 *  arbitrary `[backdrop-…]` property, anywhere in a source. */
const BLUR_CLASS = /\bbackdrop-|\[backdrop/;

/** A Tailwind palette colour in a colour utility (`text-white`, `bg-black`, `from-black/60`,
 *  `md:text-gray-500`, `ring-offset-zinc-900`, `bg-[white]`, …). The palette does not follow the
 *  theme: in the new look a colour comes from its tokens (`text-foreground`, `bg-scrim`,
 *  `text-action-foreground`, …). `transparent` and `current` are not palette colours and pass. */
const PALETTE = [
  'white', 'black', 'slate', 'gray', 'zinc', 'neutral', 'stone', 'mauve', 'olive', 'mist', 'taupe',
  'red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'teal', 'cyan', 'sky', 'blue',
  'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose',
].join('|');
const COLOUR_UTILITY =
  'text|bg|from|via|to|border(?:-[xytrblse])?|ring(?:-offset)?|inset-ring|outline|divide|fill|stroke|' +
  'shadow|inset-shadow|drop-shadow|decoration|caret|accent|placeholder';
const PALETTE_CLASS = new RegExp(
  `\\b(?:${COLOUR_UTILITY})-(?:(?:${PALETTE})\\b|\\[(?:color:)?(?:${PALETTE})\\])`,
  'g',
);

/** What a part that sends a request would carry: a call to `fetch`, an address under `/api/`, a
 *  query or mutation hook, or the app's data hooks. */
const SENDS = /\bfetch\s*\(|['"`]\/api\/|\buse(?:Query|Mutation|InfiniteQuery)\b|@\/hooks\/queries/;

describe('the guard itself', () => {
  it.each(['backdrop-blur-xl', 'md:backdrop-saturate-150', 'backdrop-brightness-50', 'backdrop-opacity-80', 'backdrop-filter', '[backdrop-filter:blur(4px)]'])(
    'refuses the class %s',
    (sample) => {
      expect(BLUR_CLASS.test(`className="rounded-4xl ${sample}"`)).toBe(true);
    },
  );

  it.each([
    'text-white', 'bg-black', 'from-black/60', 'text-gray-500', 'md:bg-zinc-900', 'hover:text-white/80',
    'border-slate-200', 'border-t-black', 'ring-white/30', 'ring-offset-neutral-950', 'shadow-black/40',
    'divide-white/10', 'fill-white', 'stroke-red-500', 'via-blue-500', 'to-white', 'placeholder-gray-400',
    'decoration-pink-500', 'caret-white', 'accent-emerald-500', 'bg-[white]', 'text-[color:black]',
  ])('refuses the palette colour %s', (sample) => {
    expect(`className="h-6 ${sample} rounded-xl"`.match(PALETTE_CLASS)).not.toBeNull();
  });

  it.each([
    'text-foreground', 'text-foreground-secondary', 'bg-scrim', 'from-scrim', 'to-transparent', 'text-action-foreground',
    'bg-surface-sunken', 'shadow-[0_0_0_1px_var(--color-border)]', 'text-current', 'border-border', 'divide-border', 'text-error',
  ])('lets the token %s through', (sample) => {
    expect(`className="${sample}"`.match(PALETTE_CLASS)).toBeNull();
  });

  it.each([
    'await fetch(url)',
    'fetch ("/x")',
    'const href = "/api/threads/library"',
    "post('/api/tools/test')",
    'useQuery({ queryKey })',
    'useMutation({ mutationFn })',
    'import { useLibrary } from "@/hooks/queries/use-library"',
  ])('refuses the request %s', (sample) => {
    expect(SENDS.test(sample)).toBe(true);
  });

  it.each(['href="/simulation/a1"', 'onRefetch()', 'prefetch={false}'])('lets %s through', (sample) => {
    expect(SENDS.test(sample)).toBe(false);
  });

  it.each([
    'import { useLibraryChats } from "@/hooks/queries/use-library";',
    "import { useSavedItems } from '@/hooks/queries/use-saved-items';",
    'import { useRenameThread, usePinThread } from "@/hooks/queries/use-threads";',
    'import type { LibraryPage } from "@/lib/library/library-page";',
  ])('the container may import: %s', (sample) => {
    expect(refusedQueryModules(sample)).toEqual([]);
  });

  it.each([
    ['import { useThreadList } from "@/hooks/queries";', '@/hooks/queries'],
    ['import { useAnalyze } from "@/hooks/queries/use-analyze";', '@/hooks/queries/use-analyze'],
    ["import {\n  useHooksStream,\n} from '@/hooks/queries/use-hooks-stream';", '@/hooks/queries/use-hooks-stream'],
    ['export { useScriptStream } from "@/hooks/queries/use-script-stream";', '@/hooks/queries/use-script-stream'],
    ['const m = await import("@/hooks/queries/use-simulation-row");', '@/hooks/queries/use-simulation-row'],
    ['import "@/hooks/queries/use-feed";', '@/hooks/queries/use-feed'],
    ['import { x } from "@/hooks/queries/use-library-projects";', '@/hooks/queries/use-library-projects'],
  ])('the container may not import: %s', (sample, module) => {
    expect(refusedQueryModules(sample)).toEqual([module]);
  });
});

describe('the guard itself: the old saved shelf and the summary module', () => {
  it.each([
    'import { buildRowVM } from "@/components/saved/saved-item-vm";',
    "import { buildRowVM as vmOf } from '@/components/saved/saved-item-vm';",
  ])('lets through: %s', (sample) => {
    expect(refusedSaved(sample)).toEqual([]);
  });

  it.each([
    'import { buildRowVM, FORWARD } from "@/components/saved/saved-item-vm";',
    'import { FORWARD } from "@/components/saved/saved-item-vm";',
    'import { SavedRow } from "@/components/saved/saved-row";',
    'import { SavedShelf } from "@/components/saved";',
    'import { TYPE_LABEL } from "@/components/saved/saved-item-vm";',
  ])('refuses: %s', (sample) => {
    expect(refusedSaved(sample)).toHaveLength(1);
  });

  it.each([
    'import { insideLabel } from "@/lib/library/chat-summary";',
    'import { measureWords, type PieceKind } from "@/lib/library/chat-summary";',
  ])('refuses a run-time import of the summary module: %s', (sample) => {
    expect(RUNTIME_SUMMARY.test(sample)).toBe(true);
  });

  it.each(['import type { PieceKind } from "@/lib/library/chat-summary";', 'import { insideLabel } from "@/lib/library/piece-words";'])(
    'lets a type-only import through: %s',
    (sample) => {
      expect(RUNTIME_SUMMARY.test(sample)).toBe(false);
    },
  );
});

describe('library-next: tokens only, no glass, no requests', () => {
  it('finds the parts (guards against a walker that matches nothing)', () => {
    expect(FILES).toContain('library-screen.tsx');
    expect(FILES).toContain('chat-row.tsx');
    expect(FILES).toContain('saved-row.tsx');
    expect(FILES).toContain('library-icons.tsx');
    expect(FILES).toContain('row-menu-layer.tsx');
    expect(FILES).toContain(CONTAINER);
    expect(PARTS).not.toContain(CONTAINER);
    expect(PARTS).toHaveLength(FILES.length - 1);
  });

  it.each(FILES)('%s carries no colour literal', (file) => {
    const src = code(file);
    expect(src.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).toEqual([]);
    expect(src.match(/\b(?:rgba?|hsla?|oklch)\(/g) ?? []).toEqual([]);
  });

  it.each(FILES)('%s uses no Tailwind palette colour', (file) => {
    expect(code(file).match(PALETTE_CLASS) ?? []).toEqual([]);
  });

  it.each(FILES)('%s uses no backdrop class', (file) => {
    expect(code(file).match(BLUR_CLASS)).toBeNull();
  });

  it.each(FILES)('%s uses no glass', (file) => {
    expect(/backdrop-?filter/i.test(code(file))).toBe(false);
  });

  it.each(PARTS)('%s sends nothing', (file) => {
    expect(code(file).match(SENDS)).toBeNull();
  });

  it(`${CONTAINER} reads only through the app's hooks: no fetch of its own, no address under /api/`, () => {
    const src = code(CONTAINER);
    expect(src.match(/\bfetch\s*\(/)).toBeNull();
    expect(src.match(/['"`]\/api\//)).toBeNull();
  });

  it.each(FILES)("%s takes only the view-model mapping from the old saved shelf: never FORWARD, never its SavedRow", (file) => {
    const src = code(file);
    expect(refusedSaved(src)).toEqual([]);
    expect(src.match(/\bFORWARD\b/)).toBeNull();
  });

  it(`${CONTAINER} does take that mapping (the rule sees its imports)`, () => {
    expect(savedImportsOf(code(CONTAINER))).toEqual([{ module: ALLOWED_SAVED.module, names: ['buildRowVM'] }]);
  });

  it.each(FILES)('%s takes only types from the summary module at run time (its words come from the leaf)', (file) => {
    expect(code(file).match(RUNTIME_SUMMARY)).toBeNull();
  });

  it(`${CONTAINER} imports only the data hooks Library reads with`, () => {
    const src = code(CONTAINER);
    expect(queryModulesOf(src)).toContain('@/hooks/queries/use-library'); // the rule sees its imports
    expect(refusedQueryModules(src)).toEqual([]);
  });
});
