/**
 * The unreachable-event ledger — which declared funnel events CANNOT fire, and why.
 *
 * THE DEFECT THIS EXISTS FOR. `demo_view 23 → demo_fix_open 0` was read as "23 people reached the
 * demo and every one of them bounced at beat 1". It is not. `demo_fix_open` is emitted only from
 * `beats.ts`, and `beats.ts` is mounted by nothing — `/go/page.tsx` is a static sales page that
 * renders `HeroShowcase` instead. The zero is a code fact wearing the costume of a user decision.
 *
 * 🔑 An absent signal has at least two causes, and "nobody did it" is the less likely one. A
 * comment saying so would drift the first time someone mounted the walkthrough. So the ledger is
 * data, and these tests check the ledger against the tree.
 *
 * WHAT WOULD MAKE EACH TEST FAIL, on purpose:
 *  - mounting the walkthrough from any route → test 2 fails, and the fix is to DELETE the entries,
 *    because the events would then be real. That is the two-way door.
 *  - adding a reachable call site for a listed event → test 1 fails on the same logic.
 *  - listing an event that already has a live call site → test 3 fails. Over-marking is the
 *    mirror-image error: it would explain away a zero that really is user behaviour.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import {
  FUNNEL_EVENTS,
  UNREACHABLE_FUNNEL_EVENTS,
  type FunnelEvent,
} from "../funnel-events";

const SRC = join(process.cwd(), "src");
const WALKTHROUGH_DIR = join("components", "offer", "walkthrough");

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "__tests__" || entry === "node_modules") continue;
      out.push(...walk(full));
    } else if (/\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

const SOURCE_FILES = walk(SRC);

/** Files that emit `track("<event>")`, excluding the declaration module itself. */
function emitters(event: FunnelEvent): string[] {
  return SOURCE_FILES.filter((f) => {
    if (f.endsWith(join("lib", "analytics", "funnel-events.ts"))) return false;
    const body = readFileSync(f, "utf8");
    return body.includes(`"${event}"`) || body.includes(`'${event}'`);
  }).map((f) => f.slice(SRC.length + 1));
}

describe("unreachable funnel events", () => {
  it("lists only events that exist", () => {
    for (const event of UNREACHABLE_FUNNEL_EVENTS) {
      expect(FUNNEL_EVENTS).toContain(event);
    }
  });

  it("every listed event is emitted ONLY from the unmounted walkthrough", () => {
    for (const event of UNREACHABLE_FUNNEL_EVENTS) {
      const sites = emitters(event);
      expect(sites.length).toBeGreaterThan(0); // a listed event with no emitter is a stale entry
      for (const site of sites) {
        expect(site.startsWith(WALKTHROUGH_DIR)).toBe(true);
      }
    }
  });

  it("no route mounts the walkthrough — which is what makes them unreachable", () => {
    const appFiles = SOURCE_FILES.filter((f) => f.startsWith(join(SRC, "app")));
    const mounts = appFiles.filter((f) =>
      readFileSync(f, "utf8").includes("offer/walkthrough")
    );

    // If this fails, the walkthrough is live: DELETE the entries from
    // UNREACHABLE_FUNNEL_EVENTS rather than loosening this assertion.
    expect(mounts).toEqual([]);
  });

  it("does not mark checkout_open — it has live call sites and its zero is real", () => {
    expect(UNREACHABLE_FUNNEL_EVENTS).not.toContain("checkout_open" as FunnelEvent);

    const sites = emitters("checkout_open");
    expect(sites.some((s) => !s.startsWith(WALKTHROUGH_DIR))).toBe(true);
  });
});
