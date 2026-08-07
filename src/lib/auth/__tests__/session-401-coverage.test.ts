import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * A DRIFT GUARD, not a behaviour test.
 *
 * Every fetch site that can be refused for credit can equally be refused for a dead session — they
 * are the same set by construction: the paid run paths. The two lists drifting apart is invisible,
 * because a 401 site that stops reporting does not fail. It renders the generic engine copy again,
 * which is the exact defect this lane removes.
 *
 * ⚠️ COUNTED BY LISTING, never by piping a filtered `grep` into `wc -l`. Deriving this set with a
 * shell pipeline got the count wrong twice in opposite directions while the spec was being
 * written: first 37 (it counted the definition file and prose comments), then 14 — a `grep -vE
 * "// "` meant to drop comment-only lines silently ate six real call sites carrying a trailing
 * `// wall dialog if it's the credit 402`. A filter that removes signal is indistinguishable from
 * a smaller codebase. So this reads files and counts occurrences.
 */

const SRC = join(process.cwd(), "src");

/** The two definition files legitimately name their own functions. */
const DEFINITIONS = ["lib/billing/credit-wall.ts", "lib/auth/session-expired.ts"];

function sourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "__tests__" || entry.name === "_dormant" || entry.name === "__mocks__") {
        continue;
      }
      sourceFiles(full, acc);
    } else if (/\.tsx?$/.test(entry.name)) {
      const rel = full.slice(SRC.length + 1);
      if (!DEFINITIONS.includes(rel)) acc.push(rel);
    }
  }
  return acc;
}

/**
 * ⚠️ COMMENTS ARE STRIPPED BEFORE COUNTING, and that is not a nicety.
 *
 * The bogus "37 call sites" in the first draft of the spec came from counting prose that merely
 * NAMED the function. This guard reproduced the same error on its first run: `use-chat-stream.ts`
 * carries a comment explaining why its `reportCredit402(402, quota)` is not a response status, and
 * the guard read that sentence as a second call site and demanded a second 401 check for it.
 * Counting source means counting code.
 */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((line) => {
      // `[^:]` keeps a `https://` URL from being read as a line comment.
      const found = line.search(/(^|[^:])\/\//);
      return found === -1 ? line : line.slice(0, line.indexOf("//", found));
    })
    .join("\n");
}

const occurrences = (src: string, fn: string) => src.split(`${fn}(`).length - 1;

const FILES = sourceFiles(SRC).map((rel) => {
  const src = stripComments(readFileSync(join(SRC, rel), "utf8"));
  return { rel, credit: occurrences(src, "reportCredit402"), session: occurrences(src, "reportSession401") };
});

const CREDIT_FILES = FILES.filter((f) => f.credit > 0);

describe("the two refusal sets stay in step", () => {
  /**
   * Without this the whole guard passes vacuously the day someone renames `reportCredit402`:
   * zero credit files means zero files to check, and an empty miss list reads as full coverage.
   */
  it("is measuring something — the credit-wall sites still exist", () => {
    const sites = CREDIT_FILES.reduce((n, f) => n + f.credit, 0);
    expect(CREDIT_FILES.length, "no reportCredit402 files found — this guard measures nothing").toBeGreaterThanOrEqual(14);
    expect(sites, "the 20 known credit call sites vanished").toBeGreaterThanOrEqual(20);
  });

  it("every file that handles the credit 402 also handles the 401", () => {
    const missing = CREDIT_FILES.filter((f) => f.session === 0).map((f) => f.rel);
    expect(missing, `these handle a 402 but not a 401: ${missing.join(", ")}`).toEqual([]);
  });

  /**
   * Per-SITE, not per-file. `composer.tsx` and `input-request-block.tsx` each hold three separate
   * refusable fetches; one 401 check in the file leaves two of them still dying into the generic
   * copy, and a file-level guard cannot see that.
   */
  it("covers every call site, not merely every file", () => {
    const short = CREDIT_FILES.filter((f) => f.session < f.credit).map(
      (f) => `${f.rel} (${f.credit} credit, ${f.session} session)`,
    );
    expect(short, `fewer 401 checks than 402 checks in: ${short.join(", ")}`).toEqual([]);
  });
});
