"use client";

/**
 * AmbientStartHome — the Ambient Audience v2 Start surface (④), mounted as the composer's EMPTY-home
 * hero (parallel-run behind `AMBIENT_V2_ENABLED`; the legacy greeting + field are the default).
 *
 * Fed real inputs: the creator's first name (`useProfile`) + the active `Audience` (→ `AudienceMeta`,
 * whose signature personas ARE the segments). The skill menu is real SKILL_RUN_META ids. The two
 * handlers route into the composer's OWN run path — a skill tile arms the tool, the composer row
 * seeds + fires it — so Start drives real generation, not a mock.
 *
 * Build spec: docs/HANDOFF-2026-07-22-ambient-v2-wiring-provenance-audit.md
 */

import { AmbientStart } from "./AmbientStart";
import { buildStartData } from "@/lib/surfaces/ambient-v2-adapters";
import { audienceToMeta } from "@/lib/surfaces/ambient-v2-audience-meta";
import type { Audience } from "@/lib/audience/audience-types";
import { useProfile } from "@/hooks/queries/use-profile";

export function AmbientStartHome({
  audience,
  onSkill,
  onSubmit,
  onScene,
  onFidelity,
  activeSkillId,
}: {
  audience: Audience;
  /** Arm a skill by its SKILL_RUN_META id (the composer's tool picker). */
  onSkill: (skillId: string) => void;
  /** Seed the field + fire the armed skill (the composer's auto-run). */
  onSubmit: (text: string) => void;
  onScene?: (scene: string) => void;
  onFidelity?: (fidelity: string) => void;
  /** The composer's active tool → highlights the armed skill tile + primes the composer row. */
  activeSkillId?: string;
}) {
  const { data: profile } = useProfile();
  const name = profile?.name?.trim().split(/\s+/)[0] || "";
  const data = buildStartData({ name, audience: audienceToMeta(audience) });

  return (
    <div className="flex w-full justify-center">
      <AmbientStart
        data={data}
        onSkill={onSkill}
        onSubmit={onSubmit}
        onScene={onScene}
        onFidelity={onFidelity}
        activeSkillId={activeSkillId}
      />
    </div>
  );
}
