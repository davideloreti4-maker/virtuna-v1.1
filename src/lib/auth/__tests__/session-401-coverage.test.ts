import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * A DRIFT GUARD, not a behaviour test.
 *
 * Every client fetch site that can be refused for a spent allowance can equally be refused for a
 * dead session, and a site that stops reporting the 401 does not fail — it renders the generic
 * "the generation or SIM-1 pass dropped out" again, which is the exact defect this lane removes.
 *
 * ⚠️ THE KEY IS THE ROUTE, NOT THE CLIENT. This guard used to enumerate the files that call
 * `reportCredit402` and demand a matching 401 check in each. That set looks identical to "the paid
 * run paths" and is not: `use-analysis-stream.ts` handles ITS 402 through local `quotaError` state
 * feeding the composer's own `ReadingLimitDialog` mount, so it makes zero `reportCredit402` calls
 * — and was therefore invisible to the guard while owning the priciest fetch in the product. It
 * shipped with no 401 check and nothing failed.
 *
 * That blind spot was RECORDED BEFORE the guard was written. The offline half hit it first and
 * rewrote its own guard (`every-stream-classifies.test.ts`) to read the DIRECTORY because of it;
 * this guard was then keyed off the call-site list anyway and inherited the identical hole. So the
 * question a guard must answer is never "which files already do the thing" — that is a tautology
 * that can only ever confirm what is already there. It is "which files are OBLIGED to do the
 * thing", derived from something the client cannot silently opt out of.
 *
 * Here that something is the ROUTE: a route that runs the credit gate is a paid run, whatever the
 * client does about it. So the set is computed by resolving each client fetch URL to its route
 * file and asking the route.
 *
 * ⚠️ COUNTED BY LISTING, never by piping a filtered `grep` into `wc -l`. Deriving this set with a
 * shell pipeline got the count wrong twice in opposite directions while the spec was being
 * written: first 37 (it counted the definition file and prose comments), then 14 — a `grep -vE`
 * meant to drop comment-only lines silently ate six real call sites carrying a trailing comment.
 * A filter that removes signal is indistinguishable from a smaller codebase. So this reads files.
 */

const SRC = join(process.cwd(), "src");
const APP_API = join(SRC, "app", "api");

/** The two definition files legitimately name their own functions. */
const DEFINITIONS = ["lib/billing/credit-wall.ts", "lib/auth/session-expired.ts"];

/**
 * A paid route is one that runs the credit gate. Both spellings are load-bearing: most routes call
 * `creditGate`, `api/analyze` calls `getCreditQuotaVerdict` directly because it prices two modes
 * as one Reading.
 */
const PAID_ROUTE = /\bcreditGate\(|\bgetCreditQuotaVerdict\(/;

/**
 * How far below a `fetch(` the 401 check may sit. The widest real one is 35 lines
 * (`AmbientOverviewRail.tsx`, which reads the body and branches before refusing), so 60 is
 * headroom rather than a fudge — it exists so a site cannot pass by having some OTHER fetch's
 * `reportSession401` counted for it, which per-file counting could not tell apart.
 */
const WINDOW = 60;

/**
 * THE RATCHET. Three paid sites still have no 401 check, each needing its own copy decision rather
 * than the one-line hook fix — a bare `catch`, a bespoke error string, and a dead hook with no
 * consumers. They are named here so the guard can be honest about them, and asserted as an EXACT
 * SET below: fixing one FAILS this guard until it is removed from the list, and adding a fourth
 * fails it too. The list can only shrink.
 *
 * `app/(app)/feed/discover/discover-client.tsx` came off the list on 2026-08-14: both its fetches
 * now report. See the ⚠️ below for what that fix exposed about this guard's own reach.
 */
const KNOWN_GAPS = [
  "components/app/home/home-starter.tsx",
  "components/audience-lens/PersonaChatDrawer.tsx",
  "hooks/queries/use-analyze.ts",
];

/**
 * Fetch URLs built from a template expression that is not a whole path segment, so they cannot be
 * resolved to a route file. Neither is a paid route. Pinned as a CEILING (a subset check) so that
 * a new computed URL cannot become a place for a paid fetch site to hide from this guard.
 */
const UNRESOLVABLE = [
  "components/dev/dev-mock-panel.tsx",
  "hooks/queries/use-saved-items.ts",
];

/**
 * ⚠️ KNOWN HOLE, MEASURED 2026-08-14 — this guard only sees a fetch whose URL is a STRING LITERAL.
 *
 * The regex below requires `/api/` inside quotes or backticks. Ten client sites instead read their
 * URL out of the CHAIN_HANDOFFS registry (`fetch(handoff.endpoint, …)`), and every one of them is
 * invisible here — not counted in SITES, not pushed to UNRESOLVED, not policed at all.
 *
 * That is not hypothetical. THREE of those sites were found swallowing their refusals outright —
 * `components/discover/use-remix-launch.ts`, `app/(app)/feed/discover/discover-client.tsx` and
 * `components/thread/account-read-block.tsx` all pushed to /home on a 402 and a 401 alike — and
 * this file passed green through all three. `discover-client` appeared in KNOWN_GAPS only by
 * accident: it happens to ALSO hold a literal `fetch("/api/discover")`, and its registry-indirected
 * remix POST beside it was never the thing being tracked.
 *
 * So the top-of-file lesson has a second half. Keying off the ROUTE fixed "which files already do
 * the thing"; it did not fix "which fetches this parser can SEE". A guard is bounded by its reader,
 * and a reader that silently skips a call shape reports full coverage of the subset it understands.
 *
 * Closing it means resolving `handoffsFor(x).find(h => h.to === y)` to an endpoint through
 * `chain-handoff.ts`. NOT done here: seven of the ten sites are outside this lane and each needs
 * its own copy decision, exactly like the KNOWN_GAPS above. Recorded rather than silently left.
 */
function sourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "__tests__" || entry.name === "_dormant" || entry.name === "__mocks__") {
        continue;
      }
      sourceFiles(full, acc);
    } else if (/\.tsx?$/.test(entry.name)) {
      acc.push(full);
    }
  }
  return acc;
}

/**
 * ⚠️ COMMENTS ARE STRIPPED BEFORE COUNTING, and that is not a nicety.
 *
 * The bogus "37 call sites" in the first draft of the spec came from counting prose that merely
 * NAMED the function. An earlier version of this guard reproduced the same error on its first run:
 * `use-chat-stream.ts` carries a comment explaining why its `reportCredit402(402, quota)` is not a
 * response status, and the guard read that sentence as a second call site and demanded a second
 * 401 check for it. Counting source means counting code.
 *
 * ⚠️ LINE NUMBERS ARE PRESERVED — a block comment is blanked character-by-character rather than
 * deleted. The proximity check above measures a distance in lines, and the previous version of
 * this helper collapsed multi-line comments to nothing. Deleting them would have shifted every
 * line below a docstring upward and quietly made the window wider than it reads.
 */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .split("\n")
    .map((line) => {
      // `[^:]` keeps a `https://` URL from being read as a line comment.
      const found = line.search(/(^|[^:])\/\//);
      return found === -1 ? line : line.slice(0, line.indexOf("//", found));
    })
    .join("\n");
}

/** Resolve an `/api/...` URL to its route file, mapping a `${...}` segment onto the `[param]` dir. */
function routeFileFor(apiPath: string): string | null {
  let dir = join(SRC, "app");
  for (const seg of apiPath.split("/").filter(Boolean)) {
    if (seg.includes("${")) {
      // A template that is only PART of a segment (`/api/saved${qs}`) is not a dynamic segment.
      if (!/^\$\{[^}]*\}$/.test(seg)) return null;
      const dyn = readdirSync(dir, { withFileTypes: true }).find(
        (e) => e.isDirectory() && e.name.startsWith("["),
      );
      if (!dyn) return null;
      dir = join(dir, dyn.name);
    } else {
      if (!existsSync(join(dir, seg))) return null;
      dir = join(dir, seg);
    }
  }
  const route = join(dir, "route.ts");
  return existsSync(route) ? route : null;
}

const PAID_ROUTES = new Set(
  sourceFiles(APP_API).filter(
    (f) => f.endsWith("route.ts") && PAID_ROUTE.test(readFileSync(f, "utf8")),
  ),
);

type Site = { rel: string; line: number; url: string; covered: boolean };

const SITES: Site[] = [];
const UNRESOLVED: string[] = [];
/** Retained from the previous key — see the `reportCredit402` describe block below. */
const CREDIT_FILES: { rel: string; credit: number; session: number }[] = [];

for (const file of sourceFiles(SRC)) {
  if (file.startsWith(APP_API)) continue; // the route handlers themselves
  const rel = file.slice(SRC.length + 1);
  if (DEFINITIONS.includes(rel)) continue;

  const lines = stripComments(readFileSync(file, "utf8")).split("\n");
  const src = lines.join("\n");

  const credit = src.split("reportCredit402(").length - 1;
  if (credit > 0) {
    CREDIT_FILES.push({ rel, credit, session: src.split("reportSession401(").length - 1 });
  }

  lines.forEach((line, i) => {
    const m = /(?:fetch|new EventSource)\(\s*[`"']([^`"']*\/api\/[^`"'?]*)/.exec(line);
    if (!m?.[1]) return;
    const url = m[1].replace(/^.*?\/api\//, "/api/");
    const route = routeFileFor(url);
    if (!route) {
      UNRESOLVED.push(rel);
      return;
    }
    if (!PAID_ROUTES.has(route)) return;
    const covered = lines
      .slice(i, i + WINDOW)
      .some((l) => l.includes("reportSession401("));
    SITES.push({ rel, line: i + 1, url, covered });
  });
}

const GAP_FILES = [...new Set(SITES.filter((s) => !s.covered).map((s) => s.rel))].sort();

describe("the guard is measuring something", () => {
  /**
   * Without these the whole file passes vacuously the day someone renames `creditGate` or the
   * fetch regex stops matching: zero paid routes means zero sites to check, and an empty gap list
   * reads as full coverage.
   */
  it("still finds the paid routes", () => {
    expect(PAID_ROUTES.size, "no routes run the credit gate — this guard measures nothing").toBeGreaterThanOrEqual(16);
  });

  it("still finds the paid client fetch sites", () => {
    expect(SITES.length, "the paid fetch sites vanished — check the fetch regex").toBeGreaterThanOrEqual(23);
  });

  it("still finds the sites that DO check the 401", () => {
    const covered = SITES.filter((s) => s.covered).length;
    expect(covered, "no site reports a 401 — reportSession401 may have been renamed").toBeGreaterThanOrEqual(19);
  });

  /** A URL this guard cannot resolve is a site it cannot police. New ones must be looked at. */
  it("resolves every client /api/ fetch to a route, bar the pinned few", () => {
    const surprises = [...new Set(UNRESOLVED)].filter((f) => !UNRESOLVABLE.includes(f)).sort();
    expect(surprises, `unresolvable /api/ fetch URLs in: ${surprises.join(", ")}`).toEqual([]);
  });
});

describe("every paid fetch site checks for the dead session", () => {
  /**
   * Per-SITE, not per-file. `composer.tsx` holds three separate paid fetches among seventeen
   * fetches overall; one 401 check in the file leaves two of them still dying into the generic
   * copy, and a file-level count cannot see that.
   */
  it("has no unreported paid site outside the known gaps", () => {
    const missing = SITES.filter((s) => !s.covered && !KNOWN_GAPS.includes(s.rel)).map(
      (s) => `${s.rel}:${s.line} (${s.url})`,
    );
    expect(missing, `these hit a paid route and never check for a 401: ${missing.join(", ")}`).toEqual([]);
  });

  /**
   * THE RATCHET, asserted as an exact set rather than a count. A gap that gets fixed must be
   * deleted from `KNOWN_GAPS` or this fails — so the list cannot rot into an allowlist that
   * quietly grants permission to sites which no longer need it.
   */
  it("has exactly the known gaps — no more, and no stale entries", () => {
    expect(GAP_FILES).toEqual([...KNOWN_GAPS].sort());
  });
});

/**
 * THE OLD KEY, KEPT AS A SECOND RAIL — and explicitly NOT sufficient on its own.
 *
 * It is cheap, it is independent of the route resolver above, and it covers files whose fetch URL
 * that resolver cannot see. It is retained rather than deleted because deleting it would lose the
 * only in-repo record of what it failed to catch; the comment at the top of this file is that
 * record, and this block is what it refers to.
 */
describe("the credit-402 sites also handle the 401 (necessary, never sufficient)", () => {
  it("is measuring something — the credit-wall sites still exist", () => {
    const sites = CREDIT_FILES.reduce((n, f) => n + f.credit, 0);
    expect(CREDIT_FILES.length, "no reportCredit402 files found — this rail measures nothing").toBeGreaterThanOrEqual(14);
    expect(sites, "the 20 known credit call sites vanished").toBeGreaterThanOrEqual(20);
  });

  it("every file that handles the credit 402 also handles the 401", () => {
    const missing = CREDIT_FILES.filter((f) => f.session === 0).map((f) => f.rel);
    expect(missing, `these handle a 402 but not a 401: ${missing.join(", ")}`).toEqual([]);
  });

  it("covers every credit call site, not merely every file", () => {
    const short = CREDIT_FILES.filter((f) => f.session < f.credit).map(
      (f) => `${f.rel} (${f.credit} credit, ${f.session} session)`,
    );
    expect(short, `fewer 401 checks than 402 checks in: ${short.join(", ")}`).toEqual([]);
  });
});
