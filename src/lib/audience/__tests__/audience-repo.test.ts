/**
 * Phase 7 Plan 02 — audience-repo CRUD + virtual General/preset constants (AUD-01).
 *
 * RED phase: these tests will fail until audience-repo.ts is implemented.
 *
 * Assertions:
 *  - GENERAL_AUDIENCE is a valid virtual Audience constant (is_general=true, sentinel id)
 *  - PRESET_AUDIENCES has exactly 2 entries (is_preset=true, growth/conversion-leaning)
 *  - listAudiences returns [GENERAL_AUDIENCE, ...PRESET_AUDIENCES, ...userRows] order
 *  - getAudience('general') resolves without a DB hit
 *  - getAudience(preset sentinel id) resolves without a DB hit
 *  - createAudience maps to audiences row + never reads user_id from input
 *  - updateAudience maps to audiences row + never reads user_id from input
 *  - deleteAudience calls .delete().eq('id', ...) correctly
 */

import { describe, it, expect, vi } from "vitest";
import type { Audience } from "../audience-types";

// ─── Mocks ────────────────────────────────────────────────────────────────────

// Supabase client mock: returns empty data by default; tests override per-case.
function makeSupabaseMock(overrides: Record<string, unknown> = {}) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    order: vi.fn().mockReturnThis(),
    ...overrides,
  };
  return {
    from: vi.fn().mockReturnValue(chain),
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "test-user-id" } },
        error: null,
      }),
    },
    _chain: chain,
  };
}

// ─── Imports (deferred until after mock setup) ────────────────────────────────
// We import the module under test after the mock is configured so that
// the module-level constants are resolvable.

import {
  GENERAL_AUDIENCE,
  PRESET_AUDIENCES,
  listAudiences,
  getAudience,
  createAudience,
  updateAudience,
  upsertProfileAudience,
  deleteAudience,
} from "../audience-repo";

// ─── Constants shape tests ────────────────────────────────────────────────────

describe("GENERAL_AUDIENCE — virtual constant (is_general=true)", () => {
  it("has is_general=true", () => {
    expect(GENERAL_AUDIENCE.is_general).toBe(true);
  });

  it("has is_preset=false", () => {
    expect(GENERAL_AUDIENCE.is_preset).toBe(false);
  });

  it("has a stable sentinel id ('general')", () => {
    expect(GENERAL_AUDIENCE.id).toBe("general");
  });

  it("has the DEFAULT mix (fyp=0.65, niche=0.20, loyalist=0.10, cross_niche=0.05)", () => {
    expect(GENERAL_AUDIENCE.persona_weights.fyp).toBeCloseTo(0.65, 4);
    expect(GENERAL_AUDIENCE.persona_weights.niche).toBeCloseTo(0.20, 4);
    expect(GENERAL_AUDIENCE.persona_weights.loyalist).toBeCloseTo(0.10, 4);
    expect(GENERAL_AUDIENCE.persona_weights.cross_niche).toBeCloseTo(0.05, 4);
  });

  it("has name 'General'", () => {
    expect(GENERAL_AUDIENCE.name).toBe("General");
  });

  it("has a valid Audience shape (all required fields present)", () => {
    expect(typeof GENERAL_AUDIENCE.id).toBe("string");
    expect(typeof GENERAL_AUDIENCE.name).toBe("string");
    expect(typeof GENERAL_AUDIENCE.user_id).toBe("string");
    expect(GENERAL_AUDIENCE.personas).toBeInstanceOf(Array);
  });
});

describe("PRESET_AUDIENCES — exactly 2 virtual preset constants", () => {
  it("has exactly 2 entries", () => {
    expect(PRESET_AUDIENCES).toHaveLength(2);
  });

  it("all presets have is_preset=true", () => {
    for (const p of PRESET_AUDIENCES) {
      expect(p.is_preset).toBe(true);
    }
  });

  it("all presets have is_general=false", () => {
    for (const p of PRESET_AUDIENCES) {
      expect(p.is_general).toBe(false);
    }
  });

  it("presets have distinct stable ids (not 'general')", () => {
    const ids = PRESET_AUDIENCES.map((p) => p.id);
    expect(new Set(ids).size).toBe(2);
    for (const id of ids) {
      expect(id).not.toBe("general");
      expect(typeof id).toBe("string");
      expect(id.length).toBeGreaterThan(0);
    }
  });

  it("first preset (growth-leaning) uses biasForGoalIntent('grow') weights", () => {
    // growth-leaning preset should have goal_intent='grow'
    const growPreset = PRESET_AUDIENCES[0]!;
    expect(growPreset.goal_intent).toBe("grow");
  });

  it("second preset (conversion-leaning) uses biasForGoalIntent('sell') weights", () => {
    // conversion-leaning preset should have goal_intent='sell'
    const sellPreset = PRESET_AUDIENCES[1]!;
    expect(sellPreset.goal_intent).toBe("sell");
  });

  it("growth preset persona_weights match biasForGoalIntent('grow')", async () => {
    const { biasForGoalIntent } = await import("../goal-intent");
    const growBias = biasForGoalIntent("grow");
    const growPreset = PRESET_AUDIENCES[0]!;
    expect(growPreset.persona_weights.fyp).toBeCloseTo(growBias.fyp, 4);
    expect(growPreset.persona_weights.niche).toBeCloseTo(growBias.niche, 4);
    expect(growPreset.persona_weights.loyalist).toBeCloseTo(growBias.loyalist, 4);
    expect(growPreset.persona_weights.cross_niche).toBeCloseTo(growBias.cross_niche, 4);
  });

  it("conversion preset persona_weights match biasForGoalIntent('sell')", async () => {
    const { biasForGoalIntent } = await import("../goal-intent");
    const sellBias = biasForGoalIntent("sell");
    const sellPreset = PRESET_AUDIENCES[1]!;
    expect(sellPreset.persona_weights.fyp).toBeCloseTo(sellBias.fyp, 4);
    expect(sellPreset.persona_weights.niche).toBeCloseTo(sellBias.niche, 4);
    expect(sellPreset.persona_weights.loyalist).toBeCloseTo(sellBias.loyalist, 4);
    expect(sellPreset.persona_weights.cross_niche).toBeCloseTo(sellBias.cross_niche, 4);
  });
});

// ─── listAudiences ────────────────────────────────────────────────────────────

describe("listAudiences — virtual-first ordering", () => {
  it("returns [GENERAL, ...PRESETS, ...userRows] order", async () => {
    const userRow: Audience = {
      id: "db-row-id",
      user_id: "test-user-id",
      name: "My TikTok Fans",
      type: "target",
      platform: "tiktok",
      goal_label: "Grow on TikTok",
      goal_intent: "grow",
      is_general: false,
      is_preset: false,
      mode: "socials",
      persona_weights: { fyp: 0.65, niche: 0.20, loyalist: 0.10, cross_niche: 0.05 },
      personas: [],
      profile: null,
      calibration: null,
      created_at: "2026-06-18T00:00:00Z",
      updated_at: "2026-06-18T00:00:00Z",
    };

    const sb = makeSupabaseMock();
    // The list query returns a resolved promise with the DB row
    sb._chain.order.mockResolvedValue({ data: [rowToDb(userRow)], error: null });

    const result = await listAudiences(sb as unknown as Parameters<typeof listAudiences>[0]);

    expect(result[0]!.id).toBe("general"); // GENERAL first
    expect(result[1]!.id).toBe(PRESET_AUDIENCES[0]!.id); // growth preset second
    expect(result[2]!.id).toBe(PRESET_AUDIENCES[1]!.id); // conversion preset third
    expect(result[3]!.id).toBe("template-analyst"); // General templates (03-04 / D-08)
    expect(result[4]!.id).toBe("template-hiring");
    expect(result[5]!.id).toBe("db-row-id"); // DB row last
    expect(result).toHaveLength(6);
  });

  it("returns [GENERAL, ...PRESETS, ...GENERAL_TEMPLATES] when DB returns empty", async () => {
    const sb = makeSupabaseMock();
    sb._chain.order.mockResolvedValue({ data: [], error: null });

    const result = await listAudiences(sb as unknown as Parameters<typeof listAudiences>[0]);
    expect(result).toHaveLength(5); // GENERAL + 2 presets + 2 General templates (03-04)
    expect(result[0]!.id).toBe("general");
  });

  it("queries from 'audiences' table", async () => {
    const sb = makeSupabaseMock();
    sb._chain.order.mockResolvedValue({ data: [], error: null });

    await listAudiences(sb as unknown as Parameters<typeof listAudiences>[0]);
    expect(sb.from).toHaveBeenCalledWith("audiences");
  });
});

// ─── getAudience ──────────────────────────────────────────────────────────────

describe("getAudience — virtual constant short-circuit", () => {
  it("getAudience('general') returns GENERAL_AUDIENCE without a DB query", async () => {
    const sb = makeSupabaseMock();

    const result = await getAudience(
      sb as unknown as Parameters<typeof getAudience>[0],
      "general",
    );

    expect(result).toBe(GENERAL_AUDIENCE);
    expect(sb.from).not.toHaveBeenCalled();
  });

  it("getAudience(preset-id) returns the preset constant without a DB query", async () => {
    const sb = makeSupabaseMock();
    const presetId = PRESET_AUDIENCES[0]!.id;

    const result = await getAudience(
      sb as unknown as Parameters<typeof getAudience>[0],
      presetId,
    );

    expect(result).toBe(PRESET_AUDIENCES[0]);
    expect(sb.from).not.toHaveBeenCalled();
  });

  it("getAudience(non-sentinel-id) hits the DB", async () => {
    const userRow: Audience = {
      id: "real-db-id",
      user_id: "test-user-id",
      name: "My audience",
      type: "target",
      platform: "tiktok",
      goal_label: null,
      goal_intent: null,
      is_general: false,
      is_preset: false,
      mode: "socials",
      persona_weights: { fyp: 0.65, niche: 0.20, loyalist: 0.10, cross_niche: 0.05 },
      personas: [],
      profile: null,
      calibration: null,
      created_at: "2026-06-18T00:00:00Z",
      updated_at: "2026-06-18T00:00:00Z",
    };

    const sb = makeSupabaseMock();
    sb._chain.single.mockResolvedValue({ data: rowToDb(userRow), error: null });

    const result = await getAudience(
      sb as unknown as Parameters<typeof getAudience>[0],
      "real-db-id",
    );

    expect(sb.from).toHaveBeenCalledWith("audiences");
    expect(result?.id).toBe("real-db-id");
  });
});

// ─── createAudience / updateAudience — user_id trust ─────────────────────────

describe("createAudience — never trusts user_id from input", () => {
  it("calls .from('audiences').insert(...) with derived user_id from session (not input)", async () => {
    const input: Omit<Audience, "id" | "user_id" | "created_at" | "updated_at"> & {
      user_id?: string;
    } = {
      name: "Growth Audience",
      type: "target",
      platform: "tiktok",
      goal_label: "Grow fast",
      goal_intent: "grow",
      is_general: false,
      is_preset: false,
      mode: "socials",
      persona_weights: { fyp: 0.75, niche: 0.15, loyalist: 0.05, cross_niche: 0.05 },
      personas: [],
      profile: null,
      calibration: null,
      user_id: "ATTACKER-ID", // this must be IGNORED
    };

    const sb = makeSupabaseMock();
    sb._chain.select.mockReturnThis();
    sb._chain.single.mockResolvedValue({
      data: {
        id: "new-id",
        user_id: "test-user-id",
        name: input.name,
        type: input.type,
        platform: input.platform,
        goal_label: input.goal_label,
        goal_intent: input.goal_intent,
        is_general: input.is_general,
        is_preset: input.is_preset,
        fyp: 0.75,
        niche: 0.15,
        loyalist: 0.05,
        cross_niche: 0.05,
        personas: [],
        profile: null,
        calibration: null,
        created_at: "2026-06-18T00:00:00Z",
        updated_at: "2026-06-18T00:00:00Z",
      },
      error: null,
    });

    await createAudience(sb as unknown as Parameters<typeof createAudience>[0], input as Audience);

    // Check that the insert call used session user_id (test-user-id), NOT attacker id
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const insertCall = (sb._chain.insert.mock.calls[0] as any[])[0] as Record<string, unknown>;
    expect(insertCall["user_id"]).toBe("test-user-id");
    expect(insertCall["user_id"]).not.toBe("ATTACKER-ID");
  });

  it("calls .from('audiences')", async () => {
    const input: Partial<Audience> = {
      name: "Test",
      type: "target",
      platform: "tiktok",
      goal_label: null,
      goal_intent: "grow",
      is_general: false,
      is_preset: false,
      persona_weights: { fyp: 0.75, niche: 0.15, loyalist: 0.05, cross_niche: 0.05 },
      personas: [],
      profile: null,
      calibration: null,
    };

    const sb = makeSupabaseMock();
    sb._chain.select.mockReturnThis();
    sb._chain.single.mockResolvedValue({ data: null, error: { message: "test" } });

    try {
      await createAudience(sb as unknown as Parameters<typeof createAudience>[0], input as Audience);
    } catch { /* expected error */ }

    expect(sb.from).toHaveBeenCalledWith("audiences");
  });
});

describe("updateAudience — never trusts user_id from input", () => {
  it("calls .from('audiences').update(...).eq('id', ...) without trusting input user_id", async () => {
    const update: Partial<Audience> & { id: string; user_id?: string } = {
      id: "existing-id",
      name: "Updated Name",
      user_id: "ATTACKER-ID", // must be ignored
    };

    const sb = makeSupabaseMock();
    sb._chain.select.mockReturnThis();
    sb._chain.single.mockResolvedValue({
      data: {
        id: "existing-id",
        user_id: "test-user-id",
        name: "Updated Name",
        type: "target",
        platform: "tiktok",
        goal_label: null,
        goal_intent: null,
        is_general: false,
        is_preset: false,
        fyp: 0.65,
        niche: 0.20,
        loyalist: 0.10,
        cross_niche: 0.05,
        personas: [],
        profile: null,
        calibration: null,
        created_at: "2026-06-18T00:00:00Z",
        updated_at: "2026-06-18T00:00:00Z",
      },
      error: null,
    });

    await updateAudience(
      sb as unknown as Parameters<typeof updateAudience>[0],
      update.id,
      update as Partial<Audience>,
    );

    // update payload must NOT include user_id from input
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateCall = (sb._chain.update.mock.calls[0] as any[])[0] as Record<string, unknown>;
    expect(updateCall["user_id"]).toBeUndefined();

    // Must target by id
    expect(sb._chain.eq).toHaveBeenCalledWith("id", "existing-id");
    expect(sb.from).toHaveBeenCalledWith("audiences");

    // Must stamp updated_at — no DB trigger exists, so a silent repo skips it and the
    // row lies about its freshness forever (a re-bake at 10:02 still read 08:26 live,
    // 2026-07-17).
    expect(typeof updateCall["updated_at"]).toBe("string");
    const age = Date.now() - new Date(updateCall["updated_at"] as string).getTime();
    expect(age).toBeGreaterThanOrEqual(0);
    expect(age).toBeLessThan(60_000);
  });
});

// ─── deleteAudience ────────────────────────────────────────────────────────────

describe("deleteAudience — calls .from('audiences').delete().eq('id', ...)", () => {
  it("calls delete on the audiences table with the correct id", async () => {
    const sb = makeSupabaseMock();
    sb._chain.eq.mockResolvedValue({ error: null });

    await deleteAudience(sb as unknown as Parameters<typeof deleteAudience>[0], "audience-to-delete");

    expect(sb.from).toHaveBeenCalledWith("audiences");
    expect(sb._chain.delete).toHaveBeenCalled();
    expect(sb._chain.eq).toHaveBeenCalledWith("id", "audience-to-delete");
  });
});

// ─── upsertProfileAudience — re-profile dedup (refine lane) ─────────────────────

describe("upsertProfileAudience — dedup re-profiled General SIMs by name", () => {
  const generalRow: Audience = {
    id: "db-marcus-1",
    user_id: "test-user-id",
    name: "Marcus Reyes",
    type: "target",
    platform: "custom",
    goal_label: null,
    goal_intent: null,
    is_general: false,
    is_preset: false,
    mode: "general",
    persona_weights: { fyp: 0.65, niche: 0.2, loyalist: 0.1, cross_niche: 0.05 },
    personas: [],
    profile: null,
    calibration: null,
    created_at: "2026-06-18T00:00:00Z",
    updated_at: "2026-06-18T00:00:00Z",
  };

  const profileInput: Partial<Audience> = {
    name: "Marcus Reyes",
    type: "target",
    platform: "custom",
    mode: "general",
    persona_weights: { fyp: 0.65, niche: 0.2, loyalist: 0.1, cross_niche: 0.05 },
    personas: [],
  };

  it("UPDATES an existing same-name General audience in place (no duplicate insert)", async () => {
    const sb = makeSupabaseMock();
    sb._chain.order.mockResolvedValue({ data: [rowToDb(generalRow)], error: null });
    sb._chain.single.mockResolvedValue({ data: rowToDb(generalRow), error: null });

    await upsertProfileAudience(
      sb as unknown as Parameters<typeof upsertProfileAudience>[0],
      profileInput,
    );

    expect(sb._chain.update).toHaveBeenCalled();
    expect(sb._chain.eq).toHaveBeenCalledWith("id", "db-marcus-1");
    expect(sb._chain.insert).not.toHaveBeenCalled();
  });

  it("matches case-insensitively (a re-profile with different casing still updates)", async () => {
    const sb = makeSupabaseMock();
    sb._chain.order.mockResolvedValue({ data: [rowToDb(generalRow)], error: null });
    sb._chain.single.mockResolvedValue({ data: rowToDb(generalRow), error: null });

    await upsertProfileAudience(sb as unknown as Parameters<typeof upsertProfileAudience>[0], {
      ...profileInput,
      name: "marcus reyes",
    });

    expect(sb._chain.update).toHaveBeenCalled();
    expect(sb._chain.insert).not.toHaveBeenCalled();
  });

  it("CREATES when no same-name General audience exists", async () => {
    const sb = makeSupabaseMock();
    sb._chain.order.mockResolvedValue({ data: [], error: null });
    sb._chain.single.mockResolvedValue({
      data: rowToDb({ ...generalRow, id: "new-id", name: "Someone Else" }),
      error: null,
    });

    await upsertProfileAudience(sb as unknown as Parameters<typeof upsertProfileAudience>[0], {
      ...profileInput,
      name: "Someone Else",
    });

    expect(sb._chain.insert).toHaveBeenCalled();
    expect(sb._chain.update).not.toHaveBeenCalled();
  });

  it("does NOT dedup socials-mode audiences (the guard is General-only)", async () => {
    const sb = makeSupabaseMock();
    // A same-name socials row exists, but a socials-mode save must never match it.
    sb._chain.order.mockResolvedValue({
      data: [rowToDb({ ...generalRow, mode: "socials" })],
      error: null,
    });
    sb._chain.single.mockResolvedValue({
      data: rowToDb({ ...generalRow, mode: "socials" }),
      error: null,
    });

    await upsertProfileAudience(sb as unknown as Parameters<typeof upsertProfileAudience>[0], {
      ...profileInput,
      mode: "socials",
    });

    expect(sb._chain.insert).toHaveBeenCalled();
    expect(sb._chain.update).not.toHaveBeenCalled();
  });

  it("never collides with the virtual 'General' constant (a subject named 'General' still inserts)", async () => {
    const sb = makeSupabaseMock();
    // order→[] means listAudiences still prepends the virtual GENERAL_AUDIENCE (sentinel id
    // 'general'), which the match excludes — so a real subject named "General" is created.
    sb._chain.order.mockResolvedValue({ data: [], error: null });
    sb._chain.single.mockResolvedValue({
      data: rowToDb({ ...generalRow, id: "new-id", name: "General" }),
      error: null,
    });

    await upsertProfileAudience(sb as unknown as Parameters<typeof upsertProfileAudience>[0], {
      ...profileInput,
      name: "General",
    });

    expect(sb._chain.insert).toHaveBeenCalled();
    expect(sb._chain.update).not.toHaveBeenCalled();
  });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Convert Audience domain object to the DB row shape (flat weights) */
function rowToDb(a: Audience) {
  const { persona_weights, ...rest } = a;
  return {
    ...rest,
    fyp: persona_weights.fyp,
    niche: persona_weights.niche,
    loyalist: persona_weights.loyalist,
    cross_niche: persona_weights.cross_niche,
  };
}
