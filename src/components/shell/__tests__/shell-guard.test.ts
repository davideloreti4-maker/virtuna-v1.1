import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// ─────────────────────────────────────────────────────────────────────────────
// The shell is the first code written for the new look, and every later surface
// copies from it. Two rules keep it honest (spec §8):
//   1. No colour literals. A hex or rgb() here would not follow the theme, and the
//      first one invites the second.
//   2. `backdropFilter` only in the tab bar. Glass is for chrome that floats over
//      content, never for cards; Lightning CSS strips it from classes, so it can only
//      appear as an inline style, which makes this greppable.
// PURE FS test (default `node` env).
// ─────────────────────────────────────────────────────────────────────────────

const SHELL = join(__dirname, '..');

const FILES = readdirSync(SHELL, { withFileTypes: true })
  .filter((e) => e.isFile() && /\.tsx?$/.test(e.name))
  .map((e) => e.name);

/** Source with comments removed, so prose like "#559" or "rgba" in a comment cannot trip it. */
function code(file: string): string {
  return readFileSync(join(SHELL, file), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('shell: tokens only', () => {
  it('finds the shell (guards against a walker that matches nothing)', () => {
    expect(FILES.length).toBeGreaterThan(0);
  });

  it.each(FILES)('%s carries no colour literal', (file) => {
    const src = code(file);
    expect(src.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).toEqual([]);
    expect(src.match(/\brgba?\(/g) ?? []).toEqual([]);
  });

  // Glass is allowed in exactly one shell file.
  it.each(FILES.filter((file) => file !== 'tab-bar.tsx'))('%s uses no glass', (file) => {
    expect(/backdropFilter/i.test(code(file))).toBe(false);
  });
});
