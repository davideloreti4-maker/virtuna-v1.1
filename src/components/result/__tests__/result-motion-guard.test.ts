import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// ─────────────────────────────────────────────────────────────────────────────
// The result page's motion: every animation it names is one of its own `result-` keyframes, defined
// in globals.css outside `@theme`, and every one is behind `motion-safe:`, so with reduced motion
// nothing moves by itself. PURE FS test (default `node` env).
// ─────────────────────────────────────────────────────────────────────────────

const RESULT = join(__dirname, "..");
const CSS = readFileSync(join(__dirname, "../../../app/globals.css"), "utf8");
const FILES = readdirSync(RESULT, { withFileTypes: true })
  .filter((e) => e.isFile() && /\.tsx?$/.test(e.name))
  .map((e) => e.name);
const source = (file: string) => readFileSync(join(RESULT, file), "utf8");

/** The block that starts at `opener` (its braces matched), or "" when there is none. */
function block(css: string, opener: string): string {
  const start = css.indexOf(opener);
  if (start < 0) return "";
  let depth = 0;
  for (let i = css.indexOf("{", start); i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}" && --depth === 0) return css.slice(start, i + 1);
  }
  return css.slice(start);
}

const named = new Set(FILES.flatMap((file) => [...source(file).matchAll(/animate-\[(result-[a-z-]+)_/g)].map((m) => m[1]!)));

describe("result page: motion", () => {
  it("names its own keyframes (guards against a walker that matches nothing)", () => {
    expect(named.size).toBeGreaterThan(0);
  });

  it.each([...named])("%s is defined in globals.css, outside @theme", (name) => {
    expect(block(CSS, `@keyframes ${name} {`)).not.toBe("");
    expect(block(CSS, "@theme {")).not.toContain(`@keyframes ${name}`);
  });

  it.each(FILES)("%s: every animation and animation delay is motion-safe", (file) => {
    const src = source(file);
    for (const m of src.matchAll(/(\S*)animate-\[/g)) expect(m[1]).toMatch(/motion-safe:$/);
    for (const m of src.matchAll(/(\S*)\[animation-delay:/g)) expect(m[1]).toMatch(/motion-safe:$/);
  });

  it("the landing moves opacity and the line's stroke only: no transform, no filter", () => {
    const properties = (name: string) =>
      [...block(CSS, `@keyframes ${name} {`).matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1]);
    expect(new Set(properties("result-fade"))).toEqual(new Set(["opacity"]));
    expect(new Set(properties("result-draw"))).toEqual(new Set(["stroke-dashoffset"]));
  });
});
