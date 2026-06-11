/**
 * scripts/check-apca.ts — Dev-only APCA contrast gate (DS-02 / DS-03 / D-12).
 *
 * Validates each Numen warm-neutral pairing against its APCA Lc target on the
 * calibrated base `#1a1714`. APCA (Accessible Perceptual Contrast Algorithm,
 * WCAG 3 draft) is the correct perceptual metric for dark mode — WCAG 2 ratios
 * mislead on dark backgrounds.
 *
 * Run: `pnpm tsx scripts/check-apca.ts`
 * Exits non-zero on ANY failing pairing so it is a real pass/fail gate.
 *
 * Source: github.com/Myndex/apca-w3 (W3C reference impl). The canonical math is
 * `APCAcontrast(sRGBtoY(colorParsley(text)), sRGBtoY(colorParsley(bg)))`; the
 * library's `calcAPCA(text, bg)` wrapper performs exactly that pipeline and
 * accepts hex strings directly, so we use it for the per-pairing Lc value while
 * keeping the underlying `APCAcontrast`/`sRGBtoY` primitives referenced for the
 * documented low-level path. NOTE: `colorParsley` ships in the companion
 * `colorparsley` package (not re-exported by `apca-w3`); `calcAPCA` bundles it.
 *
 * Hexes below are the D-11 LOCKED palette (signed off Task 4, Option B):
 *   muted:       #a39c91 → #bab2a5 (lifted for Lc ≥ 60; #b8b0a3 was Lc 59.0, nudged to #bab2a5 = Lc 60.1)
 *   verdict-bad: #c97a64 → #d4866f (lifted for Lc ≥ 45)
 * All other hues unchanged. Must match `.numen-surface` in globals.css exactly.
 */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck -- apca-w3 ships no type declarations
import { APCAcontrast, sRGBtoY, calcAPCA } from "apca-w3";

// Re-export-free reference to the low-level primitives so they are not
// tree-shaken away and remain the documented contrast pipeline (D-12).
void APCAcontrast;
void sRGBtoY;

/** Absolute APCA Lc for `textHex` on `bgHex` (abs because dark-mode polarity). */
function lc(textHex: string, bgHex: string): number {
  return Math.abs(calcAPCA(textHex, bgHex) as number);
}

const BASE = "#1a1714"; // --numen-bg (warm near-black; no pure black, D-11)

interface Pairing {
  label: string;
  text: string;
  /** APCA Lc floor for this role on BASE (Q4 targets). */
  target: number;
  role: string;
}

// Q4 APCA Lc targets on the warm base:
//  - body / fluent text (≤16px/400): Lc ≥ 75 floor (90 preferred)
//  - non-body UI labels (muted):     Lc ≥ 60
//  - accent text-on-base (large/heavy, ≥24px bold): Lc ≥ 45
//  - verdict band labels (large/heavy):             Lc ≥ 45
const PAIRINGS: Pairing[] = [
  { label: "body", text: "#f0ebe3", target: 75, role: "body / fluent text (floor 75, 90 preferred)" },
  { label: "muted", text: "#bab2a5", target: 60, role: "non-body UI label" },
  { label: "accent", text: "#d98a5e", target: 45, role: "accent text-on-base (large/heavy)" },
  { label: "verdict-good", text: "#7faf7a", target: 45, role: "verdict band label (large/heavy)" },
  { label: "verdict-mixed", text: "#d6a85a", target: 45, role: "verdict band label (large/heavy)" },
  { label: "verdict-bad", text: "#d4866f", target: 45, role: "verdict band label (large/heavy)" },
];

let failed = false;
console.log(`APCA contrast gate — all pairings measured on base ${BASE}\n`);
for (const p of PAIRINGS) {
  const value = lc(p.text, BASE);
  const pass = value >= p.target;
  if (!pass) failed = true;
  const verdict = pass ? "PASS" : "FAIL";
  console.log(
    `  [${verdict}] ${p.label.padEnd(14)} ${p.text} → Lc ${value.toFixed(1).padStart(5)} ` +
      `(target ≥ ${p.target}) — ${p.role}`,
  );
}

if (failed) {
  console.error(
    "\nAPCA gate FAILED — one or more pairings are below their Lc target. " +
      "Adjust the failing hex(es) in both this script and `.numen-surface` in globals.css.",
  );
  process.exit(1);
}
console.log("\nAPCA gate passed — every pairing meets its Lc target on the locked palette.");
