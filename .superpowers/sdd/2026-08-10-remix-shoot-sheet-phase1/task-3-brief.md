## Task 3: Widen the adapt contract

**Files:**
- Modify: `src/lib/engine/remix/decode-types.ts:160-217` (`AdaptInput`, `AdaptConcept`)
- Modify: `src/lib/engine/remix/adapt.ts:35-68` (system prompt), `:72-95` (Zod), `:128-160` (user content)
- Test: `src/lib/engine/remix/__tests__/adapt.test.ts` (append)

**Interfaces:**
- Consumes: `SourceBlueprint` from Task 1.
- Produces: `AdaptedBeat` (exported from `decode-types.ts`); `AdaptInput` gains `blueprint: SourceBlueprint` and `target: string | null`; `AdaptConcept` gains `script?: AdaptedBeat[]`.

Critical back-compat notes:

- `AdaptInput.niche` **stays**. `POST /api/remix/adapt` builds `AdaptInput` via `decodeResultToAdaptInput(decode, niche)` and knows nothing about blueprints or briefs.
- Therefore `decodeResultToAdaptInput` must keep its current two-arg signature and supply an **empty blueprint** and `target: null`. Otherwise that route stops compiling.
- `script` is **optional** on `AdaptConcept` and its Zod schema. A model that omits it must still validate, exactly like `production`.

- [ ] **Step 1: Write the failing tests**

```ts
// append to src/lib/engine/remix/__tests__/adapt.test.ts
import { buildAdaptUserContent, ADAPT_SYSTEM_PROMPT } from "../adapt";
import { decodeResultToAdaptInput } from "../decode-types";
import type { SourceBlueprint } from "../blueprint";

const BLUEPRINT: SourceBlueprint = {
  duration_s: 14, words_per_second: 3.2, has_speech: true,
  beats: [
    { index: 0, t_start: 0, t_end: 1.8, duration_s: 1.8, role: "hook",
      spoken: "Your protein shake is making you fatter", on_screen_text: "STOP",
      visual_event: "tight crop, hard cut in", audio_event: "voice starts",
      cuts: 1, weakness: null },
    { index: 1, t_start: 1.8, t_end: 5.4, duration_s: 3.6, role: "setup",
      spoken: "I tracked 400 clients for six months", on_screen_text: null,
      visual_event: "b-roll of shaker", audio_event: "music under",
      cuts: 2,
      weakness: { factor: "pacing", score: 4, tip: "cut 1.2s earlier" } },
  ],
};

describe("adapt input widening", () => {
  it("puts every beat, its duration and its role into the user content", () => {
    const content = buildAdaptUserContent({
      hook_pattern: "h", structure: "s", the_turn: "t", emotional_beat: "e",
      repeatable: [{ label: "cold open", why_repeatable: "" }],
      niche: "fitness", blueprint: BLUEPRINT, target: null,
    });
    expect(content).toContain("HOOK");
    expect(content).toContain("1.8s");
    expect(content).toContain("Your protein shake is making you fatter");
    expect(content).toContain("tight crop, hard cut in");
  });

  it("names the weakness so the model repairs rather than replicates it", () => {
    const content = buildAdaptUserContent({
      hook_pattern: "h", structure: "s", the_turn: "t", emotional_beat: "e",
      repeatable: [], niche: "fitness", blueprint: BLUEPRINT, target: null,
    });
    expect(content).toContain("cut 1.2s earlier");
  });

  it("uses target as the adaptation target when present, not niche", () => {
    const content = buildAdaptUserContent({
      hook_pattern: "h", structure: "s", the_turn: "t", emotional_beat: "e",
      repeatable: [], niche: "fitness", blueprint: BLUEPRINT,
      target: "SaaS onboarding",
    });
    expect(content).toContain("SaaS onboarding");
    expect(content).not.toContain("CREATOR NICHE: fitness");
  });

  it("falls back to niche when target is null", () => {
    const content = buildAdaptUserContent({
      hook_pattern: "h", structure: "s", the_turn: "t", emotional_beat: "e",
      repeatable: [], niche: "fitness", blueprint: BLUEPRINT, target: null,
    });
    expect(content).toContain("fitness");
  });

  it("tells the model to match DURATION, and never mentions matching word count", () => {
    expect(ADAPT_SYSTEM_PROMPT).toMatch(/duration/i);
    expect(ADAPT_SYSTEM_PROMPT).not.toMatch(/match.{0,20}word count/i);
  });

  it("switches to on-screen text when the source has no speech", () => {
    const silent: SourceBlueprint = {
      ...BLUEPRINT, has_speech: false, words_per_second: 0,
      beats: BLUEPRINT.beats.map((b) => ({ ...b, spoken: null })),
    };
    const content = buildAdaptUserContent({
      hook_pattern: "h", structure: "s", the_turn: "t", emotional_beat: "e",
      repeatable: [], niche: "fitness", blueprint: silent, target: null,
    });
    expect(content).toMatch(/no speech|on-screen text only/i);
  });

  it("keeps decodeResultToAdaptInput a two-arg call for /api/remix/adapt", () => {
    const input = decodeResultToAdaptInput(
      {
        beats: [
          { id: "hook_pattern", body: "h", verdict: "present" },
          { id: "structure_pacing", body: "s", verdict: "present" },
          { id: "the_turn", body: "t", verdict: "present" },
          { id: "emotional_beat", body: "e", verdict: "present" },
        ],
        repeatable: ["cold open"],
        luck: [{ category: "algorithmic_outlier", note: "n" }],
      },
      "fitness",
    );
    expect(input.niche).toBe("fitness");
    expect(input.target).toBeNull();
    expect(input.blueprint.beats).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npm test -- src/lib/engine/remix/__tests__/adapt.test.ts`
Expected: FAIL — `buildAdaptUserContent` rejects the extra properties / `target` is not a known property.

- [ ] **Step 3: Add the types in `decode-types.ts`**

Add above `AdaptInput`:

```ts
/** One beat of the creator's own version, written against the source beat at the same index. */
export interface AdaptedBeat {
  /** Matches SourceBlueprint.beats[].index — the beat this line replaces. */
  index: number;
  /** What the creator says. On a no-speech source this stays empty and on_screen_text carries it. */
  spoken: string;
  /** Overlay text for this beat. */
  on_screen_text: string;
  /** How to shoot this beat — framing, camera position, movement. */
  shot: string;
  /** Present only when the source beat was flagged weak and this beat repairs it. */
  repair?: string;
}
```

Extend `AdaptInput` (keep every existing field, including `niche`):

```ts
  /** The creator-profile niche slug/label (ADAPT-02). Fallback when `target` is null. */
  niche: string;
  /**
   * The source's timed structural skeleton (D2/D10, 2026-08-10). Adapt writes one line per beat.
   * D-01 REVERSAL: this carries the source's verbatim `spoken` text, which D-01 deliberately kept
   * out. The topical-echo guard (echo-guard.ts) replaces the compile-time guarantee.
   */
  blueprint: SourceBlueprint;
  /**
   * The creator's brief (D3). When non-empty this IS the adaptation target and `niche` is ignored;
   * null → fall back to `niche`. Exists so a fitness source can be remixed into SaaS onboarding.
   */
  target: string | null;
```

Add the import at the top of `decode-types.ts`:

```ts
import type { SourceBlueprint } from "./blueprint";
```

Extend `AdaptConcept` with an optional `script`:

```ts
  /**
   * The beat-by-beat version of this concept (D2). OPTIONAL for the same reason as `production`:
   * a model that omits it must not fail the 3-concept contract, and `/api/remix/adapt` never asks.
   */
  script?: AdaptedBeat[];
```

Update `decodeResultToAdaptInput` to supply the new fields without changing its signature:

```ts
export function decodeResultToAdaptInput(decode: DecodeResult, niche: string): AdaptInput {
  const beatBody = (id: BeatId): string =>
    decode.beats.find((b) => b.id === id)?.body ?? "";

  return {
    hook_pattern: beatBody("hook_pattern"),
    structure: beatBody("structure_pacing"),
    the_turn: beatBody("the_turn"),
    emotional_beat: beatBody("emotional_beat"),
    repeatable: decode.repeatable.map((label) => ({ label, why_repeatable: "" })),
    niche,
    // `/api/remix/adapt` has no video and no brief — it decodes from a stored DecodeResult.
    // An empty blueprint makes the prompt fall through to the concept-only path.
    blueprint: { duration_s: 0, words_per_second: 0, has_speech: false, beats: [] },
    target: null,
  };
}
```

- [ ] **Step 4: Add the Zod schema in `adapt.ts`**

Insert above `AdaptConceptZodSchema`:

```ts
const AdaptedBeatZodSchema = z.object({
  index:          z.number().int().min(0),
  spoken:         z.string().max(600),
  on_screen_text: z.string().max(300),
  shot:           z.string().min(1).max(600),
  repair:         z.string().max(400).optional(),
});
```

Add to `AdaptConceptZodSchema`, after `production`:

```ts
  // Beat-by-beat script (D2). OPTIONAL for the same reason as production — a model that omits
  // it must not fail the exactly-3 contract. Capped at MAX_BEATS so a runaway response cannot
  // blow the card open.
  script: z.array(AdaptedBeatZodSchema).max(MAX_BEATS).optional(),
```

Import the cap at the top of `adapt.ts`:

```ts
import { MAX_BEATS } from "./blueprint";
```

- [ ] **Step 5: Rewrite the prompt and the user content in `adapt.ts`**

Append to `ADAPT_SYSTEM_PROMPT`, after the existing OUTPUT block:

```
When a TIMED BEAT MAP is supplied, you MUST also return a "script" array with EXACTLY one entry per beat, in the same order:
  "script": [
    {
      "index": <the beat's index, copied>,
      "spoken": "<what the creator SAYS in this beat — empty string when the source has no speech>",
      "on_screen_text": "<overlay text for this beat — empty string when there is none>",
      "shot": "<how to shoot this beat: framing, camera position, movement>",
      "repair": "<only when the beat is marked WEAK: how your version fixes it>"
    }
  ]

SCRIPT RULES:
- Match each beat's DURATION, not its word count. The source's speech rate is given; write a line that takes about as long to SAY as the original beat lasted. A creator who speaks slower than the source needs fewer words, not the same number.
- Keep the same beat count and the same cut rhythm. Do not add beats, merge beats, or reorder them.
- Borrow the SHAPE of each line — its cadence, its sentence structure, where it lands its emphasis. Never borrow its subject. The adapted line must share no topic words with the source line.
- Where a beat is marked WEAK, REPAIR it rather than replicating it, and say what you changed in "repair".
- When the source has NO SPEECH, leave "spoken" as an empty string and carry the beat in "on_screen_text".
```

Replace `buildAdaptUserContent` with:

```ts
export function buildAdaptUserContent(input: AdaptInput): string {
  const repeatableList = input.repeatable
    .map((item, i) =>
      item.why_repeatable
        ? `  ${i + 1}. "${item.label}" — ${item.why_repeatable}`
        : `  ${i + 1}. "${item.label}"`,
    )
    .join("\n");

  // D3: the brief IS the target when present; niche is the fallback, never both.
  const targetLine = input.target
    ? `MAKE IT ABOUT: ${input.target}`
    : `CREATOR NICHE: ${input.niche}`;

  const bp = input.blueprint;
  let beatMap = "";
  if (bp.beats.length > 0) {
    const speechNote = bp.has_speech
      ? `Source speech rate: ${bp.words_per_second} words/second.`
      : `This source has NO SPEECH — carry every beat in on-screen text only.`;

    const rows = bp.beats
      .map((b) => {
        const parts = [
          `  [${b.index}] ${b.t_start.toFixed(1)}–${b.t_end.toFixed(1)}s (${b.duration_s}s) · ${b.role.toUpperCase()}`,
          `      they show: ${b.visual_event}`,
        ];
        if (b.spoken) parts.push(`      they say: "${b.spoken}"`);
        if (b.on_screen_text) parts.push(`      on screen: "${b.on_screen_text}"`);
        if (b.cuts > 1) parts.push(`      cuts inside this beat: ${b.cuts}`);
        if (b.weakness) {
          parts.push(`      ⚠ WEAK (${b.weakness.factor} ${b.weakness.score}/10) — ${b.weakness.tip}`);
        }
        return parts.join("\n");
      })
      .join("\n");

    beatMap = `

TIMED BEAT MAP (${bp.duration_s}s, ${bp.beats.length} beats). ${speechNote}
${rows}

Write a "script" entry for EVERY beat above, in order.`;
  }

  return `VIRAL VIDEO STRUCTURAL ANATOMY:
Hook Pattern: ${input.hook_pattern}
Structure: ${input.structure}
The Turn: ${input.the_turn}
Emotional Beat: ${input.emotional_beat}

Repeatable Format Items (adapt these, not the content):
${repeatableList}

${targetLine}${beatMap}

Generate exactly 3 distinct adapted concepts using the format patterns above.`;
}
```

- [ ] **Step 6: Run the tests and confirm they pass**

Run: `npm test -- src/lib/engine/remix/__tests__/adapt.test.ts`
Expected: PASS — the 7 new tests plus every pre-existing test in the file.

- [ ] **Step 7: Run the whole remix suite plus typecheck**

Run: `npm test -- src/lib/engine/remix && npx tsc --noEmit`
Expected: PASS, no type errors. If `/api/remix/adapt` fails to compile, `decodeResultToAdaptInput` was changed incorrectly — it must stay two-arg.

- [ ] **Step 8: Commit**

```bash
git add src/lib/engine/remix/decode-types.ts src/lib/engine/remix/adapt.ts src/lib/engine/remix/__tests__/adapt.test.ts
git commit -m "feat(remix): adapt writes one line per timed beat, duration-matched"
```

---

