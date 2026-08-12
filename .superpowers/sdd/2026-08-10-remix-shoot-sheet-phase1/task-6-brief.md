## Task 6: Read route + beat renderer

**Files:**
- Create: `src/app/api/remix/blueprint/[id]/route.ts`
- Create: `src/components/thread/remix-beats.tsx`
- Modify: `src/components/thread/remix-card-block.tsx:46-61` (destructure), `:189` (mount)
- Test: `src/components/thread/__tests__/remix-beats.test.tsx`

**Interfaces:**
- Consumes: `getBlueprint()` (Task 4), `blueprintId` on the block (Task 5).
- Produces: `GET /api/remix/blueprint/[id]` → `{ script: AdaptedBeat[][], blueprint: SourceBlueprint }`; `<RemixBeats blueprintId={string} variantIndex={number} />`.

Design-system constraints — the card already spends its one coral on the Borrowed chip, so **the beat rows get no accent**. Timecodes and roles are `text-foreground-muted`; the creator's line is `text-foreground-secondary`; the repair note is muted, never coloured.

- [ ] **Step 1: Write the failing renderer tests**

⚠️ The docblock on the first line is load-bearing. `vitest.config` sets `environment: "node"` by default; a component test without `/** @vitest-environment happy-dom */` fails with `document is not defined`. Every existing test in `src/components/thread/__tests__/` opens with it.

```tsx
/** @vitest-environment happy-dom */
// src/components/thread/__tests__/remix-beats.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { RemixBeats } from "../remix-beats";

const SCRIPT = [[
  { index: 0, spoken: "Your creatine is doing nothing.", on_screen_text: "STOP",
    shot: "waist-up, phone at chest" },
  { index: 1, spoken: "I tested 40 lifters for six weeks.", on_screen_text: "",
    shot: "b-roll, tub on bench", repair: "cuts 1.2s earlier than the original" },
]];

const BLUEPRINT = {
  duration_s: 14, words_per_second: 3.2, has_speech: true,
  beats: [
    { index: 0, t_start: 0, t_end: 1.8, duration_s: 1.8, role: "hook", spoken: "x",
      on_screen_text: null, visual_event: "tight crop", audio_event: "", cuts: 1, weakness: null },
    { index: 1, t_start: 1.8, t_end: 5.4, duration_s: 3.6, role: "setup", spoken: "y",
      on_screen_text: null, visual_event: "b-roll", audio_event: "", cuts: 2,
      weakness: { factor: "pacing", score: 4, tip: "cut earlier" } },
  ],
};

beforeEach(() => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ script: SCRIPT, blueprint: BLUEPRINT }),
  }) as unknown as typeof fetch;
});

describe("RemixBeats", () => {
  it("renders one row per beat with its timecode and role", async () => {
    render(<RemixBeats blueprintId="abc123def456" variantIndex={0} />);
    await waitFor(() => expect(screen.getByText(/0\.0–1\.8s/)).toBeInTheDocument());
    expect(screen.getByText(/HOOK/i)).toBeInTheDocument();
    expect(screen.getByText(/SETUP/i)).toBeInTheDocument();
  });

  it("shows the creator's line, not the source's", async () => {
    render(<RemixBeats blueprintId="abc123def456" variantIndex={0} />);
    await waitFor(() =>
      expect(screen.getByText("Your creatine is doing nothing.")).toBeInTheDocument());
  });

  it("shows the shot instruction for each beat", async () => {
    render(<RemixBeats blueprintId="abc123def456" variantIndex={0} />);
    await waitFor(() =>
      expect(screen.getByText(/waist-up, phone at chest/)).toBeInTheDocument());
  });

  it("surfaces the repair note when the source beat was weak", async () => {
    render(<RemixBeats blueprintId="abc123def456" variantIndex={0} />);
    await waitFor(() =>
      expect(screen.getByText(/cuts 1\.2s earlier/)).toBeInTheDocument());
  });

  it("renders nothing rather than an error when the fetch fails", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 }) as unknown as typeof fetch;
    const { container } = render(<RemixBeats blueprintId="abc123def456" variantIndex={0} />);
    await waitFor(() => expect(container.querySelector("[data-beats]")).toBeNull());
  });
});
```

- [ ] **Step 2: Run and confirm they fail**

Run: `npm test -- src/components/thread/__tests__/remix-beats.test.tsx`
Expected: FAIL — `Failed to resolve import "../remix-beats"`.

- [ ] **Step 3: Implement the GET route**

```ts
// src/app/api/remix/blueprint/[id]/route.ts
/**
 * GET /api/remix/blueprint/[id] — the beat script for a remix card.
 *
 * The card carries only `blueprintId`; the script is fetched. Inlining it on the block would
 * duplicate state that phase 5's revise_remix rewrites, and the copy frozen in the thread
 * message would drift from the row with nothing to detect it.
 */
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getBlueprint } from "@/lib/remix/blueprint-repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!/^[A-Za-z0-9_-]{8,64}$/u.test(id)) {
    return Response.json({ error: "Bad id" }, { status: 400 });
  }

  // Ownership is enforced in the query (id AND user_id), so a valid id belonging to someone
  // else is a 404, not a leak.
  const row = await getBlueprint(createServiceClient(), id, user.id);
  if (!row) return Response.json({ error: "Not found" }, { status: 404 });

  return Response.json({ script: row.script, blueprint: row.blueprint });
}
```

- [ ] **Step 4: Implement `remix-beats.tsx`**

```tsx
"use client";

/**
 * RemixBeats — the beat-by-beat shoot rows on a remix card (phase 1, text only).
 *
 * Phase 3 swaps the leading column for a frame, phase 4 for a clip. The row structure is what
 * those phases upgrade, so it is built as a list of rows from the start rather than prose.
 *
 * No accent: the card already spends its single coral on the Borrowed chip, and the accent
 * dosage rule is at most one accent element visible at a time.
 */
import { useEffect, useState } from "react";
import type { AdaptedBeat } from "@/lib/engine/remix/decode-types";
import type { SourceBlueprint } from "@/lib/engine/remix/blueprint";

interface Payload {
  script: AdaptedBeat[][];
  blueprint: SourceBlueprint;
}

export function RemixBeats({
  blueprintId,
  variantIndex,
}: {
  blueprintId: string;
  variantIndex: number;
}) {
  const [data, setData] = useState<Payload | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const res = await fetch(`/api/remix/blueprint/${blueprintId}`);
        if (!res.ok) return;                       // silent: a missing sheet is not an error state
        const json = (await res.json()) as Payload;
        if (alive) setData(json);
      } catch {
        /* a beat list that cannot load simply does not render */
      }
    })();
    return () => { alive = false; };
  }, [blueprintId]);

  const beats = data?.blueprint.beats ?? [];
  const script = data?.script?.[variantIndex] ?? [];
  if (beats.length === 0 || script.length === 0) return null;

  return (
    <div data-beats className="border-t border-white/[0.06] px-4 py-3">
      <p className="mb-2 text-label uppercase tracking-wide text-foreground-muted">
        Shoot it beat by beat
      </p>
      <ol className="flex flex-col gap-3">
        {beats.map((beat) => {
          const line = script.find((s) => s.index === beat.index);
          if (!line) return null;
          return (
            <li key={beat.index} className="flex flex-col gap-1">
              <p className="text-label text-foreground-muted">
                {beat.t_start.toFixed(1)}–{beat.t_end.toFixed(1)}s · {beat.role.toUpperCase()}
                {beat.cuts > 1 ? ` · ${beat.cuts} cuts` : ""}
              </p>
              {line.spoken ? (
                <p className="text-body leading-relaxed text-foreground-secondary">
                  “{line.spoken}”
                </p>
              ) : null}
              {line.on_screen_text ? (
                <p className="text-label text-foreground-muted">
                  On screen: {line.on_screen_text}
                </p>
              ) : null}
              <p className="text-label text-foreground-muted">Shot: {line.shot}</p>
              {line.repair ? (
                <p className="text-label text-foreground-muted">Fixed: {line.repair}</p>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
```

- [ ] **Step 5: Mount it on the card**

In `remix-card-block.tsx`, add `blueprintId` to the destructure at line 46-61, add the import, and insert the component immediately **after** the `{production && ( … )}` block:

```tsx
      {blueprintId && <RemixBeats blueprintId={blueprintId} variantIndex={0} />}
```

`variantIndex={0}` is correct for phase 1: each ranked concept is its own card and the runner writes one script array per card in rank order. Phase 3 replaces this with the per-card index when the three cards collapse into one ranked sheet.

- [ ] **Step 6: Run the tests and confirm they pass**

Run: `npm test -- src/components/thread && npx tsc --noEmit`
Expected: PASS, 5 new tests, no type errors.

- [ ] **Step 7: Commit**

```bash
git add src/app/api/remix/blueprint src/components/thread/remix-beats.tsx src/components/thread/remix-card-block.tsx src/components/thread/__tests__/remix-beats.test.tsx
git commit -m "feat(remix): fetch and render the beat-by-beat shoot rows"
```

---

