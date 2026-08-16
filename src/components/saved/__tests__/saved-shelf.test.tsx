/** @vitest-environment happy-dom */
/**
 * saved-shelf.test.tsx — the Library rework's behavioural contract.
 *
 * `src/components/saved/__tests__/` did not exist before this lane: nothing tested SavedShelf,
 * the row, the view-model or /api/saved. That is exactly how the shipped shelf could break its own
 * sort, save duplicates, and label a remix "Hook" with a green suite.
 *
 * These assert the things a screenshot cannot: what gets POSTED, what identity a save is keyed on,
 * what order rows come out in, and which columns get reserved. Where a defect was measured in a
 * browser (alignment, reflow) the test asserts the DECISION that fixes it rather than re-measuring
 * layout in happy-dom, which has no real layout engine and would pass either way.
 */

import { describe, it, expect } from "vitest";
import {
  buildRowVM,
  FORWARD,
  PIPELINE_ORDER,
  TYPE_PLURAL,
  TYPE_LABEL,
  TYPE_ICON,
  fracNM,
} from "../saved-item-vm";
import { describeCounts } from "../saved-shelf";
import { inferProjectForThread } from "../project-picker";
import { rollUpByProject } from "@/hooks/queries/use-library-projects";
import type { SavedItem, SavedItemType } from "@/lib/shelf/shelf-repo";

// ── fixtures ────────────────────────────────────────────────────────────────
let seq = 0;
function row(over: Partial<SavedItem> = {}): SavedItem {
  seq += 1;
  return {
    id: `row-${seq}`,
    user_id: "u1",
    item_type: "hook",
    ref_id: `msg-1:${seq}`,
    thread_id: "thread-a",
    project_id: null,
    title: null,
    snapshot: {},
    created_at: `2026-07-0${(seq % 9) + 1}T10:00:00Z`,
    ...over,
  };
}

describe("the view-model reads real snapshot fields", () => {
  it("puts a hook's band on the RAIL, not on a content line", () => {
    // §R5-3 — the change the live data forced. 8 of 10 real rows carry a band, and hooks are
    // among them, so a read-only band would have been wrong about the majority of the shelf.
    const vm = buildRowVM(
      row({
        item_type: "hook",
        snapshot: {
          hookLine: "Nobody tells you the first 10k are the easy part.",
          band: "Strong",
          fraction: "9/10",
          audienceArchetype: "Contrarian",
          rank: 2,
          mechanism: "withholds the payoff",
          scrollQuote: "I need to know the hard part",
        },
      }),
    );
    expect(vm.hero).toBe("Nobody tells you the first 10k are the easy part.");
    expect(vm.metric.band).toBe("Strong");
    expect(vm.metric.fraction).toBe("9/10");
    // Strong is a QUIET tone since the Apple-grammar pass — colour marks only the band
    // that needs attention (Weak → error); the rest carry the word, not a hue.
    expect(vm.metric.bandTone).toBe("var(--color-foreground-muted)");
    // Archetype, rank, mechanism and quote belong to the EXPANSION — the row shows two facts.
    expect(vm.archetype).toBe("Contrarian");
    expect(vm.rank).toBe(2);
    expect(vm.quote).toBe("I need to know the hard part");
  });

  it("gives an idea and a script a band too — they persist one", () => {
    expect(buildRowVM(row({ item_type: "idea", snapshot: { title: "x", band: "Mixed", fraction: "5/10" } })).metric.band).toBe("Mixed");
    expect(buildRowVM(row({ item_type: "script", snapshot: { band: "Weak", fraction: "3/10" }, title: "s" })).metric.band).toBe("Weak");
  });

  it("reads a Read's Lever from the LEAD audience, not the top level", () => {
    const vm = buildRowVM(
      row({
        item_type: "read",
        snapshot: {
          audiences: [
            {
              name: "Sleep-deprived founders",
              lever: "Cut the intro",
              band: "Strong",
              fraction: "8/10",
              interpretation: "the pain IS the hook",
              personas: [{ quote: "finally someone gets it" }],
            },
          ],
        },
      }),
    );
    expect(vm.heroPrefix).toBe("Lever →");
    expect(vm.hero).toBe("Cut the intro");
    expect(vm.metric.fraction).toBe("8/10");
    expect(vm.archetype).toBe("Sleep-deprived founders");
    expect(vm.quote).toBe("finally someone gets it");
  });

  it("keeps an outlier MEASURED — a multiplier, never a band", () => {
    const vm = buildRowVM(
      row({
        item_type: "outlier",
        snapshot: { caption: "60s pantry restock", multiplier: 14.2, baselineLabel: "baseline", views: 210_000, durationSeconds: 62, coverUrl: "https://cdn/x.jpg" },
      }),
    );
    expect(vm.metric.measured).toBe("14× baseline");
    expect(vm.metric.band).toBeUndefined(); // measured ≠ simulated
    expect(vm.coverDuration).toBe("1:02");
    expect(vm.coverUrl).toBe("https://cdn/x.jpg");
  });

  it("never bares a multiplier without its baseline label (D-05 honesty)", () => {
    const vm = buildRowVM(row({ item_type: "outlier", snapshot: { caption: "c", multiplier: 3.5, baselineLabel: "vs your median" } }));
    expect(vm.metric.measured).toBe("3.5× vs your median");
  });

  it("strips the stray trailing token from a stored fraction", () => {
    // Real stored values include "7/10 stop", which rendered as "7/10 stop stopped".
    expect(fracNM("7/10 stop")).toBe("7/10");
  });

  it("falls back to a title, never a crash, for a legacy `format` row", () => {
    // `format` left the union but 0 rows exist; a legacy row must still render.
    const vm = buildRowVM(row({ item_type: "format" as SavedItemType, title: "legacy" }));
    expect(vm.hero).toBe("legacy");
    expect(vm.metric.band).toBeUndefined();
  });
});

describe("remix is its own type", () => {
  it("has a label, an icon and its own forward step", () => {
    // It saved as item_type "hook" until 2026-08-02, so the shelf called a remix a Hook and
    // offered it "Write script →".
    expect(TYPE_LABEL.remix).toBe("Remix");
    expect(TYPE_ICON.remix).toBeDefined();
    expect(FORWARD.remix?.label).toBe("Write hooks for this");
    expect(FORWARD.hook?.label).toBe("Write script");
  });

  it("reads an adapted hook line off the remix snapshot", () => {
    expect(buildRowVM(row({ item_type: "remix", snapshot: { adaptedHook: "my version" } })).hero).toBe("my version");
  });
});

describe("no forward action is invented", () => {
  it("gives read, script and outlier NO endpoint", () => {
    // The shipped map fell through to a generic "Use in thread →" that pushed /home and ignored
    // the row's own thread_id — a button that looked like a deep link and was not one.
    expect(FORWARD.read).toBeUndefined();
    expect(FORWARD.script).toBeUndefined();
    expect(FORWARD.outlier).toBeUndefined();
  });

  it("only ever points at endpoints that exist", () => {
    for (const entry of Object.values(FORWARD)) {
      expect(entry!.endpoint).toMatch(/^\/api\/tools\//);
    }
  });
});

describe("pipeline order is the project's spine (§R5-7)", () => {
  it("runs found → thought → adapted → written → built → judged", () => {
    expect([...PIPELINE_ORDER]).toEqual(["outlier", "idea", "remix", "hook", "script", "read"]);
  });

  it("covers every live item type, so no type can vanish from a project", () => {
    const types: SavedItemType[] = ["read", "idea", "hook", "script", "outlier", "remix"];
    for (const t of types) expect(PIPELINE_ORDER).toContain(t);
    expect(PIPELINE_ORDER).toHaveLength(types.length);
  });

  it("uses ONE plural source, so the shelf and a project cannot disagree (§R5-8)", () => {
    // Rev 4 wrote "Reads" on the shelf and "READ" inside a project.
    expect(TYPE_PLURAL.read).toBe("Reads");
    for (const t of PIPELINE_ORDER) expect(TYPE_PLURAL[t]).toBeTruthy();
  });
});

describe("project counts", () => {
  it("describes a project in pipeline order, singularising ones", () => {
    expect(describeCounts({ hook: 2, script: 1, read: 1 })).toBe("2 hooks · 1 script · 1 read");
    expect(describeCounts({ read: 1, outlier: 2 })).toBe("2 outliers · 1 read");
  });

  it("omits types with no items rather than printing a zero", () => {
    expect(describeCounts({ hook: 3 })).toBe("3 hooks");
    expect(describeCounts({})).toBe("");
  });

  it("rolls items up by project, counting DISTINCT source threads", () => {
    // The project subtitle claims "N items from M threads"; M must be distinct, not a row count.
    const rollups = rollUpByProject([
      row({ project_id: "p1", thread_id: "t1", item_type: "hook" }),
      row({ project_id: "p1", thread_id: "t1", item_type: "hook" }),
      row({ project_id: "p1", thread_id: "t2", item_type: "script" }),
      row({ project_id: null, thread_id: "t3", item_type: "idea" }),
    ]);
    expect(rollups.p1!.total).toBe(3);
    expect(rollups.p1!.threadCount).toBe(2);
    expect(rollups.p1!.byType).toEqual({ hook: 2, script: 1 });
    // NULL project_id is the Unfiled shelf, under a key that cannot collide with a uuid.
    expect(rollups.unfiled!.total).toBe(1);
  });

  it("counts a thread-less legacy row without inventing a thread", () => {
    const rollups = rollUpByProject([row({ project_id: "p1", thread_id: null })]);
    expect(rollups.p1!.total).toBe(1);
    expect(rollups.p1!.threadCount).toBe(0);
  });
});

describe("the save destination is INFERRED from the thread, never remembered", () => {
  it("defaults to the project this thread already feeds", () => {
    const items = [
      row({ thread_id: "thread-x", project_id: "p-launch", created_at: "2026-07-01T00:00:00Z" }),
      row({ thread_id: "thread-y", project_id: "p-other", created_at: "2026-07-09T00:00:00Z" }),
    ];
    expect(inferProjectForThread(items, "thread-x")).toBe("p-launch");
  });

  it("takes the NEWEST filing when a thread has fed two projects", () => {
    const items = [
      row({ thread_id: "t", project_id: "p-old", created_at: "2026-07-01T00:00:00Z" }),
      row({ thread_id: "t", project_id: "p-new", created_at: "2026-07-08T00:00:00Z" }),
    ];
    expect(inferProjectForThread(items, "t")).toBe("p-new");
  });

  it("infers nothing from an unfiled thread — and nothing at all without a thread", () => {
    // "Last used" was the alternative and is wrong: it would silently file a hook into a project
    // touched weeks ago. No inference must mean Unfiled, not a stale guess.
    expect(inferProjectForThread([row({ thread_id: "t", project_id: null })], "t")).toBeNull();
    expect(inferProjectForThread([row({ project_id: "p" })], null)).toBeNull();
    expect(inferProjectForThread([row({ project_id: "p" })], undefined)).toBeNull();
  });
});
