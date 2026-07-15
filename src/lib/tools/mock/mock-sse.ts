/**
 * Layer 2 of the dev mock skill sandbox — the LIVE skill short-circuit.
 *
 * When the `numen_mock` cookie is armed (dev/test ONLY — isMockSkillsEnabled hard-gates
 * prod, so a forged cookie is ignored on the deployed app), each /api/tools/* route calls
 * maybeMockSkillRun() right after its auth gate, BEFORE any engine work. Two behaviours:
 *
 *   1. Fixture-backed composer card skills (explore, hooks, ideas, script, remix) →
 *      streamFixture() replays FIXTURE_BLOCKS_BY_SKILL[skill] over the EXACT SSE contract
 *      the client hooks already parse (stage → content → per-card score → done) and
 *      persists the blocks via the real insertMessage write path. A run costs ZERO
 *      Qwen/Apify tokens yet renders through the real streaming + persistence path.
 *
 *   2. Every other route (chat token-stream + the JSON profile/simulate/predict/read/
 *      react/refine/develop routes) → a cheap 503 "not mocked yet — run skipped" so that
 *      arming the toggle GUARANTEES nothing hits a paid engine. Those skills stay viewable
 *      via the ⚙ seed (Layer 1); only their live re-trigger is short-circuited here.
 *
 * This is what makes the "Mock skill runs" toggle honest: with it on, no /api/tools/* route
 * can spend a real token (the accidental Explore→Apify scrape that motivated this can't recur).
 */

import { cookies } from "next/headers";
import { createOpenThreadLazy } from "@/lib/threads/threads";
import { insertMessage } from "@/lib/threads/messages";
import { kcStamp } from "@/lib/kc/kc-stamp";
import { isMockSkillsEnabled, MOCK_COOKIE } from "@/lib/dev/dev-mock";
import { FIXTURE_BLOCKS_BY_SKILL, type MockSkill } from "@/lib/tools/mock/fixtures";

/** The skills replayed as a full fixture SSE stream (the composer card skills). */
const STREAMED_SKILLS = new Set<MockSkill>(["explore", "hooks", "ideas", "script", "remix"]);

function sseHeaders(): HeadersInit {
  return {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    "X-Accel-Buffering": "no",
  };
}

/** Loose view of the scorable props a card fixture carries (band/fraction fill the chip). */
interface ScorableProps {
  band?: unknown;
  fraction?: unknown;
  seedHook?: unknown;
  rank?: unknown;
  model?: unknown;
}

/** One SSE frame: an event name + its JSON-serialisable payload. */
export interface MockFrame {
  event: string;
  data: unknown;
}

/**
 * PURE — build the ordered SSE frames a fixture replay emits. No I/O, so this is the
 * unit-tested core: a cosmetic active stage, one content frame with all blocks, one score
 * frame per scorable card (band present), a done stage, then done. A block WITHOUT a `band`
 * (explore's outlier-grid, chat markdown) emits no score frame — matching the real routes.
 */
export function buildMockFrames(blocks: readonly unknown[]): MockFrame[] {
  const frames: MockFrame[] = [
    { event: "stage", data: { name: "Replaying mock fixture", status: "active" } },
    { event: "content", data: { blocks } },
  ];

  for (const block of blocks as Array<{ props?: ScorableProps }>) {
    const p = block?.props;
    if (p && typeof p.band === "string") {
      frames.push({
        event: "score",
        data: {
          seedHook: typeof p.seedHook === "string" ? p.seedHook : undefined,
          rank: typeof p.rank === "number" ? p.rank : undefined,
          band: p.band,
          fraction: typeof p.fraction === "string" ? p.fraction : "",
          model: typeof p.model === "string" ? p.model : undefined,
        },
      });
    }
  }

  frames.push({ event: "stage", data: { name: "Replaying mock fixture", status: "done" } });
  frames.push({ event: "done", data: { count: blocks.length } });
  return frames;
}

/**
 * Build the mock SSE stream for a fixture-backed card skill. Emits the events the client
 * hooks parse: a cosmetic stage, one content frame carrying the fixture blocks, one score
 * frame per scorable card (band/fraction — matched by seedHook/rank or first-unscored, per
 * client), then done. Persists the blocks first (real write path, validated per block) so a
 * thread reload renders the identical set through the real renderers.
 *
 * explore's grid block carries no `band`, so it emits no score frame — matching the real
 * /api/tools/explore contract (content + done, no per-card score).
 */
async function streamFixture(skill: MockSkill, userId: string): Promise<Response> {
  const blocks = FIXTURE_BLOCKS_BY_SKILL[skill];

  // Persist through the real write path (validates every block — D-14) so a reload matches.
  const openThread = await createOpenThreadLazy(userId);
  if (blocks.length > 0) {
    await insertMessage(openThread.id, "assistant", blocks, kcStamp().kcGenVersion);
  }

  const frames = buildMockFrames(blocks);
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      for (const { event, data } of frames) {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          /* stream cancelled — drop frame */
        }
      }
      try {
        controller.close();
      } catch {
        /* already closed */
      }
    },
  });

  return new Response(stream, { headers: sseHeaders() });
}

/**
 * The Layer 2 gate. Call right after a tool route's auth gate:
 *
 *   const mock = await maybeMockSkillRun("hooks", user.id);
 *   if (mock) return mock;
 *
 * Returns:
 *  - null                  — toggle off (or prod): the route runs the real engine as normal.
 *  - an SSE fixture stream — a fixture-backed card skill (explore/hooks/ideas/script/remix).
 *  - a 503 "skipped" JSON  — any other skill: no engine call, honest signal to the client.
 *
 * `skill` is the caller route's label; only STREAMED_SKILLS values get a fixture stream.
 */
export async function maybeMockSkillRun(skill: string, userId: string): Promise<Response | null> {
  const store = await cookies();
  if (!isMockSkillsEnabled(store.get(MOCK_COOKIE)?.value)) return null;

  if (STREAMED_SKILLS.has(skill as MockSkill)) {
    return streamFixture(skill as MockSkill, userId);
  }

  return Response.json(
    {
      error: "mock_skip",
      message: `Mock skill runs is ON — "${skill}" isn't mocked yet, so this run was skipped (no engine call). Use the ⚙ panel's seed to view its fixture.`,
      mockSkipped: true,
    },
    { status: 503 },
  );
}
