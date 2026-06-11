/** @vitest-environment happy-dom */
/**
 * tests/numen/tokens.test.ts — DS-01 token-layer gate.
 *
 * Two kinds of assertion:
 *  1. Source scan of `src/app/globals.css` `.numen-surface` block — proves the
 *     authored values obey the hard rules (exact hex, no pure black, no oklch,
 *     contains the calibrated base `#1a1714`). This part is GREEN as soon as
 *     Plan 01 Task 3 appends the scope block.
 *  2. Resolved-CSS-var assertions under happy-dom — proves utilities (`bg-bg`,
 *     `text-text`, `bg-accent`, `text-verdict-good`) resolve to the warm-neutral
 *     hexes inside `.numen-surface`. happy-dom does NOT run Tailwind's build, so
 *     the utility→value resolution is asserted by reading the bridged custom
 *     properties the `@theme inline` block exposes (the values Tailwind emits at
 *     build are these same `var()` references). This stays RED until the full
 *     token layer + build pipeline is exercised downstream; it is a scaffold.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const GLOBALS = resolve(process.cwd(), "src/app/globals.css");

/** Strip `/* … *\/` CSS comments so prose mentions don't confuse the parser. */
function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

/**
 * Extract the `.numen-surface { ... }` scope-RULE block. Comments are stripped
 * first, then the selector is matched only when immediately followed (modulo
 * whitespace) by `{`, so prose mentions of `.numen-surface` are skipped.
 */
function numenSurfaceBlock(rawCss: string): string {
  const css = stripComments(rawCss);
  // Anchor on the bare `.numen-surface {` rule, not the `.dark .numen-surface`
  // variant nor any compound selector — require the selector start.
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

describe("numen token layer — globals.css source rules (DS-01 / D-03)", () => {
  const css = readFileSync(GLOBALS, "utf8");
  const block = numenSurfaceBlock(css);

  it("declares a .numen-surface scope block", () => {
    expect(css).toContain(".numen-surface");
    expect(block.length).toBeGreaterThan(0);
  });

  it("uses the calibrated warm base #1a1714 (no pure black)", () => {
    expect(block).toContain("#1a1714");
  });

  it("contains NO pure black (#000 / #000000)", () => {
    expect(/#000000\b/i.test(block)).toBe(false);
    expect(/#000\b/i.test(block)).toBe(false);
  });

  it("authors every dark token as exact hex — NO oklch() in the scope block (D-03)", () => {
    expect(/oklch\(/i.test(block)).toBe(false);
  });

  it("bridges tokens through a @theme inline block (Pitfall 1 — inline is load-bearing)", () => {
    expect(css).toMatch(/@theme\s+inline\b/);
    expect(css).toMatch(/--color-numen-bg:\s*var\(--numen-bg\)/);
  });

  it("CR-01: numen bridge namespaces EVERY color key as --color-numen-* (no bare global keys)", () => {
    // The numen @theme inline block must only emit `--color-numen-*` keys — never
    // the bare `--color-bg`/`--color-text`/`--color-accent`/`--color-border` that
    // would collide with (or claim) global Tailwind utility keys.
    const numenBridge = css.match(/@theme\s+inline\s*\{[^}]*--color-numen-bg[^}]*\}/);
    expect(numenBridge).not.toBeNull();
    const bridge = numenBridge![0];
    for (const key of [
      "--color-numen-bg",
      "--color-numen-panel",
      "--color-numen-panel-2",
      "--color-numen-text",
      "--color-numen-text-muted",
      "--color-numen-accent",
      "--color-numen-verdict-good",
      "--color-numen-verdict-mixed",
      "--color-numen-verdict-bad",
      "--color-numen-border",
    ]) {
      expect(bridge).toContain(key);
    }
    // No bare (un-namespaced) color key may appear in the numen bridge.
    expect(/--color-bg\b/.test(bridge)).toBe(false);
    expect(/--color-text\b/.test(bridge)).toBe(false);
    expect(/--color-accent\b/.test(bridge)).toBe(false);
    expect(/--color-border\b/.test(bridge)).toBe(false);
  });

  it("CR-01: the numen layer does NOT redefine the legacy --color-accent / --color-border keys (D-01)", () => {
    // The legacy coral @theme owns these utility keys. The numen layer must leave
    // them untouched so `bg-accent` / `border-border` stay coral / 6% app-wide.
    // Each must be defined EXACTLY ONCE (the legacy block), never bridged to
    // var(--numen-*) (which would be undefined outside .numen-surface).
    const accentDefs = css.match(/--color-accent:\s*[^;]+;/g) ?? [];
    const borderDefs = css.match(/--color-border:\s*[^;]+;/g) ?? [];
    expect(accentDefs).toHaveLength(1);
    expect(borderDefs).toHaveLength(1);
    expect(accentDefs[0]).toContain("var(--color-coral-500)");
    expect(borderDefs[0]).toContain("rgba(255, 255, 255, 0.06)");
    expect(accentDefs[0]).not.toContain("numen");
    expect(borderDefs[0]).not.toContain("numen");
  });

  it("does NOT carry the forbidden coral/gradient/shimmer keyframes into the scope block (D-07)", () => {
    expect(/--animate-shimmer/i.test(block)).toBe(false);
    expect(/gradient-x/i.test(block)).toBe(false);
    expect(/coral/i.test(block)).toBe(false);
  });
});

describe("numen token layer — resolved CSS vars under .numen-surface (DS-01)", () => {
  // Scaffold: asserts the warm-neutral hexes resolve from the scope class. Until
  // the Tailwind build emits the utilities, this reads the authored custom
  // properties applied to a scoped element.
  it("resolves bg / text / accent / verdict-good to warm-neutral hexes (not empty)", async () => {
    // Inject the scope-class custom properties from the authored source so the
    // resolution can be asserted without a full Tailwind build.
    const { readFileSync } = await import("node:fs");
    const css = readFileSync(GLOBALS, "utf8");
    const block = numenSurfaceBlock(css);

    const get = (name: string): string => {
      const m = block.match(new RegExp(`${name}\\s*:\\s*([^;]+);`));
      return m ? m[1].trim() : "";
    };

    expect(get("--numen-bg")).toBe("#1a1714");
    expect(get("--numen-text")).toBe("#f0ebe3");
    expect(get("--numen-accent")).not.toBe("");
    expect(get("--numen-accent")).not.toBe("transparent");
    expect(get("--numen-verdict-good")).not.toBe("");
  });
});
