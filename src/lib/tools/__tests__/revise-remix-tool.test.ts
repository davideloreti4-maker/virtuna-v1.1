/**
 * revise-remix-tool.test.ts — the FREE `revise_remix` chat-agent tool (phase 5, spec §6.2-§6.4).
 *
 * Hermetic: `getBlueprint` / `updateVariantScript` / `reviseBeats` are all injected, so nothing
 * hits Supabase or the model. Locks the handler's own contract — the loop-level free-tool
 * invariants (no billing gate, no onDispatch, role:"tool" result) live in chat-agent-loop.test.ts.
 */

import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  REVISE_REMIX_TOOL,
  handleReviseRemix,
  type ReviseRemixDeps,
} from "@/lib/tools/revise-remix-tool";
import type { BlueprintRow } from "@/lib/remix/blueprint-repo";
import type { AdaptedBeat } from "@/lib/engine/remix/decode-types";

/** A row with two beats per variant and TWO variants — variant 1 is the sibling that must never be touched. */
function makeRow(overrides: Partial<BlueprintRow> = {}): BlueprintRow {
  return {
    id: "bp1",
    user_id: "u1",
    thread_id: null,
    source_video_id: null,
    blueprint: {
      duration_s: 10,
      words_per_second: 3,
      has_speech: true,
      from_fixed_buckets: false,
      beats: [
        { index: 0, t_start: 0, t_end: 1, duration_s: 1, spoken_span_s: null, role: "hook", spoken: "src0", on_screen_text: null, visual_event: "v0", audio_event: "a0", cuts: 1, weakness: null },
        { index: 1, t_start: 1, t_end: 2, duration_s: 1, spoken_span_s: null, role: "setup", spoken: "src1", on_screen_text: null, visual_event: "v1", audio_event: "a1", cuts: 1, weakness: null },
      ],
    },
    script: [
      [
        { index: 0, spoken: "v0b0", on_screen_text: "A", shot: "s0" },
        { index: 1, spoken: "v0b1", on_screen_text: "B", shot: "s1" },
      ],
      [
        { index: 0, spoken: "v1b0", on_screen_text: "C", shot: "s2" },
        { index: 1, spoken: "v1b1", on_screen_text: "D", shot: "s3" },
      ],
    ],
    clip_uris: [],
    ...overrides,
  };
}

const REVISED_BEAT_1: AdaptedBeat = { index: 1, spoken: "punchier line", on_screen_text: "PUNCH", shot: "closeup" };

function mkDeps(over: Partial<ReviseRemixDeps> = {}): ReviseRemixDeps {
  return {
    service: {} as SupabaseClient,
    userId: "u1",
    getBlueprint: vi.fn(async () => makeRow()),
    updateVariantScript: vi.fn(async () => true),
    reviseBeats: vi.fn(async () => [REVISED_BEAT_1]),
    onRevised: vi.fn(),
    ...over,
  };
}

const VALID_ARGS = { blueprintId: "bp1", variant: 0, beats: [1], note: "beat 2 is too soft" };

describe("REVISE_REMIX_TOOL schema", () => {
  it("declares the exact contract spec §6.3 requires", () => {
    expect(REVISE_REMIX_TOOL.function.name).toBe("revise_remix");
    expect(REVISE_REMIX_TOOL.function.parameters.required).toEqual([
      "blueprintId",
      "variant",
      "beats",
      "note",
    ]);
    const props = REVISE_REMIX_TOOL.function.parameters.properties;
    expect(props.variant).toMatchObject({ type: "integer", minimum: 0 });
    // No default on `variant` — spec §6.3: a guessed variant silently rewrites a sibling card.
    expect(props.variant).not.toHaveProperty("default");
    expect(props.beats).toMatchObject({ type: "array", minItems: 1, items: { type: "integer" } });
    expect(props.note.type).toBe("string");
  });

  it("tells the model addresses come ONLY from the remix_sheets data block, and it cannot touch the hook", () => {
    const desc = REVISE_REMIX_TOOL.function.description;
    expect(desc).toMatch(/remix_sheets/);
    expect(desc.toLowerCase()).toMatch(/hook/);
  });
});

describe("handleReviseRemix", () => {
  it("refuses with ownership copy when getBlueprint returns null — never yours or doesn't exist", async () => {
    const deps = mkDeps({ getBlueprint: vi.fn(async () => null) });

    const result = await handleReviseRemix(VALID_ARGS, deps);

    expect(result.ok).toBe(false);
    expect(result.error).toBe("that sheet isn't yours or doesn't exist");
    expect(deps.reviseBeats).not.toHaveBeenCalled();
    expect(deps.updateVariantScript).not.toHaveBeenCalled();
    expect(deps.onRevised).not.toHaveBeenCalled();
  });

  it("refuses a variant index the row's script array does not have", async () => {
    const deps = mkDeps(); // makeRow() has 2 variants: 0, 1

    const result = await handleReviseRemix({ ...VALID_ARGS, variant: 5 }, deps);

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/variant/i);
    expect(deps.reviseBeats).not.toHaveBeenCalled();
    expect(deps.updateVariantScript).not.toHaveBeenCalled();
    expect(deps.onRevised).not.toHaveBeenCalled();
  });

  it("filters requested beats to indexes actually present in script[variant]", async () => {
    const reviseBeats = vi.fn(async (..._args: unknown[]) => [REVISED_BEAT_1]);
    const deps = mkDeps({ reviseBeats });

    // beat 1 exists on variant 0; beat 99 does not.
    const result = await handleReviseRemix({ ...VALID_ARGS, beats: [1, 99] }, deps);

    expect(result.ok).toBe(true);
    expect(result.revised).toEqual([1]);
    const call = reviseBeats.mock.calls[0]![0] as { targets: number[] };
    expect(call.targets).toEqual([1]);
  });

  it("all requested beats absent from script[variant] ⇒ a clean no-op, never a write", async () => {
    const deps = mkDeps();

    const result = await handleReviseRemix({ ...VALID_ARGS, beats: [42, 99] }, deps);

    expect(result.ok).toBe(true);
    expect(result.revised).toEqual([]);
    expect(deps.reviseBeats).not.toHaveBeenCalled();
    expect(deps.updateVariantScript).not.toHaveBeenCalled();
    expect(deps.onRevised).not.toHaveBeenCalled();
  });

  it("writes ONLY script[variant] — the sibling variant never reaches updateVariantScript", async () => {
    const updateVariantScript = vi.fn(async (..._args: unknown[]) => true);
    const deps = mkDeps({ updateVariantScript });

    await handleReviseRemix(VALID_ARGS, deps);

    expect(updateVariantScript).toHaveBeenCalledTimes(1);
    const [service, id, userId, variant, script] = updateVariantScript.mock.calls[0]!;
    expect(service).toBe(deps.service);
    expect(id).toBe("bp1");
    expect(userId).toBe("u1");
    expect(variant).toBe(0);
    // The written array is variant 0's beats, merged — never variant 1's "v1b0"/"v1b1" lines.
    expect(script).toEqual([
      { index: 0, spoken: "v0b0", on_screen_text: "A", shot: "s0" }, // untouched (not targeted)
      REVISED_BEAT_1, // replaced by index
    ]);
    const written = JSON.stringify(script);
    expect(written).not.toContain("v1b0");
    expect(written).not.toContain("v1b1");
  });

  it("merges by index — a beat NOT targeted is carried over unchanged even if reviseBeats reorders", async () => {
    // reviseBeats only ever returns the targeted subset; the merge must not assume positional order.
    const deps = mkDeps({
      updateVariantScript: vi.fn(async () => true),
      reviseBeats: vi.fn(async () => [{ index: 1, spoken: "new", on_screen_text: "X", shot: "y" }]),
    });

    const result = await handleReviseRemix(VALID_ARGS, deps);

    expect(result.ok).toBe(true);
    const script = (deps.updateVariantScript as ReturnType<typeof vi.fn>).mock.calls[0]![4];
    expect(script[0]).toEqual({ index: 0, spoken: "v0b0", on_screen_text: "A", shot: "s0" });
    expect(script[1]).toEqual({ index: 1, spoken: "new", on_screen_text: "X", shot: "y" });
  });

  it("honest failure when reviseBeats returns null (the all-or-nothing generator refused)", async () => {
    const deps = mkDeps({ reviseBeats: vi.fn(async () => null) });

    const result = await handleReviseRemix(VALID_ARGS, deps);

    expect(result.ok).toBe(false);
    expect(typeof result.error).toBe("string");
    expect(deps.updateVariantScript).not.toHaveBeenCalled();
    expect(deps.onRevised).not.toHaveBeenCalled();
  });

  it("honest failure when updateVariantScript returns false — never claims success on a false write", async () => {
    const deps = mkDeps({ updateVariantScript: vi.fn(async () => false) });

    const result = await handleReviseRemix(VALID_ARGS, deps);

    expect(result.ok).toBe(false);
    expect(typeof result.error).toBe("string");
    expect(deps.onRevised).not.toHaveBeenCalled();
  });

  it("onRevised fires on success only, with the address", async () => {
    const onRevised = vi.fn();
    const deps = mkDeps({ onRevised });

    const result = await handleReviseRemix(VALID_ARGS, deps);

    expect(result.ok).toBe(true);
    expect(result.revised).toEqual([1]);
    expect(onRevised).toHaveBeenCalledTimes(1);
    expect(onRevised).toHaveBeenCalledWith({ blueprintId: "bp1", variant: 0 });
  });

  it("returns the model-facing success shape exactly: {ok, revised, variant}", async () => {
    const deps = mkDeps();
    const result = await handleReviseRemix(VALID_ARGS, deps);
    expect(result).toMatchObject({ ok: true, revised: [1], variant: 0 });
  });

  // ── Every failure path returns a tool-result string, never throws ──────────────────────────
  it.each([
    ["missing blueprintId", { ...VALID_ARGS, blueprintId: undefined }],
    ["non-string blueprintId", { ...VALID_ARGS, blueprintId: 123 }],
    ["missing variant", { ...VALID_ARGS, variant: undefined }],
    ["negative variant", { ...VALID_ARGS, variant: -1 }],
    ["non-integer variant", { ...VALID_ARGS, variant: 1.5 }],
    ["missing beats", { ...VALID_ARGS, beats: undefined }],
    ["empty beats array", { ...VALID_ARGS, beats: [] }],
    ["beats not an array", { ...VALID_ARGS, beats: "1" }],
    ["missing note", { ...VALID_ARGS, note: undefined }],
    ["empty note", { ...VALID_ARGS, note: "   " }],
    ["completely malformed", "not even an object"],
    ["null args", null],
  ])("malformed call (%s) is refused honestly, never throws", async (_label, args) => {
    const deps = mkDeps();

    let result: Awaited<ReturnType<typeof handleReviseRemix>> | undefined;
    await expect(
      (async () => {
        result = await handleReviseRemix(args as unknown, deps);
      })(),
    ).resolves.not.toThrow();

    expect(result?.ok).toBe(false);
    expect(typeof result?.error).toBe("string");
    expect(deps.getBlueprint).not.toHaveBeenCalled();
  });

  it("never throws even when getBlueprint itself throws (an unapplied migration, per blueprint-repo's contract)", async () => {
    const deps = mkDeps({
      getBlueprint: vi.fn(async () => {
        throw new Error("remix_blueprints read failed: relation does not exist");
      }),
    });

    const result = await handleReviseRemix(VALID_ARGS, deps);

    expect(result.ok).toBe(false);
    expect(typeof result.error).toBe("string");
  });

  it("refuses honestly (never throws) when the write deps are not wired at all", async () => {
    const result = await handleReviseRemix(VALID_ARGS, { onRevised: vi.fn() } as ReviseRemixDeps);

    expect(result.ok).toBe(false);
    expect(typeof result.error).toBe("string");
  });
});
