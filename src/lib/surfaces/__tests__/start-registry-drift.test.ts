/**
 * start-registry-drift.test.ts — the Start grid can never name a door that has no room behind it.
 *
 * `START_SKILL_GROUPS` authors the artifact-axis tiles (Content · Intel). Rename a skill — or add a
 * tile with a typo'd id — and the tile keeps rendering as an ACTIVE, clickable door that arms a
 * skill which does not exist. Silent at build time, because the composer used to CAST the id
 * (`id as ToolId`); silent at test time too, for the reason below.
 *
 * ⚠️ This suite asserted the WRONG REGISTRY until 2026-07-27, and that is why it was green while
 * the Ideas tile was broken. It checked `SKILL_RUN_META`, the run-capsule's DISPLAY namespace,
 * which spells the Ideas skill `ideas` (plural). But a tile id is never looked up there — nothing
 * in the app indexes SKILL_RUN_META by tile id; every consumer uses a literal key or the stream's
 * own dispatch `skillKey`. A tile id has exactly two consumers, both in the ToolId namespace:
 *   AmbientStart `onSkill(sk.id)` → composer `pickStartSkill` → the armed tool
 *   AmbientStart `active={sk.id === activeSkillId}` → compared against `activeTool`
 * ToolId spells that same skill `idea`, SINGULAR. So `{ id: "ideas" }` satisfied the old assertion
 * perfectly while arming a tool no `handleSubmit` branch matched — and handleSubmit's final else is
 * the paid SIM-1 Max video Test, so the Ideas tile ran a video Test off a pasted URL (F-017).
 * A drift test pointed at the wrong SSOT does not just miss the bug; it certifies it.
 *
 * The contract, per tile — stated against SKILLS (`composer-controls.tsx`), the ToolId SSOT:
 *   status: "soon"  ⇒ deliberately unbuilt — must NOT resolve to an ENABLED skill (that would mean
 *                     we shipped a working skill but left its door greyed out). It may name an
 *                     artifact with no ToolId at all (`compare`), or one that exists but is
 *                     switched off (`ad`, enabled:false).
 *   otherwise       ⇒ must resolve to an ENABLED skill, so the click arms a door that opens.
 *
 * Also pins `start-fixture.ts`, which mirrors the registry BY HAND for the `/ambient-v2` reference
 * route: a fixture that drifts from the registry makes the reference surface lie about the product.
 */

import { describe, it, expect } from "vitest";
import { START_SKILL_GROUPS } from "../ambient-v2-adapters";
import { SKILLS } from "@/components/app/home/composer-controls";
import { START_R4 } from "@/components/audience-lens/v2/start-fixture";
import type { SkillGroup } from "@/components/audience-lens/v2/AmbientStart";

const tilesOf = (groups: SkillGroup[]) => groups.flatMap((g) => g.skills);
const skillFor = (id: string) => SKILLS.find((s) => s.id === id);

describe("Start grid ↔ skill registry", () => {
  it("every ACTIVE tile arms a real, enabled skill — a tile id IS a ToolId", () => {
    const orphans = tilesOf(START_SKILL_GROUPS)
      .filter((s) => s.status !== "soon")
      .filter((s) => !skillFor(s.id)?.enabled)
      .map((s) => `${s.label} (id: ${s.id})`);

    expect(orphans).toEqual([]);
  });

  it("the Ideas tile arms `idea`, not the SKILL_RUN_META spelling `ideas` (F-017)", () => {
    // Named explicitly because the generic assertion above reads as satisfied by ANY correct id,
    // and this is the one that cost a creator a paid Max run from a control labelled Ideas.
    const ideas = tilesOf(START_SKILL_GROUPS).find((s) => s.label === "Ideas");
    expect(ideas?.id).toBe("idea");
  });

  it('every "soon" tile is genuinely unrunnable — a shipped skill must not be left behind a greyed door', () => {
    const wronglyInert = tilesOf(START_SKILL_GROUPS)
      .filter((s) => s.status === "soon")
      .filter((s) => skillFor(s.id)?.enabled)
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
