/**
 * THEME-02 Layer B regression guard (D-06).
 *
 * The 3 hardcoded inline-glass spots in Sidebar.tsx (nav container, account
 * popover, mobile hamburger) hardcode the Raycast 137deg gradient + backdrop
 * blur — a token-only reskin (plan 01-01, Layer A) does NOT touch them
 * (RESEARCH Pitfall 4). This cheap source-assertion fails until Task 2 flattens
 * them and stays as a guard against the glass creeping back.
 *
 * Node env (default) — it reads the source file off disk, no DOM needed.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SIDEBAR_PATH = resolve(process.cwd(), 'src/components/sidebar/Sidebar.tsx');
const source = readFileSync(SIDEBAR_PATH, 'utf8');

describe('Sidebar.tsx flat-warm glass strip (Layer B)', () => {
  it('contains no 137deg Raycast gradient', () => {
    expect(source).not.toMatch(/linear-gradient\(\s*137deg/);
  });

  it('contains no backdrop-filter blur (matte target = no blur)', () => {
    expect(source).not.toMatch(/backdropFilter/);
    expect(source).not.toMatch(/WebkitBackdropFilter/);
  });
});
