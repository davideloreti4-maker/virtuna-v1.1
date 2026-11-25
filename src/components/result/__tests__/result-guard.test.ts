import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// ─────────────────────────────────────────────────────────────────────────────
// The result page is built from tokens only, like the shell (same method as
// src/components/shell/__tests__/shell-guard.test.ts):
//   1. No colour literals. A hex or rgb() here would not follow the theme. In SVG
//      a colour is `currentColor` or `var(--color-…)`.
//   2. Glass (`backdropFilter`) only on the play mark that floats on the video, in
//      player.tsx. Cards and panels are never glass.
//   3. No type size outside the role scale (`text-[13px]`): SVG text sets its size
//      through the `fontSize` attribute instead.
// PURE FS test (default `node` env).
// ─────────────────────────────────────────────────────────────────────────────

const RESULT = join(__dirname, '..');

const FILES = readdirSync(RESULT, { withFileTypes: true })
  .filter((e) => e.isFile() && /\.tsx?$/.test(e.name))
  .map((e) => e.name);

/** Source with comments removed, so prose like "#562" or "rgba" in a comment cannot trip it. */
function code(file: string): string {
  return readFileSync(join(RESULT, file), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('result page: tokens only', () => {
  it('finds the result parts (guards against a walker that matches nothing)', () => {
    expect(FILES.length).toBeGreaterThan(10);
  });

  it.each(FILES)('%s carries no colour literal', (file) => {
    const src = code(file);
    expect(src.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).toEqual([]);
    expect(src.match(/\b(rgba?|hsla?|oklch)\(/g) ?? []).toEqual([]);
  });

  // Glass is for controls that float on a video (docs/DESIGN-SYSTEM.md, "Next look: elevation").
  // On this page that is the play mark, and it lives in exactly one file.
  it.each(FILES.filter((file) => file !== 'player.tsx'))('%s uses no glass', (file) => {
    expect(/backdropFilter|backdrop-blur/i.test(code(file))).toBe(false);
  });

  it.each(FILES)('%s sets no type size outside the role scale', (file) => {
    expect(code(file).match(/\btext-\[\d+(\.\d+)?(px|rem|em)\]/g) ?? []).toEqual([]);
  });
});
