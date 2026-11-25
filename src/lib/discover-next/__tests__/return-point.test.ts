/**
 * The hub's return point: left when a card opens, taken
 * once by the hub on the same address within 30 minutes. A module memory; the clock is passed in.
 */
import { beforeEach, describe, expect, it } from "vitest";

import { RETURN_POINT_MS, leaveGrid, takeGrid } from "../return-point";

const T0 = 1_800_000_000_000;
const HREF = "/feed?niche=comedy&order=jump";

beforeEach(() => {
  // Drain whatever an earlier case left.
  takeGrid("", T0);
});

describe("the return point", () => {
  it("lives 30 minutes", () => {
    expect(RETURN_POINT_MS).toBe(30 * 60 * 1000);
  });

  it("is taken once, on the same address", () => {
    leaveGrid({ href: HREF, shown: 48, top: 1320 }, T0);
    expect(takeGrid(HREF, T0 + 1_000)).toEqual({ shown: 48, top: 1320 });
    expect(takeGrid(HREF, T0 + 2_000)).toBeNull();
  });

  it("another address does not take it, and drops it: a later visit never lands on a stale point", () => {
    leaveGrid({ href: HREF, shown: 48, top: 1320 }, T0);
    expect(takeGrid("/feed", T0 + 1_000)).toBeNull();
    expect(takeGrid(HREF, T0 + 2_000)).toBeNull();
  });

  it("within 30 minutes, not after 31", () => {
    leaveGrid({ href: HREF, shown: 24, top: 600 }, T0);
    expect(takeGrid(HREF, T0 + RETURN_POINT_MS)).toEqual({ shown: 24, top: 600 });

    leaveGrid({ href: HREF, shown: 24, top: 600 }, T0);
    expect(takeGrid(HREF, T0 + 31 * 60 * 1000)).toBeNull();
  });

  it("a second card opened replaces the first point", () => {
    leaveGrid({ href: HREF, shown: 24, top: 600 }, T0);
    leaveGrid({ href: "/feed", shown: 72, top: 4000 }, T0 + 5_000);
    expect(takeGrid("/feed", T0 + 6_000)).toEqual({ shown: 72, top: 4000 });
  });

  it("nothing left: nothing taken", () => {
    expect(takeGrid(HREF, T0)).toBeNull();
  });

  it("reads the real clock when none is passed", () => {
    leaveGrid({ href: HREF, shown: 24, top: 10 });
    expect(takeGrid(HREF)).toEqual({ shown: 24, top: 10 });
  });
});
