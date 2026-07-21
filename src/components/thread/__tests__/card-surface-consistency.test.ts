import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// ─────────────────────────────────────────────────────────────────────────────
// Card-surface consistency — the static gate for THE CARD CONTRACT's one card fill.
//
// The contract: every in-thread skill card sits on the SAME surface so a thread of
// mixed cards reads as one system. That fill is `bg-surface-sunken` (globals.css
// --color-surface-sunken → #1a1a19). The make-family (hook/script/remix/idea),
// the test card, and Text Read all already use it.
//
// The drift this locks (found live 2026-07-21): two read-family cards had wandered
// off the shared tone —
//   - account-read-block  used `bg-transparent`  → rendered as the app bg (#1f1f1e),
//     an "invisible box" with no lift next to its lifted siblings.
//   - skill-result-card    used `bg-surface-thread` (#252524) → a shade LIGHTER than
//     the rest, so Explore looked like a different card.
// Both now use `bg-surface-sunken`; this guard stops either coming back.
//
// Same cheap FS-grep shape as radius-scale / reskin-matte: pure node env, read the
// source text, assert the render string. Fail-first vs the pre-fix code: account
// lacked `bg-surface-sunken`, and skill-result-card carried the banned
// `bg-surface-thread`.
// ─────────────────────────────────────────────────────────────────────────────

const THREAD = join(__dirname, '..'); // …/src/components/thread

/** Every in-thread skill card. Each MUST fill its outer container with bg-surface-sunken. */
const CARD_FILES = [
  'account-read-block.tsx',
  'multi-audience-read-block.tsx',
  'skill-result-card.tsx', // Explore's container
  'remix-card-block.tsx',
  'hook-card-block.tsx',
  'script-card-block.tsx',
  'idea-card-block.tsx',
  'video-test-card-block.tsx',
] as const;

/**
 * Read a component's CODE with comments stripped. The guard asserts on the RENDERED
 * className, never on documentation: a `/* … bg-surface-thread … *\/` comment that
 * explains the retired tone must not trip the ban (the repo's tailwind-scans-comments
 * hazard, run in reverse on our own guard). Block + line comments removed; the `[^:]`
 * lookbehind on line comments spares `https://` inside a string.
 */
function read(file: string): string {
  return readFileSync(join(THREAD, file), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('card-surface consistency (THE CARD CONTRACT — one card fill)', () => {
  it.each(CARD_FILES)('%s uses the canonical bg-surface-sunken fill', (file) => {
    expect(read(file)).toContain('bg-surface-sunken');
  });

  it.each(CARD_FILES)('%s does not fill its card with the lighter bg-surface-thread', (file) => {
    // #252524 is the retired card tone — it made Explore read a shade lighter than the rest.
    expect(read(file)).not.toContain('bg-surface-thread');
  });

  it('account-read no longer uses the invisible bg-transparent card fill', () => {
    // bg-transparent on the CARD const rendered the card as the app bg (#1f1f1e) — no lift.
    const src = read('account-read-block.tsx');
    const cardConst = src.match(/const CARD = '([^']*)'/)?.[1] ?? '';
    expect(cardConst).toContain('bg-surface-sunken');
    expect(cardConst).not.toContain('bg-transparent');
  });
});
