/**
 * The Audience part's pure modules stay pure. PURE FS test (`node`).
 *
 *   1. Every module in `src/lib/audience-next/` but the server read imports nothing from React, Next,
 *      Supabase, a repository (`-repo`), the topics builder (`@/lib/content-pillars`) or the server read
 *      itself: the model, the words and what later tasks add here are safe for the client and run on given
 *      data only. Type imports count too: a pure module names its inputs by their shape.
 *   2. No part of the screen (`src/components/audience-next/`) imports the server read: the page reads on
 *      the server and hands the result in.
 *   3. A face's initial has one rule, the model's: a copy elsewhere would drift.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { describe, expect, it } from "vitest";

const LIB = join(__dirname, "..");
const SCREEN = join(__dirname, "..", "..", "..", "components", "audience-next");
const SERVER_READ = "read-audience-page.ts";

/** The source files of a folder and its subfolders but the tests. */
function sourcesOf(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (e.isDirectory()) return e.name === "__tests__" ? [] : sourcesOf(join(dir, e.name));
    return /\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [join(dir, e.name)] : [];
  });
}

/** Every module a source names: `import … from`, `export … from`, a bare `import "…"`, `import()`, `require()`. */
function modulesOf(src: string): string[] {
  const found = src.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+|\brequire\s*\(\s*)["'`]([^"'`]+)["'`]/g);
  return [...found].map((m) => m[1]!);
}

const IMPURE: readonly RegExp[] = [
  /^react(?:-dom)?(?:\/|$)/,
  /^next(?:\/|$)/,
  /^@\/lib\/supabase(?:\/|$)/,
  /^@supabase\//,
  /-repo$/,
  /^@\/lib\/content-pillars(?:\/|$)/,
  /(?:^|\/)read-audience-page(?:\.ts)?$/,
];
const impureIn = (src: string) => modulesOf(src).filter((m) => IMPURE.some((re) => re.test(m)));
const readsServer = (src: string) => modulesOf(src).filter((m) => /(?:^|\/)read-audience-page(?:\.ts)?$/.test(m));

describe("the scan", () => {
  it("refuses samples and passes the modules a pure one may use", () => {
    const samples = [
      'import { useState } from "react";',
      'import type { ReactNode } from "react";',
      'import { redirect } from "next/navigation";',
      'import { createClient } from "@/lib/supabase/server";',
      'import type { SupabaseClient } from "@supabase/supabase-js";',
      'import { listAudiences } from "@/lib/audience/audience-repo";',
      'import type { AccountPost } from "@/lib/account-metrics/account-posts-repo";',
      'import { buildContentPillars } from "@/lib/content-pillars/build-pillars";',
      'export { readAudiencePage } from "./read-audience-page";',
      'const m = await import("@/lib/audience-next/read-audience-page");',
      'const r = require("react-dom/server");',
      'import "next/headers";',
    ];
    for (const s of samples) expect(impureIn(s), s).not.toEqual([]);
    const fine = [
      'import { ringDots } from "@/lib/result/ring-layout";',
      'import { groupAudiences } from "@/components/audience/audience-display";',
      'import type { Audience } from "@/lib/audience/audience-types";',
      'import { toneOf } from "@/lib/posted/posted";',
      'import { AUDIENCE_STRINGS } from "./audience-words";',
    ];
    for (const s of fine) expect(impureIn(s), s).toEqual([]);
  });
});

describe("rule 1: the pure modules of src/lib/audience-next", () => {
  const files = sourcesOf(LIB);

  it("finds the folder's modules (the scan is not vacuous)", () => {
    const names = files.map((f) => f.slice(LIB.length + 1));
    expect(names).toEqual(expect.arrayContaining(["audience-model.ts", "audience-words.ts", SERVER_READ]));
  });

  it("none but the server read imports React, Next, Supabase, a repository, the topics builder or the server read", () => {
    for (const file of files) {
      if (file.endsWith(`/${SERVER_READ}`)) continue;
      expect(impureIn(readFileSync(file, "utf8")), file).toEqual([]);
    }
  });
});

describe("rule 2: the screen's parts", () => {
  it("never import the server read", () => {
    for (const file of sourcesOf(SCREEN)) expect(readsServer(readFileSync(file, "utf8")), file).toEqual([]);
  });

  it("the scan looks in the right place: the screen's folder sits beside the old audience screens", () => {
    expect(existsSync(join(SCREEN, "..", "audience", "audience-display.ts"))).toBe(true);
  });
});

describe("rule 3: one rule for a face's initial", () => {
  const DEV = join(__dirname, "..", "..", "..", "app", "(app)", "dev", "audience");
  const PATTERN = String.raw`\p{L}\p{N}`;

  it("lives in the model alone: no other source of the part holds its pattern (a copy would drift)", () => {
    const sources = [...sourcesOf(LIB), ...sourcesOf(SCREEN), ...sourcesOf(DEV)];
    expect(sources.length).toBeGreaterThan(10);
    const holders = sources.filter((file) => readFileSync(file, "utf8").includes(PATTERN)).map((file) => basename(file));
    expect(holders).toEqual(["audience-model.ts"]);
  });
});
