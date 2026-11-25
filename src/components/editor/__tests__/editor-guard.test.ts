/**
 * editor-guard.test.ts — the editor is built from tokens only (plan 2026-11-24-editor-screens-a, Task 15; the method of
 * `src/components/result/__tests__/result-guard.test.ts`): no colour literal (but in `look-sample.tsx`, which draws the film's own
 * caption colours on the take's frame), no glass, no type size outside the role scale, and never the `shadow-float` utility
 * (it ignores the new look's re-valued token). Pure FS test.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const EDITOR = join(__dirname, "..");
const FILES = readdirSync(EDITOR, { withFileTypes: true }).filter((entry) => entry.isFile() && /\.tsx?$/.test(entry.name)).map((entry) => entry.name);
const code = (file: string) => readFileSync(join(EDITOR, file), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

describe("the editor: tokens only", () => {
  it("finds the editor's parts, the page and its header among them", () => {
    expect(FILES.length).toBeGreaterThan(15);
    expect(FILES).toEqual(expect.arrayContaining(["editor-screen.tsx", "editor-header.tsx"]));
  });

  it.each(FILES.filter((file) => file !== "look-sample.tsx"))("%s carries no colour literal", (file) => {
    const src = code(file);
    expect(src.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).toEqual([]);
    expect(src.match(/\b(rgba?|hsla?|oklch)\(/g) ?? []).toEqual([]);
  });

  it.each(FILES)("%s uses no glass, no off-scale type and no shadow-float utility", (file) => {
    const src = code(file);
    expect(/backdropFilter|backdrop-blur/i.test(src)).toBe(false);
    expect(src.match(/\btext-\[\d+(\.\d+)?(px|rem|em)\]/g) ?? []).toEqual([]);
    expect(src.match(/(?<![-\w])shadow-float\b/g) ?? []).toEqual([]);
  });
});
