/**
 * start-registry-drift.test.ts — the Start grid can never name a door that has no room behind it.
 *
 * `START_SKILL_GROUPS` authors the artifact-axis tiles (Content · Intel) and its `id`s are declared
 * to be "the real SKILL_RUN_META keys". Nothing enforced that. Rename a skill key — or add a tile
 * with a typo'd id — and the tile keeps rendering as an ACTIVE, clickable door that arms a runner
 * which does not exist. The failure is silent at build AND at test time; the creator finds it.
 *
 * The contract, per tile:
 *   status: "soon"  ⇒ deliberately unbuilt — INERT, must NOT resolve to a runner (that would mean
 *                     we shipped a working skill but left its door greyed out).
 *   otherwise       ⇒ must resolve in SKILL_RUN_META, so the run capsule can name its stages.
 *
 * Also pins `start-fixture.ts`, which mirrors the registry BY HAND for the `/ambient-v2` reference
 * route: a fixture that drifts from the registry makes the reference surface lie about the product.
 */

import { describe, it, expect } from "vitest";
import { START_SKILL_GROUPS } from "../ambient-v2-adapters";
import { SKILL_RUN_META } from "@/components/thread/run-capsule";
import { START_R4 } from "@/components/audience-lens/v2/start-fixture";
import type { SkillGroup } from "@/components/audience-lens/v2/AmbientStart";

const tilesOf = (groups: SkillGroup[]) => groups.flatMap((g) => g.skills);

describe("Start grid ↔ skill registry", () => {
  it("every ACTIVE tile resolves to a real SKILL_RUN_META entry", () => {
    const orphans = tilesOf(START_SKILL_GROUPS)
      .filter((s) => s.status !== "soon")
      .filter((s) => !(s.id in SKILL_RUN_META))
      .map((s) => `${s.label} (id: ${s.id})`);

    expect(orphans).toEqual([]);
  });

  it('every "soon" tile is genuinely unbuilt — a shipped skill must not be left behind a greyed door', () => {
    const wronglyInert = tilesOf(START_SKILL_GROUPS)
      .filter((s) => s.status === "soon")
      .filter((s) => s.id in SKILL_RUN_META)
      .map((s) => `${s.label} (id: ${s.id})`);

    expect(wronglyInert).toEqual([]);
  });

  it("no duplicate tile ids across the artifact groups", () => {
    const ids = tilesOf(START_SKILL_GROUPS).map((s) => s.id);
    expect(ids).toHaveLength(new Set(ids).size);
  });

  it("the hand-mirrored start fixture matches the registry tile-for-tile", () => {
    const shape = (groups: SkillGroup[]) =>
      groups.map((g) => ({
        label: g.label,
        skills: g.skills.map((s) => ({ id: s.id, label: s.label, status: s.status ?? "active" })),
      }));

    expect(shape(START_R4.skillGroups)).toEqual(shape(START_SKILL_GROUPS));
  });
});
