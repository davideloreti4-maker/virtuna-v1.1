/**
 * Phase 3 Plan 04 — audience-repo mode/success_criterion/custom_context seam + GENERAL_TEMPLATES.
 *
 * Locks the repo round-trip of the new domain fields (POP-01/POP-03/POP-04) and the two
 * zero-setup General template virtual constants (analyst + hiring, D-08). Mock-first —
 * mirrors audience-repo.test.ts / signature-determinism.test.ts; zero live DB.
 *
 * Test runner (CRITICAL repo quirk): run via
 *   node ./node_modules/vitest/vitest.mjs run src/lib/audience/__tests__/audience-repo-mode.test.ts
 * NEVER `npm test` / `npx vitest` — they emit fake PASS(0)/FAIL(0).
 */

import { describe, it, expect, vi } from "vitest";
import type { Audience } from "../audience-types";
import {
  GENERAL_AUDIENCE,
  PRESET_AUDIENCES,
  GENERAL_TEMPLATES,
  WritableAudienceSchema,
  rowToAudience,
  audienceToRow,
  createAudience,
  updateAudience,
  deleteAudience,
} from "../audience-repo";

// ─── Mocks ────────────────────────────────────────────────────────────────────

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

// ─── (a) round-trip: mode / success_criterion / custom_context ────────────────

describe("rowToAudience ↔ audienceToRow — new fields round-trip losslessly", () => {
  it("preserves mode, success_criterion, and custom_context through both mappers", () => {
    const row = {
      id: "db-general-1",
      user_id: "test-user-id",
      name: "My General SIM",
      type: "target",
      platform: "custom",
      goal_label: null,
      goal_intent: null,
      mode: "general",
      success_criterion: "Surfaces the sharpest risk in the argument",
      custom_context: [
        { source: "user", note: "Audience skews senior IC engineers" },
      ],
      is_general: false,
      is_preset: false,
      fyp: 0.65,
      niche: 0.2,
      loyalist: 0.1,
      cross_niche: 0.05,
      personas: [],
      profile: null,
      calibration: null,
      creator_persona: null,
      signature: null,
      created_at: "2026-06-27T00:00:00Z",
      updated_at: "2026-06-27T00:00:00Z",
    };

    const audience = rowToAudience(row as never);
    expect(audience.mode).toBe("general");
    expect(audience.success_criterion).toBe("Surfaces the sharpest risk in the argument");
    expect(audience.custom_context).toEqual([
      { source: "user", note: "Audience skews senior IC engineers" },
    ]);

    const back = audienceToRow(audience, "test-user-id");
    expect(back.mode).toBe("general");
    expect(back.success_criterion).toBe("Surfaces the sharpest risk in the argument");
    expect(back.custom_context).toEqual([
      { source: "user", note: "Audience skews senior IC engineers" },
    ]);
  });

  it("maps a null success_criterion and an absent custom_context to null/[]", () => {
    const row = {
      id: "db-socials-1",
      user_id: "test-user-id",
      name: "Socials",
      type: "target",
      platform: "tiktok",
      goal_label: null,
      goal_intent: null,
      mode: "socials",
      success_criterion: null,
      custom_context: null,
      is_general: false,
      is_preset: false,
      fyp: 0.65,
      niche: 0.2,
      loyalist: 0.1,
      cross_niche: 0.05,
      personas: [],
      profile: null,
      calibration: null,
      creator_persona: null,
      signature: null,
      created_at: "2026-06-27T00:00:00Z",
      updated_at: "2026-06-27T00:00:00Z",
    };

    const audience = rowToAudience(row as never);
    expect(audience.mode).toBe("socials");
    expect(audience.success_criterion).toBeNull();
    expect(audience.custom_context).toEqual([]);
  });
});

// ─── (b) WritableAudienceSchema — caps free-text ──────────────────────────────

describe("WritableAudienceSchema — validates + caps the new fields", () => {
  const base = {
    name: "X",
    type: "target",
    platform: "custom",
  } as const;

  it("accepts a valid mode + success_criterion + custom_context", () => {
    const parsed = WritableAudienceSchema.safeParse({
      ...base,
      mode: "general",
      success_criterion: "Flags the biggest gap",
      custom_context: [
        { source: "user", note: "Hiring panel for a staff role", persona_evidence_link: "skeptic" },
      ],
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects a custom_context note over 2000 chars", () => {
    const parsed = WritableAudienceSchema.safeParse({
      ...base,
      custom_context: [{ source: "user", note: "a".repeat(2001) }],
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects a success_criterion over 2000 chars", () => {
    const parsed = WritableAudienceSchema.safeParse({
      ...base,
      success_criterion: "a".repeat(2001),
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts a null success_criterion (socials rows)", () => {
    const parsed = WritableAudienceSchema.safeParse({ ...base, success_criterion: null });
    expect(parsed.success).toBe(true);
  });
});

// ─── (c) existing constants are mode='socials' (the collision trap, Pitfall 1) ─

describe("existing virtual constants run the Socials pack (mode='socials')", () => {
  it("GENERAL_AUDIENCE.mode === 'socials'", () => {
    expect(GENERAL_AUDIENCE.mode).toBe("socials");
  });

  it("every PRESET_AUDIENCES entry is mode 'socials'", () => {
    for (const p of PRESET_AUDIENCES) {
      expect(p.mode).toBe("socials");
    }
  });
});

// ─── (d) GENERAL_TEMPLATES — analyst + hiring zero-setup virtual constants ─────

describe("GENERAL_TEMPLATES — analyst + hiring (D-08)", () => {
  it("exports exactly two templates with ids template-analyst and template-hiring", () => {
    expect(GENERAL_TEMPLATES).toHaveLength(2);
    expect(GENERAL_TEMPLATES.map((t) => t.id).sort()).toEqual([
      "template-analyst",
      "template-hiring",
    ]);
  });

  it("both templates are mode 'general'", () => {
    for (const t of GENERAL_TEMPLATES) {
      expect(t.mode).toBe("general");
    }
  });

  it("both templates carry a null signature (regression-gate-free, Pitfall 5)", () => {
    for (const t of GENERAL_TEMPLATES) {
      expect(t.signature ?? null).toBeNull();
    }
  });

  it("template personas are ungrounded-by-design (no evidence field)", () => {
    for (const t of GENERAL_TEMPLATES) {
      expect(t.personas.length).toBeGreaterThan(0);
      for (const p of t.personas) {
        expect("evidence" in (p as unknown as Record<string, unknown>)).toBe(false);
      }
    }
  });

  it("both templates carry a non-empty success_criterion + empty custom_context", () => {
    for (const t of GENERAL_TEMPLATES) {
      expect(typeof t.success_criterion).toBe("string");
      expect((t.success_criterion ?? "").length).toBeGreaterThan(0);
      expect(t.custom_context).toEqual([]);
    }
  });

  it("listAudiences prepends [GENERAL, ...PRESETS, ...GENERAL_TEMPLATES] before user rows", async () => {
    const sb = makeSupabaseMock();
    sb._chain.order.mockResolvedValue({ data: [], error: null });

    const result = await listAudiencesProxy(sb);
    const ids = result.map((a) => a.id);
    expect(ids).toEqual([
      "general",
      PRESET_AUDIENCES[0]!.id,
      PRESET_AUDIENCES[1]!.id,
      "template-analyst",
      "template-hiring",
    ]);
  });
});

// ─── (e) sentinel guard — templates refused on delete ─────────────────────────

describe("deleteAudience — template ids are refused without a DB call", () => {
  it("throws for template-analyst and never reaches the DB", async () => {
    const sb = makeSupabaseMock();
    await expect(
      deleteAudience(sb as unknown as Parameters<typeof deleteAudience>[0], "template-analyst"),
    ).rejects.toThrow();
    expect(sb.from).not.toHaveBeenCalled();
  });

  it("throws for template-hiring and never reaches the DB", async () => {
    const sb = makeSupabaseMock();
    await expect(
      deleteAudience(sb as unknown as Parameters<typeof deleteAudience>[0], "template-hiring"),
    ).rejects.toThrow();
    expect(sb.from).not.toHaveBeenCalled();
  });
});

// ─── (f) POP-03 — a mode='general' audience saves + renames through CRUD ───────

describe("POP-03 — General audience saves (create) + renames (update) through CRUD", () => {
  it("createAudience writes a row whose mode is 'general'", async () => {
    const sb = makeSupabaseMock();
    sb._chain.single.mockResolvedValue({
      data: {
        id: "new-general-id",
        user_id: "test-user-id",
        name: "My General",
        type: "target",
        platform: "custom",
        goal_label: null,
        goal_intent: null,
        mode: "general",
        success_criterion: null,
        custom_context: [],
        is_general: false,
        is_preset: false,
        fyp: 0.65,
        niche: 0.2,
        loyalist: 0.1,
        cross_niche: 0.05,
        personas: [],
        profile: null,
        calibration: null,
        creator_persona: null,
        signature: null,
        created_at: "2026-06-27T00:00:00Z",
        updated_at: "2026-06-27T00:00:00Z",
      },
      error: null,
    });

    const created = await createAudience(
      sb as unknown as Parameters<typeof createAudience>[0],
      {
        name: "My General",
        type: "target",
        platform: "custom",
        mode: "general",
      } as Partial<Audience>,
    );

    // mode reaches the insert payload (the seam under test)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const insertCall = (sb._chain.insert.mock.calls[0] as any[])[0] as Record<string, unknown>;
    expect(insertCall["mode"]).toBe("general");
    expect(insertCall["user_id"]).toBe("test-user-id"); // session-derived, never input
    expect(created.mode).toBe("general");
  });

  it("updateAudience renames a General audience (name reaches the update payload)", async () => {
    const sb = makeSupabaseMock();
    sb._chain.single.mockResolvedValue({
      data: {
        id: "existing-general-id",
        user_id: "test-user-id",
        name: "Renamed General",
        type: "target",
        platform: "custom",
        goal_label: null,
        goal_intent: null,
        mode: "general",
        success_criterion: null,
        custom_context: [],
        is_general: false,
        is_preset: false,
        fyp: 0.65,
        niche: 0.2,
        loyalist: 0.1,
        cross_niche: 0.05,
        personas: [],
        profile: null,
        calibration: null,
        creator_persona: null,
        signature: null,
        created_at: "2026-06-27T00:00:00Z",
        updated_at: "2026-06-27T00:00:00Z",
      },
      error: null,
    });

    await updateAudience(
      sb as unknown as Parameters<typeof updateAudience>[0],
      "existing-general-id",
      { name: "Renamed General" } as Partial<Audience>,
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateCall = (sb._chain.update.mock.calls[0] as any[])[0] as Record<string, unknown>;
    expect(updateCall["name"]).toBe("Renamed General");
    expect(updateCall["user_id"]).toBeUndefined(); // never overwritten on update
    expect(sb._chain.eq).toHaveBeenCalledWith("id", "existing-general-id");
  });
});

// ─── helper: listAudiences with the mock typed loosely ────────────────────────
async function listAudiencesProxy(sb: ReturnType<typeof makeSupabaseMock>): Promise<Audience[]> {
  const { listAudiences } = await import("../audience-repo");
  return listAudiences(sb as unknown as Parameters<typeof listAudiences>[0]);
}
