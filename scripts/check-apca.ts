/**
 * scripts/check-apca.ts — Dev-only APCA contrast gate (DS-02 / DS-03 / D-12).
 *
 * Validates each Numen warm-neutral pairing against its APCA Lc target on the
 * calibrated base `#1a1714`. APCA (Accessible Perceptual Contrast Algorithm,
 * WCAG 3 draft) is the correct perceptual metric for dark mode — WCAG 2 ratios
 * mislead on dark backgrounds.
 *
 * Run: `pnpm tsx scripts/check-apca.ts`  (also wired into `pnpm test` via
 * tests/numen/apca.test.ts so CI runs the gate — see WR-05).
 * Exits non-zero on ANY failing pairing so it is a real pass/fail gate.
 *
 * Source: github.com/Myndex/apca-w3 (W3C reference impl). `calcAPCA(text, bg)`
 * accepts hex strings directly and performs the canonical
 * `APCAcontrast(sRGBtoY(...), sRGBtoY(...))` pipeline.
 *
 * WR-05: the palette hexes are PARSED out of `.numen-surface` in globals.css —
 * NOT hand-duplicated here. globals.css is the single source of truth; a drift
 * there is impossible to miss because this gate reads the same values.
 */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck -- apca-w3 ships no type declarations
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { calcAPCA } from "apca-w3";

const GLOBALS = resolve(process.cwd(), "src/app/globals.css");

/** Strip CSS comments so prose mentions of hexes don't confuse the parser. */
function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

/** Extract the bare `.numen-surface { ... }` rule body (comments stripped). */
function numenSurfaceBlock(rawCss: string): string {
  const css = stripComments(rawCss);
  const ruleRe = /(^|[\s}])\.numen-surface\s*\{/g;
  const match = ruleRe.exec(css);
  if (!match) return "";
  const open = css.indexOf("{", match.index);
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}") {
      depth--;
      if (depth === 0) return css.slice(open + 1, i);
    }
  }
  return "";
}

/** Read a single `--name: value;` declaration out of the scope block. */
function tokenValue(block: string, name: string): string {
  const m = block.match(new RegExp(`${name}\\s*:\\s*([^;]+);`));
  return m ? m[1].trim() : "";
}

/** Absolute APCA Lc for `textHex` on `bgHex` (abs because dark-mode polarity). */
function lc(textHex: string, bgHex: string): number {
  return Math.abs(calcAPCA(textHex, bgHex) as number);
}

interface Pairing {
  label: string;
  /** `.numen-surface` custom property whose value supplies the text hex. */
  token: string;
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
  { label: "body", token: "--numen-text", target: 75, role: "body / fluent text (floor 75, 90 preferred)" },
  { label: "muted", token: "--numen-text-muted", target: 60, role: "non-body UI label" },
  { label: "accent", token: "--numen-accent", target: 45, role: "accent text-on-base (large/heavy)" },
  { label: "verdict-good", token: "--numen-verdict-good", target: 45, role: "verdict band label (large/heavy)" },
  { label: "verdict-mixed", token: "--numen-verdict-mixed", target: 45, role: "verdict band label (large/heavy)" },
  { label: "verdict-bad", token: "--numen-verdict-bad", target: 45, role: "verdict band label (large/heavy)" },
];

export interface ApcaResult {
  label: string;
  hex: string;
  lc: number;
  target: number;
  role: string;
  pass: boolean;
}

export interface ApcaGateReport {
  base: string;
  results: ApcaResult[];
  passed: boolean;
}

/**
 * Run the APCA gate against the LIVE `.numen-surface` hexes in globals.css.
 * Pure (no process exit / logging) so it is unit-testable; the CLI wrapper at
 * the bottom handles logging + `process.exit`.
 */
export function runApcaGate(cssPath: string = GLOBALS): ApcaGateReport {
  const block = numenSurfaceBlock(readFileSync(cssPath, "utf8"));
  const base = tokenValue(block, "--numen-bg");
  if (!base) {
    throw new Error("check-apca: could not parse --numen-bg from .numen-surface");
  }

  const results: ApcaResult[] = PAIRINGS.map((p) => {
    const hex = tokenValue(block, p.token);
    if (!hex) {
      throw new Error(`check-apca: could not parse ${p.token} from .numen-surface`);
    }
    const value = lc(hex, base);
    return {
      label: p.label,
      hex,
      lc: value,
      target: p.target,
      role: p.role,
      pass: value >= p.target,
    };
  });

  return { base, results, passed: results.every((r) => r.pass) };
}

// CLI entrypoint — run the gate, log each pairing, exit non-zero on any failure.
// Guarded so `import`ing this module (the vitest gate) does NOT exit the process.
function isCliRun(): boolean {
  const entry = process.argv[1] ?? "";
  return entry.includes("check-apca");
}

if (isCliRun()) {
  const report = runApcaGate();
  console.log(`APCA contrast gate — all pairings measured on base ${report.base}\n`);
  for (const r of report.results) {
    const verdict = r.pass ? "PASS" : "FAIL";
    console.log(
      `  [${verdict}] ${r.label.padEnd(14)} ${r.hex} → Lc ${r.lc.toFixed(1).padStart(5)} ` +
        `(target ≥ ${r.target}) — ${r.role}`,
    );
  }
  if (!report.passed) {
    console.error(
      "\nAPCA gate FAILED — one or more pairings are below their Lc target. " +
        "Adjust the failing hex(es) in `.numen-surface` in globals.css.",
    );
    process.exit(1);
  }
  console.log("\nAPCA gate passed — every pairing meets its Lc target on the locked palette.");
}
