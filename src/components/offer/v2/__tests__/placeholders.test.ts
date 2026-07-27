import { readFileSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ALL_PLACEHOLDER_SLOTS, PLACEHOLDER_MARKER } from "../placeholders";

/**
 * The tripwire that stops a dashed box shipping to paid traffic.
 *
 * /go-v2 is a review route and placeholders are approved there. /go is the page the ads point
 * at, and a visibly unfinished section on it costs real money at a real click price. The
 * failure mode is mundane and entirely plausible: someone ports a v2 section across at cutover,
 * the real assets have not landed yet, and nobody notices because the page still "looks fine"
 * to whoever wrote it.
 *
 * So this walks the actual import graph from the production route and asserts the placeholder
 * module is not reachable from it. A grep would only catch a direct import; a page that pulls
 * in `TestimonialWall`, which pulls in `PlaceholderBox`, which pulls in `placeholders.ts`, is
 * the case that actually happens, and only a transitive walk sees it.
 */

const SRC = resolve(__dirname, "../../../..");
const EXTENSIONS = [".ts", ".tsx", ".js", ".jsx"];

/** Resolve an import specifier to a file on disk, or null for packages / unresolvable paths. */
function resolveImport(spec: string, fromFile: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = join(SRC, spec.slice(2));
  else if (spec.startsWith(".")) base = resolve(dirname(fromFile), spec);
  else return null; // node_modules — never our source

  for (const ext of ["", ...EXTENSIONS]) {
    const candidate = base + ext;
    if (existsSync(candidate) && !candidate.endsWith("/")) {
      // A bare directory match would be the folder itself; only accept real files.
      try {
        readFileSync(candidate);
        return candidate;
      } catch {
        /* it was a directory — fall through to the index forms below */
      }
    }
  }
  for (const ext of EXTENSIONS) {
    const candidate = join(base, `index${ext}`);
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

const IMPORT_RE = /(?:^|\n)\s*(?:import|export)\s[^;]*?from\s*["']([^"']+)["']/g;
const BARE_IMPORT_RE = /(?:^|\n)\s*import\s*["']([^"']+)["']/g;

/** Every source file transitively reachable from `entry`. */
function reachableFrom(entry: string): Set<string> {
  const seen = new Set<string>();
  const queue = [entry];
  while (queue.length) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    const source = readFileSync(file, "utf8");
    for (const re of [IMPORT_RE, BARE_IMPORT_RE]) {
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(source))) {
        const next = resolveImport(m[1]!, file);
        if (next && !seen.has(next)) queue.push(next);
      }
    }
  }
  return seen;
}

const PROD_ROUTE = join(SRC, "app/(offer)/go/page.tsx");
const REVIEW_ROUTE = join(SRC, "app/(offer)/go-v2/page.tsx");
const PLACEHOLDER_MODULE = join(SRC, "components/offer/v2/placeholders.ts");

describe("placeholders — reachable from the review route, never from production", () => {
  it("has both routes on disk (so a rename can't silently pass this suite)", () => {
    expect(existsSync(PROD_ROUTE)).toBe(true);
    expect(existsSync(REVIEW_ROUTE)).toBe(true);
    expect(existsSync(PLACEHOLDER_MODULE)).toBe(true);
  });

  it("does NOT reach the placeholder module from production /go", () => {
    const reachable = reachableFrom(PROD_ROUTE);
    // Named explicitly rather than as a boolean, so a failure prints the offending path.
    const offenders = [...reachable].filter((f) => f === PLACEHOLDER_MODULE);
    expect(offenders).toEqual([]);
  });

  it("does NOT leak the marker string into any file production /go imports", () => {
    // Belt and braces: the module could be inlined, re-exported, or the string copied by hand.
    // This catches the marker however it arrives.
    const offenders = [...reachableFrom(PROD_ROUTE)].filter((f) =>
      readFileSync(f, "utf8").includes(PLACEHOLDER_MARKER),
    );
    expect(offenders).toEqual([]);
  });

  it("DOES reach it from /go-v2 — otherwise this test proves nothing", () => {
    // Without this, deleting the placeholder module entirely would make the assertions above
    // pass while the guard covers nothing at all.
    expect(reachableFrom(REVIEW_ROUTE).has(PLACEHOLDER_MODULE)).toBe(true);
  });
});

describe("placeholders — never a plausible fake", () => {
  it("names no person, company, handle or metric", () => {
    // A placeholder's job is to be unmistakably empty. Anything that reads as a real
    // attribution — an @handle, a follower count, a star rating, a percentage — defeats it,
    // and on a page whose entire argument is credibility one fake poisons the real numbers.
    for (const slot of ALL_PLACEHOLDER_SLOTS) {
      const text = `${slot.label} ${slot.awaiting}`;
      expect(text, `${slot.id} must not contain an @handle`).not.toMatch(/@\w/);
      expect(text, `${slot.id} must not contain a follower/metric figure`).not.toMatch(
        /\d[\d,.]*\s*(k|m|%|★|stars?|followers?|views?)/i,
      );
    }
  });

  it("labels every slot with the asset it is still waiting for", () => {
    for (const slot of ALL_PLACEHOLDER_SLOTS) {
      expect(slot.label, `${slot.id} label`).toMatch(/^[A-Z0-9 —·-]+$/);
      expect(slot.awaiting.length, `${slot.id} awaiting`).toBeGreaterThan(8);
    }
  });
});
