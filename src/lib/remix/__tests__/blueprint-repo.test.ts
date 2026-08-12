import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { insertBlueprint, getBlueprint, BLUEPRINT_COLUMNS } from "../blueprint-repo";
import type { BlueprintRow } from "../blueprint-repo";
import { emptyBlueprint } from "@/lib/engine/remix/blueprint";

/**
 * Minimal supabase-js double — the I/O boundary we cannot run in a unit test.
 *
 * It mirrors the exact chain the repo builds: `.from().select().eq().eq().single()` for the
 * read and `.from().insert()` for the write. Every link is exposed so the tests can assert
 * WHAT was sent, not only what came back — a repo that queried the wrong table or dropped the
 * user scope would otherwise pass every behavioural assertion here.
 */
function clientReturning(result: { data: unknown; error: unknown }) {
  const single = vi.fn().mockResolvedValue(result);
  const eqUser = vi.fn().mockReturnValue({ single });
  const eqId = vi.fn().mockReturnValue({ eq: eqUser });
  const select = vi.fn().mockReturnValue({ eq: eqId });
  const insert = vi.fn().mockResolvedValue(result);
  const from = vi.fn().mockReturnValue({ select, insert });
  return {
    client: { from } as unknown as SupabaseClient,
    from,
    select,
    eqId,
    eqUser,
    insert,
    single,
  };
}

/**
 * One canonical row, typed as `BlueprintRow`.
 *
 * Deliberately shared by the insert tests AND the column-list test: adding a required field to
 * `BlueprintRow` forces this literal to gain it (tsc), which in turn fails the column-list
 * assertion until the SELECT is widened too. That coupling is the point — a field added to the
 * type but not to the query reads back as `undefined` with no error anywhere.
 */
const SAMPLE_ROW: BlueprintRow = {
  id: "abc123def456",
  user_id: "u1",
  thread_id: "11111111-1111-4111-8111-111111111111",
  source_video_id: "https://www.tiktok.com/@creator/video/123",
  blueprint: {
    duration_s: 14,
    words_per_second: 3.2,
    has_speech: true,
    // A REAL read, which is the row shape phase 1 is meant to store. The fabricated-grid case
    // reports true here and is covered where it is decided (engine/remix/blueprint.test.ts);
    // this literal exists so the repo's column list and the type stay coupled.
    from_fixed_buckets: false,
    beats: [
      {
        index: 0,
        t_start: 0,
        t_end: 1.8,
        duration_s: 1.8, spoken_span_s: null,
        role: "hook",
        spoken: "source line",
        on_screen_text: null,
        visual_event: "tight crop",
        audio_event: "voice",
        cuts: 1,
        weakness: null,
      },
    ],
  },
  script: [[{ index: 0, spoken: "your line", on_screen_text: "STOP", shot: "waist-up" }]],
};

describe("blueprint-repo", () => {
  describe("insertBlueprint", () => {
    it("throws when the insert returns an error — a swallowed write stores nothing", async () => {
      const c = clientReturning({ data: null, error: { message: "check constraint" } });
      await expect(insertBlueprint(c.client, SAMPLE_ROW)).rejects.toThrow(/check constraint/);
    });

    it("writes the whole row, unaltered, to remix_blueprints", async () => {
      const c = clientReturning({ data: null, error: null });
      await insertBlueprint(c.client, SAMPLE_ROW);
      expect(c.from).toHaveBeenCalledWith("remix_blueprints");
      expect(c.insert).toHaveBeenCalledWith(SAMPLE_ROW);
    });

    /**
     * A REGRESSION PIN, not a driver — it passes against a pass-through repo and always would.
     * `AdaptConcept.script` is optional, so the runner maps a scriptless concept to `[]` and a
     * three-card run where adapt returned no script at all is `[[], [], []]`. Nothing may reject
     * that: it is the empty-blueprint / no-video path, which must still store a row. Pinned
     * because the obvious future "tidy-up" is a non-empty guard here, and that would turn the
     * quietest legitimate case into a thrown insert.
     */
    it("stores a row whose concepts produced no script at all", async () => {
      const c = clientReturning({ data: null, error: null });
      const scriptless: BlueprintRow = {
        ...SAMPLE_ROW,
        blueprint: emptyBlueprint(),
        script: [[], [], []],
      };
      await insertBlueprint(c.client, scriptless);
      expect(c.insert).toHaveBeenCalledWith(scriptless);
    });
  });

  describe("getBlueprint", () => {
    it("scopes the read by user id as well as row id", async () => {
      const c = clientReturning({ data: SAMPLE_ROW, error: null });
      await getBlueprint(c.client, "abc123def456", "u1");
      expect(c.eqId).toHaveBeenCalledWith("id", "abc123def456");
      expect(c.eqUser).toHaveBeenCalledWith("user_id", "u1");
    });

    it("selects every column BlueprintRow declares, and no wildcard", async () => {
      const c = clientReturning({ data: SAMPLE_ROW, error: null });
      await getBlueprint(c.client, "abc123def456", "u1");
      const requested = c.select.mock.calls[0]?.[0] as string | undefined;
      expect(requested).toBeDefined();
      expect(requested).not.toContain("*");
      for (const column of Object.keys(SAMPLE_ROW)) {
        expect(BLUEPRINT_COLUMNS.split(",").map((s) => s.trim())).toContain(column);
      }
      expect(c.select).toHaveBeenCalledWith(BLUEPRINT_COLUMNS);
    });

    it("returns the row when it is found", async () => {
      const c = clientReturning({ data: SAMPLE_ROW, error: null });
      expect(await getBlueprint(c.client, "abc123def456", "u1")).toEqual(SAMPLE_ROW);
    });

    it("returns null rather than throwing when the row is absent", async () => {
      const c = clientReturning({ data: null, error: { code: "PGRST116", message: "no rows" } });
      expect(await getBlueprint(c.client, "missing", "u1")).toBeNull();
    });

    it("returns null when the driver reports neither a row nor an error", async () => {
      const c = clientReturning({ data: null, error: null });
      expect(await getBlueprint(c.client, "missing", "u1")).toBeNull();
    });

    it("THROWS when the table is missing — that must not read as an empty sheet", async () => {
      // The single likeliest failure in this lane: the migration is written here and applied by
      // hand, so an unapplied migration is one forgotten paste away. PostgREST answers PGRST205,
      // and collapsing it to null would render the shoot sheet permanently, silently absent.
      const c = clientReturning({
        data: null,
        error: {
          code: "PGRST205",
          message: "Could not find the table 'public.remix_blueprints' in the schema cache",
        },
      });
      await expect(getBlueprint(c.client, "abc123def456", "u1")).rejects.toThrow(
        /remix_blueprints/,
      );
    });

    it("THROWS on a permissions error rather than reporting an empty result", async () => {
      const c = clientReturning({
        data: null,
        error: { code: "42501", message: "permission denied for table remix_blueprints" },
      });
      await expect(getBlueprint(c.client, "abc123def456", "u1")).rejects.toThrow(
        /permission denied/,
      );
    });
  });
});
