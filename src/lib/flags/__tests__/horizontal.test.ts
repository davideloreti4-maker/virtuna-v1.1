import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  HORIZONTAL_ENABLED,
  HORIZONTAL_SKILL_IDS,
  isHorizontalAudience,
  filterHorizontalAudiences,
} from "../horizontal";
import { GENERAL_AUDIENCE, GENERAL_TEMPLATES } from "@/lib/audience/audience-repo";

// ─────────────────────────────────────────────────────────────────────────────
// The horizontal (GSI) is HIDDEN, not deleted (owner call 2026-07-13 — the product
// commits to the creator vertical for MVP). This gate holds two lines:
//
//   1. While the flag is off, the three verbs stay OFF in the skill catalog. Six call
//      sites surface the horizontal; a future edit only has to forget one of them.
//   2. The is_general / mode:'general' COLLISION never gets "simplified" away. The
//      baseline creator audience is named General and carries is_general:true, but it
//      is mode:'socials'. Keying the hide on is_general would hide the default audience
//      from every user and take the regression gate with it.
//
// If the horizontal comes back, flip HORIZONTAL_ENABLED — these tests follow the flag
// rather than fighting it.
// ─────────────────────────────────────────────────────────────────────────────

const SRC = join(__dirname, "..", "..", "..");

describe("horizontal flag — the trap", () => {
  it("keys on mode, never on is_general", () => {
    // The baseline creator audience: named "General", is_general TRUE — and NOT horizontal.
    expect(GENERAL_AUDIENCE.is_general).toBe(true);
    expect(GENERAL_AUDIENCE.mode).toBe("socials");
    expect(isHorizontalAudience(GENERAL_AUDIENCE)).toBe(false);
  });

  it("treats the authored Analyst/Hiring panels as horizontal", () => {
    expect(GENERAL_TEMPLATES.length).toBeGreaterThan(0);
    for (const tpl of GENERAL_TEMPLATES) {
      expect(tpl.mode).toBe("general");
      expect(isHorizontalAudience(tpl)).toBe(true);
    }
  });

  it("never filters the baseline creator audience out of a list", () => {
    const kept = filterHorizontalAudiences([GENERAL_AUDIENCE, ...GENERAL_TEMPLATES]);
    expect(kept).toContain(GENERAL_AUDIENCE);
    if (!HORIZONTAL_ENABLED) {
      expect(kept).toHaveLength(1); // the templates are gone, the baseline survives
    }
  });
});

describe("horizontal flag — the verbs stay hidden while it is off", () => {
  it("gates every horizontal skill on the flag in the SKILLS catalog", () => {
    const catalog = readFileSync(
      join(SRC, "components", "app", "home", "composer-controls.tsx"),
      "utf8",
    );
    for (const id of HORIZONTAL_SKILL_IDS) {
      // The row must exist (nothing is deleted) …
      const row = catalog
        .split("\n")
        .find((l) => l.includes(`id: "${id}"`) || l.includes(`id: "${id}",`));
      expect(row, `SKILLS row for "${id}" should still exist — hide, don't delete`).toBeTruthy();
      // … and its `enabled` must be the flag, never a hard-coded true.
      expect(
        row,
        `SKILLS row for "${id}" must be gated on HORIZONTAL_ENABLED, not enabled: true`,
      ).toMatch(/enabled:\s*HORIZONTAL_ENABLED/);
    }
  });

  it("keeps the blocks registered so persisted threads still render", () => {
    // Hiding the verbs must NOT rot thread history into `unsupported-block`.
    const registry = readFileSync(join(SRC, "lib", "tools", "block-registry.ts"), "utf8");
    for (const type of ["profile-read", "reaction-distribution", "prediction-gauge"]) {
      expect(registry, `${type} must stay registered — old threads still render it`).toContain(
        type,
      );
    }
  });
});
