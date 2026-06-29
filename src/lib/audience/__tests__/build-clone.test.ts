/**
 * Phase 7 Plan 03 — cloneTemplateAudience (UX-04 / D-03 "From a template" Build path).
 *
 * Locks the template clone-and-edit helper: reading a GENERAL_TEMPLATES entry, stripping its
 * sentinel id (e.g. 'template-analyst') + virtual user_id ('__virtual__'), and saving it
 * through the existing createAudience as an owned, editable General SIM (mode:'general').
 *
 * Mock-first — mirrors audience-repo.test.ts / audience-repo-mode.test.ts; zero live DB.
 *
 * Test runner (CRITICAL repo quirk): run via
 *   node ./node_modules/vitest/vitest.mjs run src/lib/audience/__tests__/build-clone.test.ts
 * NEVER `npm test` / `npx vitest` — they emit fake PASS(0)/FAIL(0).
 */

import { describe, it, expect, vi } from "vitest";
import { cloneTemplateAudience } from "../audience-repo";

// ─── Mocks ────────────────────────────────────────────────────────────────────

/**
 * Supabase client mock. `single()` returns the persisted row (echoing the insert payload back
 * with a real id + session user_id) so createAudience → rowToAudience yields a valid Audience.
 */
function makeSupabaseMock(overrides: Record<string, unknown> = {}) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: {
        id: "saved-general-id",
        user_id: "test-user-id",
        name: "Analyst Panel",
        type: "target",
        platform: "custom",
        goal_label: null,
        goal_intent: null,
        mode: "general",
        success_criterion:
          "Surfaces the sharpest risk and the strongest counter-argument before a decision is made.",
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
        created_at: "2026-06-29T00:00:00Z",
        updated_at: "2026-06-29T00:00:00Z",
      },
      error: null,
    }),
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

/** Pull the single object handed to `.insert(...)`. */
function insertPayload(sb: ReturnType<typeof makeSupabaseMock>): Record<string, unknown> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (sb._chain.insert.mock.calls[0] as any[])[0] as Record<string, unknown>;
}

// ─── Task 1: clone → createAudience(mode:'general', sentinel/virtual stripped) ────

describe("cloneTemplateAudience — clones a GENERAL_TEMPLATE as an owned General SIM", () => {
  it("saves the analyst template as a mode:'general' row through createAudience", async () => {
    const sb = makeSupabaseMock();

    const saved = await cloneTemplateAudience(
      sb as unknown as Parameters<typeof cloneTemplateAudience>[0],
      "template-analyst",
    );

    // routes through createAudience → insert on the audiences table
    expect(sb.from).toHaveBeenCalledWith("audiences");
    const payload = insertPayload(sb);
    // mode:'general' is carried from the template (the moat domain axis)
    expect(payload["mode"]).toBe("general");
    // returns the saved Audience
    expect(saved.id).toBe("saved-general-id");
    expect(saved.mode).toBe("general");
  });

  it("strips the sentinel id — no client-supplied id reaches the insert payload", async () => {
    const sb = makeSupabaseMock();

    await cloneTemplateAudience(
      sb as unknown as Parameters<typeof cloneTemplateAudience>[0],
      "template-analyst",
    );

    const payload = insertPayload(sb);
    // audienceToRow never copies `id`; the clone must not smuggle the sentinel id back in
    expect(payload["id"]).toBeUndefined();
  });

  it("derives the default name from the template name when none is provided", async () => {
    const sb = makeSupabaseMock();

    await cloneTemplateAudience(
      sb as unknown as Parameters<typeof cloneTemplateAudience>[0],
      "template-analyst",
    );

    expect(insertPayload(sb)["name"]).toBe("Analyst Panel");
  });

  it("truncates a provided name longer than 80 chars to ≤ 80 before save", async () => {
    const sb = makeSupabaseMock();
    const longName = "A".repeat(120);

    await cloneTemplateAudience(
      sb as unknown as Parameters<typeof cloneTemplateAudience>[0],
      "template-analyst",
      longName,
    );

    const name = insertPayload(sb)["name"] as string;
    expect(name.length).toBeLessThanOrEqual(80);
  });

  it("throws on an unknown templateId and never touches the DB", async () => {
    const sb = makeSupabaseMock();

    await expect(
      cloneTemplateAudience(
        sb as unknown as Parameters<typeof cloneTemplateAudience>[0],
        "template-does-not-exist",
      ),
    ).rejects.toThrow();

    expect(sb.from).not.toHaveBeenCalled();
  });
});
