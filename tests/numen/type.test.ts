/** @vitest-environment happy-dom */
/**
 * tests/numen/type.test.ts — DS-04 sans-led + serif-voice gate.
 *
 * Asserts the type contract from the authored source (layout.tsx + globals.css):
 *  - `--font-serif` is wired via next/font/google (Source Serif 4) and bridged
 *    into `@theme inline` so the `font-serif` utility exists.
 *  - `--font-sans` stays Inter (already wired).
 *  - serif is NOT applied to `<body>` / functional elements — reserved for voice.
 *
 * The source-scan assertions go GREEN once Plan 01 Task 3 (bridge) + Task 5
 * (font wiring) land. The runtime resolution assertion is a happy-dom scaffold.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const LAYOUT = resolve(process.cwd(), "src/app/layout.tsx");
const GLOBALS = resolve(process.cwd(), "src/app/globals.css");

describe("numen type system — serif voice wiring (DS-04)", () => {
  const layout = readFileSync(LAYOUT, "utf8");
  const globals = readFileSync(GLOBALS, "utf8");

  it("wires Source Serif 4 via next/font/google", () => {
    expect(layout).toContain("Source_Serif_4");
  });

  it("declares the serif font as the --font-serif variable", () => {
    expect(layout).toMatch(/variable:\s*["'`]--font-serif["'`]/);
    expect(layout).toMatch(/serif\.variable/);
  });

  it("applies BOTH inter.variable and serif.variable on <html>", () => {
    expect(layout).toMatch(/inter\.variable/);
    expect(layout).toMatch(/serif\.variable/);
    // both must be in the same className expression on <html>
    const htmlClass = layout.match(/<html[^>]*className=\{`([^`]*)`\}/);
    expect(htmlClass).not.toBeNull();
    expect(htmlClass![1]).toContain("${inter.variable}");
    expect(htmlClass![1]).toContain("${serif.variable}");
  });

  it("keeps the functional sans (Inter) on <body>, NOT serif (sans-led contract)", () => {
    const bodyTag = layout.match(/<body[^>]*className="([^"]*)"/);
    expect(bodyTag).not.toBeNull();
    expect(bodyTag![1]).toContain("font-sans");
    expect(bodyTag![1]).not.toContain("font-serif");
  });

  it("bridges --font-serif into @theme inline so a font-serif utility exists", () => {
    expect(globals).toMatch(/--font-serif:\s*var\(--font-serif\)/);
  });
});

describe("numen type system — resolved font families (DS-04 scaffold)", () => {
  it("font-serif resolves to the --font-serif var, font-sans to the inter var", () => {
    const el = document.createElement("div");
    el.style.setProperty("--font-serif", "Source Serif 4");
    el.style.setProperty("--font-inter", "Inter");
    el.style.fontFamily = "var(--font-serif)";
    document.body.appendChild(el);
    expect(el.style.getPropertyValue("--font-serif")).toBe("Source Serif 4");
    expect(el.style.getPropertyValue("--font-inter")).toBe("Inter");
    document.body.removeChild(el);
  });
});
