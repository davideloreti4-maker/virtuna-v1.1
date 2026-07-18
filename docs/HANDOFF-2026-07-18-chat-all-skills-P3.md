# Handoff — Chat routes ALL input skills; P3: /test in-thread SHIPPED, profile is next

**Date:** 2026-07-18 · **Branch:** `feat/chat-all-skills` (merged to main via **PR #331**) · **Prev:** P2 (`docs/HANDOFF-2026-07-18-chat-all-skills-P2.md`)

## Where we are

The chat-as-agent goal is **done for every input-needing skill except profile**. Type a sentence in the
/home chat → the agent picks the skill → if it needs input it surfaces the right inline field in the
thread (`request_input`) → the skill runs on its OWN route and drops its result card in the SAME thread.
No tool-switch, no navigate-out ("all skills 1:1 in thread").

**Routed in-thread + live-verified:** remix (link) · account (confirm button) · explore (niche text) ·
read (concept text) · **test (video upload/URL — NEW this session)**.

**Held:** profile (writes an audience — see Remaining work).

## What shipped this session — /test in-thread

A real-video Test now lands a card in the thread like every other skill. The FULL frame-by-frame
`/api/analyze` **Max** pipeline runs UNCHANGED underneath — its paid 300s leash + billing stay upstream;
this session added only a thin adapter + a card + the field.

**The honesty finding that reshaped the plan:** the P2 handoff said emit a `multi-audience-read` card for
/test. That card is hardcoded `model: z.literal("sim1-flash")` — a Flash *text-concept* provenance. A real
video runs the **Max VIDEO** tier (`sim1-max`); feeding it into a `sim1-flash` card would be a provenance
lie. So a NEW `video-test-card` was built instead. **Lesson: read the schema before reusing a card.**

### The files (the pattern to extend / maintain)

- **`src/lib/tools/skill-capabilities.ts`** — added `test` (`kind:"upload"`). Still the ONE place a skill's
  field kind + copy + model-`when`-guidance live; the block `action` enum + the `request_input` tool enum
  derive from its keys.
- **`src/lib/tools/blocks.ts`** — `InputRequestBlockSchema` widened: `kind: link|text|none|upload`,
  `action: remix|account|explore|read|test`. Old blocks validate byte-identically.
- **`src/lib/tools/profile-blocks.ts`** — NEW `VideoTestCardBlockSchema` (`model:"sim1-max"`, `.strict()`,
  bands-only — the schema REJECTS a smuggled `overall_score`/0-100). `verdict` is `HeroBlock.verdict_line`
  (a WORD — "High potential"/"Solid contender"/"Needs work"/"Don't post yet", which already carries the
  post/don't-post call, so there is NO separate go/no-go chip on the face).
- **`src/lib/tools/video-test-card.ts`** — the pure mapper `predictionResultToVideoTestCard`. Reads a
  narrow `VideoTestSource` (a full PredictionResult OR a row-assembled slice both satisfy it). band +
  fraction + reactions are **DERIVED from the real `persona_simulation_results`** (a persona "stopped" iff
  `scroll_past_second >= 3` — the ~3s hook window — using the SAME flash STRONG/MIXED thresholds). Room
  anchor (`conceptText`) = the video's `verbatim.hook`. **NO per-persona results → returns `null`** → the
  caller degrades to a link-out (never fabricates a crowd).
- **`src/components/thread/video-test-card-block.tsx`** — the renderer, built on the SHARED skill-card
  spine (`card-primitives.tsx` `CardEyebrow`/`CardActionBar` + `ProofUnit`) so it is **1:1 with the
  hook/idea/script/remix cards** (owner gave two rounds of "must be 1:1" feedback; verified via
  `card.className === hookCard.className` on /dev/cards). Cream primary = "See the full breakdown →" to
  `/analyze/[id]` (the depth a card can't hold — filmstrips/verbatim/Apollo — one door away).
- **`src/app/api/tools/test/card/route.ts`** — the thin adapter. Auth → loads the persisted, scored row
  (RLS-scoped; a forged id 404s) → 409 if still running → resolves the active audience (thread pin) →
  maps → `insertMessage` to the open thread. `/api/analyze` is UNTOUCHED.
- **`src/components/thread/input-request-block.tsx`** — new `UploadField` sub-component (a video FILE drop
  via `VideoUpload`, OR a TikTok URL). Stages the file to Supabase storage (the proven composer path),
  runs `/api/analyze` via `useAnalysisStream`, and on `complete` POSTs the analysisId to the card route,
  then `onComplete()` reloads. A degraded/failed card build falls back to the /analyze link-out.

**Tests:** +35 (loop upload branch, mapper honesty + derivation + band thresholds + conceptText, card
route auth/404/409/degrade, upload-field flow) + /dev/cards fixtures. tsc + lint clean. Live-verified
render on `/dev/cards` (authed; the "Video Test card (test)" + "In-thread video field (test)" rows).

## Remaining work

### 1. profile in chat (HELD — its OWN reviewed change)
- `request_input({action:profile})` → an `upload` field → `POST /api/tools/profile` (persists a
  `profile-read` block). The `upload` kind + the UploadField pattern already exist — profile can reuse them.
- **The reason it's held:** profile WRITES a General audience (`bakeProfileSignature`). A chat sentence must
  NOT silently mutate the audience. It needs an **explicit confirm affordance** — "This will build/update
  your General audience. Continue?" — before it runs, plus owner sign-off. Do NOT add `profile` to
  `SKILL_CAPABILITIES` until that confirm exists (adding it there routes the model to it = ships it).

### 2. Fire the deferred paid live runs once (authorized)
- **/test E2E:** one real Max video analysis through the chat upload field on :3005 (proves the new path
  end-to-end; the code is fully unit-tested + rides the proven `/api/analyze` path, but no paid run was
  fired to save cost).
- **account + explore:** one deliberate account read + one explore pull through their chat fields (the
  P2-deferred gap — their Apify submits were never fired live; they ride proven routes).

## Guardrails to keep (unchanged)
- **Heavy skills use their own route** (never inline in the chat route — no extended budget). /test reuses
  `/api/analyze` (already a 300s route); the card adapter is cheap and separate.
- **Persist the field** (`uiBlocks`) or it vanishes on the post-turn reload.
- **No model-generated UI** — kind/label/placeholder come from `SKILL_CAPABILITIES`; the model only chooses
  the action (+ an optional prefill for text fields).
- **Paid leash** — a paid run fires on a user gesture (submit/tap), never on a block render.
- **Side effects are explicit** — profile writes an audience; never silent.
- **Honesty spine** — thread cards are bands/WORDS only, never a 0-100 number. Provenance (`sim1-flash` vs
  `sim1-max`) must match what actually ran. Read a card's schema before reusing it.

## How to run / verify
- Dev server: `NODE_OPTIONS='--max-old-space-size=3072' node ./node_modules/next/dist/bin/next dev --turbopack -p 3005`
- Tests (real binary — `npm test` prints fake results): `node ./node_modules/vitest/vitest.mjs run <file>`
- `/dev/cards` is the cheap visual gate (a row per kind + the video-test-card). ⚠️ dev mock toggle 503s chat.
- ⚠️ **Stale-branch lesson (again):** this branch sat 35 commits behind main (the ambient-room milestone).
  GitHub said MERGEABLE/CLEAN, but main had changed `proof-unit.tsx` + `message-blocks.tsx` (my deps). The
  merge was done LOCALLY + re-tested (611 green) BEFORE merging out — always `git diff origin/main...HEAD
  --stat` and merge-in-and-retest, don't trust "mergeable".

## Copy-paste for the fresh session

> Chat-as-agent now routes ALL input skills in-thread EXCEPT profile — remix/account/explore/read/test all
> land their card in the /home thread via the generalized `request_input` field (SSOT
> `src/lib/tools/skill-capabilities.ts`). `/test` shipped this session (PR #331, merged): the full
> `/api/analyze` Max pipeline runs untouched, and a thin `/api/tools/test/card` adapter maps the persisted
> row → a `video-test-card` (sim1-max, bands-only, 1:1 with the skill cards). Read
> `docs/HANDOFF-2026-07-18-chat-all-skills-P3.md` first. Next: (1) build **profile in chat** as its OWN
> change — an `upload` field → `/api/tools/profile`, behind an EXPLICIT "this builds/updates your General
> audience" confirm (never route it silently; needs owner sign-off — it mutates the audience); (2) fire the
> deferred paid live runs once (authorized): one real /test Max analysis + one account read + one explore
> pull through the chat fields. Keep the guardrails: heavy skills on their own route, persist fields in
> `uiBlocks`, no model-generated UI, paid leash, side effects explicit, honesty spine (bands-only,
> provenance must match what ran).
