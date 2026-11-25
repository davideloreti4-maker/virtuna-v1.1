/**
 * The pull intent: armed by a Pull button just before it
 * navigates, true once on the pull page for the same input within 15 seconds. An address alone never
 * carries it. A module memory; the clock is passed in.
 */
import { beforeEach, describe, expect, it } from "vitest";

import { PULL_INTENT_MS, armPull, dropPull, keepPullOnlyAt, takePull } from "../pull-intent";

const T0 = 1_800_000_000_000;

beforeEach(() => {
  // Drain whatever an earlier case left.
  takePull("", T0);
});

describe("the pull intent", () => {
  it("lives 15 seconds", () => {
    expect(PULL_INTENT_MS).toBe(15_000);
  });

  it("nothing armed: an arrival by address starts nothing", () => {
    expect(takePull("@jay.makes", T0)).toBe(false);
  });

  it("is true once, for the same input", () => {
    armPull("@jay.makes", T0);
    expect(takePull("@jay.makes", T0 + 500)).toBe(true);
    expect(takePull("@jay.makes", T0 + 600)).toBe(false);
  });

  it("the same input once trimmed", () => {
    armPull("  meal prep ", T0);
    expect(takePull("meal prep", T0 + 500)).toBe(true);
  });

  it("another input does not take it, and drops it", () => {
    armPull("@jay.makes", T0);
    expect(takePull("@nia.cooks", T0 + 500)).toBe(false);
    expect(takePull("@jay.makes", T0 + 600)).toBe(false);
  });

  it("within 15 seconds, not after 16", () => {
    armPull("@jay.makes", T0);
    expect(takePull("@jay.makes", T0 + PULL_INTENT_MS)).toBe(true);

    armPull("@jay.makes", T0);
    expect(takePull("@jay.makes", T0 + 16_000)).toBe(false);
  });

  it("a second arm replaces the first", () => {
    armPull("@jay.makes", T0);
    armPull("@dev.lifts", T0 + 100);
    expect(takePull("@dev.lifts", T0 + 200)).toBe(true);
  });

  it("an empty input is never armed", () => {
    armPull("   ", T0);
    expect(takePull("", T0 + 1)).toBe(false);
  });

  it("reads the real clock when none is passed", () => {
    armPull("@jay.makes");
    expect(takePull("@jay.makes")).toBe(true);
  });
});

describe("an intent left behind", () => {
  it("dropPull drops whatever is armed", () => {
    armPull("@jay.makes", T0);
    dropPull();
    expect(takePull("@jay.makes", T0 + 100)).toBe(false);
  });

  it("the place that armed it goes while the address is its pull page (the press's own way there): kept", () => {
    armPull("@jay.makes", T0);
    keepPullOnlyAt("/feed/discover?input=%40jay.makes");
    expect(takePull("@jay.makes", T0 + 100)).toBe(true);

    armPull("meal prep", T0);
    keepPullOnlyAt("/feed/discover?input=meal%20prep");
    expect(takePull("meal prep", T0 + 100)).toBe(true);
  });

  it.each(["/feed", "/feed?q=%40jay.makes", "/library", "/feed/discover?input=%40nia.cooks", "/feed/discover", "/feed/video/x?input=%40jay.makes"])(
    "goes anywhere else: dropped (%s)",
    (address) => {
      armPull("@jay.makes", T0);
      keepPullOnlyAt(address);
      expect(takePull("@jay.makes", T0 + 100)).toBe(false);
    },
  );

  it("nothing armed: nothing happens", () => {
    keepPullOnlyAt("/feed");
    armPull("@jay.makes", T0);
    expect(takePull("@jay.makes", T0 + 100)).toBe(true);
  });
});
