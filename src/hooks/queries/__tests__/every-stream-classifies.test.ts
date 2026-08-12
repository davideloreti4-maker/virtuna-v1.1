import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * A DRIFT GUARD, not a behaviour test.
 *
 * Eight stream hooks each own a catch block. A ninth added later is covered by none of the
 * per-hook tests, and its failure mode is silent: it simply renders the generic "the generation
 * or SIM-1 pass dropped out" again — the exact defect `lib/net/run-failure.ts` exists to remove.
 * Nothing fails; the copy just quietly goes back to being wrong.
 *
 * It reads the DIRECTORY rather than a hand-maintained list, because the obvious list to derive
 * this from — the `reportCredit402` call sites — silently omits `use-analysis-stream.ts`, which
 * makes zero such calls and still owns a real error path.
 */
const DIR = join(process.cwd(), "src/hooks/queries");

describe("every stream hook resolves its failure cause", () => {
  const streams = readdirSync(DIR).filter((f) => /^use-.*-stream\.ts$/.test(f));

  it("finds the stream hooks at all — a rename must fail loudly, not vacuously pass", () => {
    // 8 today: account-read, analysis, chat, explore, hooks, ideas, remix, script.
    expect(streams.length).toBeGreaterThanOrEqual(8);
  });

  it.each(streams)("%s routes its caught errors through resolveRunError", (file) => {
    const src = readFileSync(join(DIR, file), "utf8");
    expect(src, `${file} never calls resolveRunError — its failures cannot name a cause`).toContain(
      "resolveRunError(",
    );
  });

  it.each(streams)("%s no longer hand-rolls the abort check", (file) => {
    const src = readFileSync(join(DIR, file), "utf8");
    // `use-analysis-stream` legitimately keeps its own guard: it also checks the abort SIGNAL and
    // must skip a reconnect, which is more than the shared policy knows about.
    if (file === "use-analysis-stream.ts") return;
    expect(
      /\(err as Error\)\.name === ['"]AbortError['"]/.test(src),
      `${file} still hand-rolls the abort check — two copies of one policy is how they drift`,
    ).toBe(false);
  });
});
