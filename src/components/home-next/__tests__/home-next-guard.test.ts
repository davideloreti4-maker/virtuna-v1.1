import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// ─────────────────────────────────────────────────────────────────────────────
// Home's new-look parts follow the shell's and the thread's rules (thread-next-guard.test.ts,
// same method):
//   1. No colour literals. A hex or rgb() here would not follow the theme; nor would a Tailwind
//      palette name (`text-white`, `from-black/60`): colours come from the new look's tokens.
//   2. No glass anywhere. Home is a page: nothing floats over scrolling content, so nothing here
//      filters a backdrop, neither as a class (which Lightning CSS would strip anyway) nor inline.
// PURE FS test (default `node` env).
// ─────────────────────────────────────────────────────────────────────────────

const DIR = join(__dirname, '..');

const FILES = readdirSync(DIR, { withFileTypes: true })
  .filter((e) => e.isFile() && /\.tsx?$/.test(e.name))
  .map((e) => e.name);

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
});

describe('home-next: tokens only, no glass', () => {
  it('finds the parts (guards against a walker that matches nothing)', () => {
    expect(FILES).toContain('home-screen.tsx');
    expect(FILES).toContain('home-next.tsx');
    expect(FILES).toContain('greeting.ts');
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
});
