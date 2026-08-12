## Task 5: Runner + route integration

**Files:**
- Modify: `src/lib/tools/runners/remix-runner.ts:237-260` (assemble + pass), `:320-400` (stamp the id)
- Modify: `src/lib/tools/blocks.ts:510` (`blueprintId`)
- Modify: `src/app/api/tools/remix/run/route.ts:193-260` (persist + emit)
- Test: `src/lib/tools/runners/__tests__/remix-runner.test.ts` (append; create if absent)

**Interfaces:**
- Consumes: `buildBlueprint()` (Task 1), `insertBlueprint()` (Task 4), widened `AdaptInput` (Task 3).
- Produces: `RemixPipelineResult` gains
  `blueprint: { id: string; payload: SourceBlueprint; script: AdaptedBeat[][]; sourceVideoId: string } | null`;
  every emitted `RemixCardBlock` carries `props.blueprintId`.

The runner **generates the id itself** with `nanoid(12)` and stamps it on the blocks, then hands the payload back. The route persists it before `insertMessage`. This keeps all DB writes in the route, where the authenticated client already lives, and keeps the runner pure enough to test.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/tools/runners/__tests__/remix-runner.test.ts
import { describe, it, expect } from "vitest";
import { buildBlueprint } from "@/lib/engine/remix/blueprint";
import type { OmniStructuralInput } from "@/lib/engine/remix/decode-types";

describe("remix runner blueprint seam", () => {
  it("produces a blueprint the adapt input can carry", () => {
    const structural = {
      hook_decomposition: {
        visual_stop_power: 5, audio_hook_quality: 5, text_overlay_score: 5,
        first_words_speech_score: 5, weakest_modality: "audio_hook_quality",
        visual_audio_coherence: 5, cognitive_load: 5,
      },
      factors: [],
      video_signals: { visual_production_quality: 5, pacing_score: 5, transition_quality: 5 },
      segments: [
        { t_start: 0, t_end: 2, visual_event: "v", audio_event: "a",
          is_hook_zone: true, spoken_text: "one two", on_screen_text: null },
        { t_start: 2, t_end: 6, visual_event: "v2", audio_event: "a2",
          is_hook_zone: false, spoken_text: "three four", on_screen_text: null },
      ],
      content_summary: "", overall_impression: "",
      content_type: "talking_head", niche_primary_slug: "fitness",
    } satisfies OmniStructuralInput;

    const bp = buildBlueprint(structural);
    expect(bp.beats.length).toBe(2);
    expect(bp.beats[0].role).toBe("hook");
    expect(bp.has_speech).toBe(true);
  });
});
```

- [ ] **Step 2: Run it and confirm it passes already**

Run: `npm test -- src/lib/tools/runners/__tests__/remix-runner.test.ts`
Expected: PASS.

**This test is a seam pin, not a TDD red step, and that is deliberate** (owner ruling, 2026-08-10). It cannot go red — Task 1 already built `buildBlueprint` and proved it with 11 tests. What it pins is that the function stays correct and importable *from the runner's path*, so a later refactor that breaks the seam fails here rather than in a live run. The wiring's own coverage is Step 6.

- [ ] **Step 3: Add `blueprintId` to the block schema**

In `src/lib/tools/blocks.ts`, inside `RemixCardBlockSchema.props`, after `formatBorrowed`:

```ts
    /**
     * The remix_blueprints row this card's beat-by-beat script lives in (phase 1, 2026-08-10).
     * OPTIONAL and additive: every card persisted before this lane has none and renders exactly
     * as it did. The script is NOT inlined here on purpose — phase 5's revise_remix rewrites the
     * row, and a copy frozen inside a thread message would drift from it silently.
     */
    blueprintId: z.string().min(8).max(64).regex(/^[A-Za-z0-9_-]+$/u).optional(),
```

- [ ] **Step 4: Wire the runner**

In `remix-runner.ts`, add imports:

```ts
import { buildBlueprint } from "@/lib/engine/remix/blueprint";
import type { SourceBlueprint } from "@/lib/engine/remix/blueprint";
import type { AdaptedBeat } from "@/lib/engine/remix/decode-types";
```

After `const decode = structural ? await runDecode(structural) : null;` and its null guard, add:

```ts
    // The timed skeleton — assembled from the SAME omni response the decode just collapsed.
    // Deterministic, no model call, no spend. Empty beats when omni returned no segments.
    const blueprint = structural
      ? buildBlueprint(structural)
      : { duration_s: 0, words_per_second: 0, has_speech: false, beats: [] };
```

Change the `adaptInput` construction to carry it:

```ts
    const adaptInput = {
      ...decodeResultToAdaptInput(decode, audienceNiche),
      blueprint,
      target: input.brief ?? null,
    };
```

Add `brief?: string | null` to the runner's input interface, beside `intent`.

Generate the id once, before the block loop:

```ts
    // Generated here so the id can ride the cards; the ROUTE writes the row (it owns the
    // authenticated client). nanoid(12), matching analysis ids — never a uuid.
    const blueprintId = nanoid(12);
```

Inside the block-building loop, add to `props` after `formatBorrowed`:

```ts
          ...(blueprint.beats.length > 0 ? { blueprintId } : {}),
```

Change the success return to carry the payload:

```ts
    return {
      blocks,
      warnings: allWarnings,
      blueprint: blueprint.beats.length > 0
        ? {
            id: blueprintId,
            payload: blueprint,
            script: rated.map((r) => (r.concept.script ?? []) as AdaptedBeat[]),
            sourceVideoId: sourcePostUrl ?? url,
          }
        : null,
    };
```

Add `blueprint` to the result type, and return `blueprint: null` from **every** early-error return in the function (`resolve_failed`, `decode_failed`, `adapt_failed`) so the shape is total.

- [ ] **Step 5: Persist in the route**

In `src/app/api/tools/remix/run/route.ts`, add the import:

```ts
import { insertBlueprint } from "@/lib/remix/blueprint-repo";
import { createServiceClient } from "@/lib/supabase/service";
```

Add `brief` to `RemixRunRequestSchema`:

```ts
  brief: z.string().max(200).optional(),
```

Pass it into `runRemixPipeline({ ... brief: parsed.data.brief ?? null, ... })`.

Immediately **before** the existing `insertMessage` call, add:

```ts
        // Persist the blueprint BEFORE the message: a card carrying a blueprintId whose row
        // does not exist would render a permanent skeleton. A failure here is non-fatal — we
        // drop the id rather than lose the cards.
        if (result.blueprint) {
          try {
            await insertBlueprint(createServiceClient(), {
              id: result.blueprint.id,
              user_id: user.id,
              thread_id: openThread.id,
              source_video_id: result.blueprint.sourceVideoId,
              blueprint: result.blueprint.payload,
              script: result.blueprint.script,
            });
          } catch (bpErr) {
            Sentry.captureException(bpErr, { tags: { route: "api.tools.remix.run" } });
            log.warn("blueprint persist failed — cards will render without beats", {
              error: bpErr instanceof Error ? bpErr.message : String(bpErr),
            });
            for (const b of result.blocks) delete (b.props as { blueprintId?: string }).blueprintId;
          }
        }
```

Add `blueprintId` to the `send("content", ...)` props map, so the beats render on the live card and not only after a reload:

```ts
              blueprintId: b.props.blueprintId,
```

⚠️ This last line matters. `proof`, `production` and `provenance` were each shipped persisted-but-absent from the SSE face, and each one produced a card that only became correct after a reload. Do not repeat it.

- [ ] **Step 6: Cover the wiring with route tests**

⚠️ The first assertion below is the one that matters most. `proof`, `production` and `provenance` were each shipped persisted-but-absent from this exact `send("content")` face, and each produced a card that only became correct after a reload. This test is what stops `blueprintId` becoming the fourth.

**Append** to the existing `src/app/api/tools/remix/run/__tests__/route.test.ts` — do not create a new file. That file already mocks `@/lib/supabase/server`, `@/lib/threads/messages`, `@/lib/threads/threads`, `@/lib/tools/runners/remix-runner`, `@/lib/kc/kc-stamp` and `nanoid`, and provides `makeRemixCard()` and `makeRemixRequest()`. Add one mock alongside the existing `vi.mock` calls at the top of the file:

```ts
vi.mock("@/lib/remix/blueprint-repo", () => ({
  insertBlueprint: vi.fn(),
}));
```

Then append this block inside the existing top-level `describe`:

```ts
  // ── Blueprint wiring (phase 1) ──────────────────────────────────────────────
  describe("blueprint persistence", () => {
    const BLUEPRINT_RESULT = {
      id: "bp1234567890",
      payload: { duration_s: 14, words_per_second: 3.2, has_speech: true, beats: [
        { index: 0, t_start: 0, t_end: 1.8, duration_s: 1.8, role: "hook" as const,
          spoken: "source line", on_screen_text: null, visual_event: "tight crop",
          audio_event: "voice", cuts: 1, weakness: null },
      ] },
      script: [[{ index: 0, spoken: "your line", on_screen_text: "", shot: "waist-up" }]],
      sourceVideoId: "https://www.tiktok.com/@creator/video/123",
    };

    /** Signs in a user, stubs the thread, and returns the mocked pipeline. */
    async function arrange(blueprint: unknown) {
      const { createClient } = await import("@/lib/supabase/server");
      const { runRemixPipeline } = await import("@/lib/tools/runners/remix-runner");
      const { createOpenThreadLazy } = await import("@/lib/threads/threads");

      (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-123" } } }) },
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      });
      (createOpenThreadLazy as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "thread-remix-abc", user_id: "user-123",
      });

      const card = makeRemixCard();
      (card.props as { blueprintId?: string }).blueprintId = "bp1234567890";
      (runRemixPipeline as ReturnType<typeof vi.fn>).mockResolvedValue({
        blocks: [card], warnings: [], blueprint,
      });
      return card;
    }

    async function drain(res: Response): Promise<string> {
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let out = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        out += decoder.decode(value, { stream: true });
      }
      return out;
    }

    it("puts blueprintId on the SSE content face, not only in the persisted block", async () => {
      await arrange(BLUEPRINT_RESULT);
      const { POST } = await import("@/app/api/tools/remix/run/route");
      const res = await POST(makeRemixRequest({
        url: "https://www.tiktok.com/@creator/video/123", platform: "tiktok",
      }));
      const raw = await drain(res);

      const contentLine = raw
        .split("\n")
        .find((l) => l.startsWith("data:") && l.includes("adaptedHook"));
      expect(contentLine).toBeDefined();
      expect(contentLine).toContain("bp1234567890");
    });

    it("writes the blueprint row before the thread message", async () => {
      await arrange(BLUEPRINT_RESULT);
      const { insertBlueprint } = await import("@/lib/remix/blueprint-repo");
      const { insertMessage } = await import("@/lib/threads/messages");
      const order: string[] = [];
      (insertBlueprint as ReturnType<typeof vi.fn>).mockImplementation(async () => {
        order.push("blueprint");
      });
      (insertMessage as ReturnType<typeof vi.fn>).mockImplementation(async () => {
        order.push("message");
      });

      const { POST } = await import("@/app/api/tools/remix/run/route");
      const res = await POST(makeRemixRequest({
        url: "https://www.tiktok.com/@creator/video/123", platform: "tiktok",
      }));
      await drain(res);

      expect(order).toEqual(["blueprint", "message"]);
    });

    it("strips blueprintId and still delivers the cards when the insert fails", async () => {
      const card = await arrange(BLUEPRINT_RESULT);
      const { insertBlueprint } = await import("@/lib/remix/blueprint-repo");
      const { insertMessage } = await import("@/lib/threads/messages");
      (insertBlueprint as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("insert failed"));

      const { POST } = await import("@/app/api/tools/remix/run/route");
      const res = await POST(makeRemixRequest({
        url: "https://www.tiktok.com/@creator/video/123", platform: "tiktok",
      }));
      const raw = await drain(res);

      // The run must not die with the row: the cards are the product.
      expect(raw).toContain("event: done");
      expect(insertMessage).toHaveBeenCalled();
      expect((card.props as { blueprintId?: string }).blueprintId).toBeUndefined();
    });

    it("does not call insertBlueprint when the runner produced no blueprint", async () => {
      await arrange(null);
      const { insertBlueprint } = await import("@/lib/remix/blueprint-repo");
      const { POST } = await import("@/app/api/tools/remix/run/route");
      const res = await POST(makeRemixRequest({
        url: "https://www.tiktok.com/@creator/video/123", platform: "tiktok",
      }));
      await drain(res);
      expect(insertBlueprint).not.toHaveBeenCalled();
    });
  });
```

Run: `npm test -- src/app/api/tools/remix/run`
Expected: PASS — the 4 new tests plus every pre-existing test in the file.

- [ ] **Step 7: Typecheck and run the affected suites**

Run: `npx tsc --noEmit && npm test -- src/lib/tools src/app/api/tools/remix`
Expected: PASS, no type errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/tools/runners/remix-runner.ts src/lib/tools/blocks.ts src/app/api/tools/remix/run/route.ts src/lib/tools/runners/__tests__/remix-runner.test.ts
git commit -m "feat(remix): assemble the blueprint in the runner, persist it in the route"
```

---

