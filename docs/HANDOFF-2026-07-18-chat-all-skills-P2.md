# Handoff — Chat routes ALL skills, P2: /test + profile go FULL in-thread

**Date:** 2026-07-18 · **Branch:** `feat/chat-all-skills` (committed this session) · **Prev:** #325 (request_link seed), this session (account/explore/read generalized)

## Where we are

The `request_link` → in-thread field pattern from #325 is now **generalized to route ALL
input-needing skills**. Chat is a complete agent: type a sentence, it figures out the skill, and if
that skill needs something it asks for it with the right inline field in the thread, then runs the
skill on its own route and drops the result in the same thread.

**DONE + LIVE-VERIFIED this session (real model, dev :3005):**
- **account** — model emits a `kind:"none"` confirm button ("Read my account →"); tap runs
  `/api/account-read` (now persists on `{persist:true}`) → reload surfaces the `account-read` card.
- **read** — model emits a `kind:"text"` field PREFILLED with the concept it extracted; submit POSTs
  `/api/tools/read` → the `multi-audience-read` card lands in-thread. **Proven full end-to-end.**
- **explore** — model emits a `kind:"text"` niche field (prefilled from the sentence, empty allowed);
  submit runs `/api/tools/explore`.
- **remix** — unchanged (the original link field), now flowing through the generic tool.

**Tests:** 27 unit (chat-agent-loop + input-request-block) + 376 thread/tools green. tsc + lint clean.
`/dev/cards` has a row per kind (`in-thread-{link,account,explore,read}`).

⚠️ **HONEST GAP:** the paid submits for **account** (300s Apify) and **explore** (Apify) were
deliberately NOT fired to save cost — field-emission is proven, and the submit→persist→reload
mechanics are proven by read's full run; the paid submits ride the already-proven
account-read/explore routes. A deliberate authorized run is the one confirmation left for those two.

## The generalization (the pattern to extend)

- **SSOT: `src/lib/tools/skill-capabilities.ts`** — `SKILL_CAPABILITIES` map is the ONE place a
  skill's field `kind` + `label`/`placeholder` + model-`when`-guidance live. The block's `action`
  enum and the `request_input` tool's enum both derive from its keys (`SKILL_INPUT_ACTIONS`), so they
  can't drift. **Adding a skill = one entry here + one submit branch in the renderer.**
- **`src/lib/tools/blocks.ts`** — `InputRequestBlockSchema`: `kind: link|text|none`,
  `action: remix|account|explore|read`, + optional `prefill`. Old `{kind:link,action:remix}` blocks
  still validate byte-identically. **This is where a new kind/action lands.**
- **`src/lib/tools/chat-agent-loop.ts`** — `REQUEST_INPUT_TOOL` (replaced `REQUEST_LINK_TOOL`) +
  the `request_input` handler branch: looks up the capability, caps a model-supplied `value` into
  `prefill` (text kinds only), emits the block via `onBlock` AND returns it in `uiBlocks` so the chat
  route PERSISTS it (else the field vanishes on the post-turn reload — the #325 bug).
- **`src/components/thread/input-request-block.tsx`** — top-level switch on `action` → 4 per-action
  sub-components (`RemixField`/`ExploreField`/`ReadField`/`AccountField`). **Each calls exactly ONE
  stream hook** (React rule) — that is why it is split, not one big component. `account` is a confirm
  BUTTON, not a field. **A new kind grows one sub-component here.**
- **`src/lib/in-thread-input-context.ts`** — the seam callback is now `onComplete` (was
  `onLinkComplete`); composer binds it to `reloadChatThread`.
- **`/api/account-read`** — persists to the open thread ONLY on `{persist:true}` (chat field sends it;
  account TOOL sends no body → unchanged). `useAccountReadStream.start({persist})` carries the flag.

## Owner decisions (locked this session)

- **/test → FULL in-thread** (owner: "smoothest experience if everything happens directly in thread").
  NOT the navigate-to-/analyze shortcut. Build the real-video test to render its result IN the thread.
- **profile** — owner leans "everything in thread" too, BUT it WRITES a General audience
  (`bakeProfileSignature`). It must not silently mutate the audience from a chat sentence — needs an
  explicit confirm affordance before it runs. Treat as its own careful step, after /test.

## Remaining work

### 1. The `upload` kind (needed by /test video + profile)
- Widen `blocks.ts`: `kind` gains `"upload"`.
- New `SKILL_CAPABILITIES` entries: `test` (kind can be `link` for a TikTok URL OR `upload` for a
  file — decide; probably support BOTH via two paths) and later `profile` (kind `upload`).
- Renderer: an `UploadField` sub-component. **Reuse the PROVEN upload path in `composer.tsx`
  `handleProfileSubmit` (L1167):** stage the file to Supabase storage `.from('videos')` →
  post the `storagePath` to the route (the route re-validates — client check is UX only). Also reuse
  `VideoUpload`'s MP4/MOV + 200MB validation. The `useAnalysisStream`/analyze SSE gives the progress
  spine.

### 2. /test in-thread (the meaty one — needs a design/research pass first)
- **Today:** composer `activeTool:"test"` → upload/TikTok-URL → `useAnalysisStream` → `POST /api/analyze`
  → `navigate to /analyze/[id]` (the rich Max-model real-video page: filmstrips, per-frame perception,
  overrides). That surface CANNOT live in a thread card as-is.
- **In-thread needs a new dedicated 300s route** (e.g. `/api/tools/test/run`) that runs the real-video
  analyze pipeline but EMITS A THREAD CARD (per the handoff table: `multi-audience-read`) + persists it,
  instead of creating an /analyze page. **Research `/api/analyze` + the analyze pipeline first**: what
  it outputs, whether it can produce a `multi-audience-read`-shaped result (audience reaction to the
  video), and what is lost vs the full /analyze page (be honest about the tradeoff — do NOT fabricate a
  card that claims less-analyzed depth than /analyze gives).
- Field: `request_input({action:test})` → the upload/link field collects the video → submit runs the
  new route → reload surfaces the card. Same persist+reload mechanics as read/explore/remix.
- **Open question for the owner if it gets expensive:** is a thread `multi-audience-read` card an
  acceptable representation of a real-video test, or do they still want a link OUT to the full /analyze
  page for depth? (You recommended keeping /analyze; owner chose in-thread — so build in-thread, but
  surface the tradeoff if the card can't carry the analysis honestly.)

### 3. profile in chat (after /test)
- `request_input({action:profile})` → `upload` field → `POST /api/tools/profile` (persists a
  `profile-read` block already). **Guard the side-effect:** the model/field must make it explicit that
  this BUILDS/updates the General audience — a confirm step, not a silent write. Owner sign-off before
  shipping.

### 4. Fire the deferred paid submits once (authorized)
- One deliberate account read + one explore pull through the chat field, to close the honest gap above.

## Guardrails to keep
- **Heavy skills use their own 300s route**, never inline in the chat route (no extended budget).
- **Persist the field** (`uiBlocks`) or it vanishes on the post-turn reload.
- **No model-generated UI** — kind/label/placeholder come from `SKILL_CAPABILITIES`; the model only
  chooses the action (+ an optional prefill VALUE for text fields, which is capped + user-editable).
- **Paid leash** — every paid dispatch counts against `maxSkillRuns`; a paid run fires on a user
  gesture (submit/tap), never on a block render (D-05 honesty spine).
- **Side effects are explicit** — profile writes an audience; never silent.

## How to run / verify (same as this session)
- Dev server (this worktree): `NODE_OPTIONS='--max-old-space-size=3072' node ./node_modules/next/dist/bin/next dev --turbopack -p 3005`
- Tests (real binary — `npm test` prints fake results): `node ./node_modules/vitest/vitest.mjs run <file>`
- Live pass: `/dev/cards` is the cheap visual gate (add a row per new kind); then a real authed browser
  turn per skill on :3005 — prove the model emits the right field AND the skill runs. The throwaway
  account already has an authed session in the Playwright profile.
- ⚠️ dev mock toggle 503s chat (no fixture) — keep Mock OFF while testing chat.

## Copy-paste for the fresh session

> Continue the chat-as-agent work on branch `feat/chat-all-skills`. Account/explore/read now route via
> the generalized `request_input` in-thread field (SSOT `src/lib/tools/skill-capabilities.ts`) and are
> live-verified. **Read `docs/HANDOFF-2026-07-18-chat-all-skills-P2.md` first** — it has the full
> pattern + the remaining plan. Owner decided **/test must run FULL in-thread** (not the navigate-to-
> /analyze shortcut). Next: (1) add the `upload` field kind, reusing composer `handleProfileSubmit`'s
> Supabase-storage staging; (2) build /test in-thread — first RESEARCH `/api/analyze` + the analyze
> pipeline, then a new dedicated 300s route that runs the real-video analysis and emits a
> `multi-audience-read` card in the thread (be honest about what a card can vs can't carry vs the full
> /analyze page — surface the tradeoff to the owner if it can't carry the depth); (3) profile in chat
> (an `upload` field → /api/tools/profile) but ONLY behind an explicit confirm, since it WRITES a
> General audience — owner sign-off before shipping. Keep the guardrails: heavy skills on their own
> 300s route, persist fields in `uiBlocks`, no model-generated UI, paid leash, side effects explicit.
> Unit-test each branch, then a LIVE authed browser pass on :3005. Also worth one authorized paid
> submit through the account + explore chat fields to close the one honest gap (their Apify submits
> weren't fired to save cost). Then commit + open the PR for the whole `feat/chat-all-skills` branch.
