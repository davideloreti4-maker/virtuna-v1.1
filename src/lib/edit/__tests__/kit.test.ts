/**
 * kit.test.ts — the lists in kit.ts and the files in public/edit-kit/v1 say the same thing.
 *
 * A wipe named in kit.ts with no page behind it would compile to a film that fails only at
 * render time, on the worker. This fails here instead.
 */
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { FONTS, KIT, SFX, WIPES } from "../kit";

const kit = fileURLToPath(new URL(`../../../../public/edit-kit/${KIT}/`, import.meta.url));

describe(`the kit (${KIT})`, () => {
  it("holds a page for every wipe", () => {
    for (const id of Object.keys(WIPES)) expect(existsSync(`${kit}wipes/${id}.html`), id).toBe(true);
  });

  it("holds a file for every sound effect and every font", () => {
    for (const name of SFX) expect(existsSync(`${kit}sfx/${name}.m4a`), name).toBe(true);
    for (const font of Object.values(FONTS)) expect(existsSync(`${kit}${font.file}`), font.file).toBe(true);
  });

  it("has a text page that is a film page reading the clip's variables", () => {
    const page = readFileSync(`${kit}text.html`, "utf8");
    expect(page).toContain("window.film =");
    expect(page).toContain("frameReadsOverrides: true");
    expect(page).toContain('id="t"');
  });

  it("says where its files came from", () => {
    expect(readFileSync(`${kit}NOTICE.md`, "utf8")).toMatch(/CC0/);
  });
});
