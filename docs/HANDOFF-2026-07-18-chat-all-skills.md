# Handoff — Chat routes ALL skills, asks for what it needs (in-thread UI)

**Date:** 2026-07-18 · **Base:** `main` @ `d4c71736` (PR #325 merged) · **Prev session PR:** #325

## The goal for the next session

Make the /home chat a **complete agent**: you type a plain sentence, it figures out which skill
you want, and if that skill still needs something (a link, a video, a niche), it **asks for it with a
nice inline field right in the thread** — then runs the skill and drops the result in the same thread.

Target the skills chat does NOT yet route: **`/test`, `/explore`, `/account`** (and the text `/read`).
This is a direct generalization of the `request_link` → in-thread field pattern that shipped in #325.

---

## What already shipped (#325) — the pattern to generalize

Chat is a single streaming agent loop (`src/lib/tools/chat-agent-loop.ts`, `runChatAgentStream`). Today
it binds **3 generators** (ideas/hooks/script) as tools + `search_corpus` + **`request_link`**.

`request_link` is the seed of the whole "ask for missing input" idea:
1. The model calls `request_link` when the creator wants to remix a video but gave no URL.
2. The loop emits an **`input-request` block** (a validated block type — `src/lib/tools/blocks.ts`)
   via `onBlock`, AND returns it in `result.uiBlocks` so the chat route **persists** it.
3. `InputRequestBlockRenderer` (`src/components/thread/input-request-block.tsx`) renders an inline
   field. On submit it runs Remix via the dedicated `/api/tools/remix/run` route (300s — the chat
   route has NO extended budget, so heavy skills MUST use their own route), then calls
   `InThreadInputContext.onLinkComplete` → the composer reloads the thread and the card lands in-place.

**Files that make up the pattern (read these first):**
- `src/lib/tools/chat-agent-loop.ts` — the loop, the `REQUEST_LINK_TOOL`, the tool-use directive, and
  the `request_link` handling branch (emits the field, pushes a tool result).
- `src/lib/tools/blocks.ts` — `InputRequestBlockSchema` (`kind:"link"`, `action:"remix"`, label,
  placeholder, platform). **This is the enum to widen.**
- `src/lib/tools/block-registry.ts` + `src/components/thread/message-blocks.tsx` — where a block type
  is registered + mapped to its renderer.
- `src/components/thread/input-request-block.tsx` — the field renderer (uses `useRemixStream` +
  `InThreadInputContext`). **This grows a branch per input kind.**
- `src/lib/in-thread-input-context.ts` — the composer→block reload seam.
- `src/app/api/tools/chat/route.ts` — persists `agentResult.uiBlocks`; stamps `origin:"chat-agent"`.
- `src/components/app/home/composer.tsx` — `reloadChatThread`, `InThreadInputContext.Provider`,
  `sendChatFollowup`.
- `src/components/app/home/rehydrate-thread.ts` — `isChatAgentThread` also treats `input-request` as a
  chat-agent marker (so a text-less request turn still reloads in the chat view).

---

## The generalization design (proposed)

**1. Widen the `input-request` block** (`blocks.ts`):
```
kind:   "link" | "upload" | "text" | "none"
action: "remix" | "test" | "explore" | "account" | "read" | ...   (the skill to run on submit)
```
Keep `label`/`placeholder` **server-set** (no model-generated UI — the model only chooses to ask).

**2. One request tool, not five.** Replace/extend `request_link` with a generic
`request_input({ action })` in the loop. The loop looks up a small **capability map** (below) to decide
the `kind` + copy, emits the right `input-request` block, and tells the model to prompt for it. A skill
whose `needs` is `"none"` doesn't get a field at all — the loop just runs it (see `/account`).

**3. A skill-capability map** (new SSOT, e.g. `src/lib/tools/skill-capabilities.ts`):
| skill | needs | field kind | runs via | result block |
|-------|-------|-----------|----------|--------------|
| ideas/hooks/script | topic (in message) | — (dispatch now) | inline generators | idea/hook/script-card |
| remix | a video link | `link` | `/api/tools/remix/run` (300s) | remix-card ✅ done |
| **account** | nothing | `none` → just run | `POST /api/account-read` (bodyless) | account-read |
| **explore** | niche (optional) | `text` (or run un-niched) | `runExplorePipeline` / `/api/tools/explore` | outlier-grid |
| **read (text)** | a concept/draft (often in message) | `text` | `POST /api/tools/read` ({concept}) | multi-audience-read |
| **test (video)** | a real video | `upload` or `link` | the heavy /analyze pipeline | multi-audience-read |
| profile | an uploaded clip/text | `upload` | `POST /api/tools/profile` | profile-read (⚠ writes an audience) |

**4. `InputRequestBlockRenderer` grows a branch per kind:**
- `link` → text input (done).
- `text` → a small textarea (niche / concept).
- `upload` → a file dropzone. **Reuse the proven upload path** in `composer.tsx`
  `handleProfileSubmit`: stage the file to Supabase storage → post the `storagePath` to the route.
- On submit each kind runs its skill's route/runner, then `onLinkComplete()` (rename to
  `onComplete()`) reloads the thread.

---

## Per-skill notes & decisions the owner should make

- **`/account`** — easiest. No input. Add it as a dispatchable tool that runs `POST /api/account-read`
  (bodyless) and streams the `account-read` block inline. No field needed.
- **`/explore`** — light. Add a dispatchable tool with an optional `niche`. If the creator names a
  niche in the sentence, run immediately; if they're vague ("show me what's working"), either run
  un-niched OR pop a small `text` field to collect the niche. `runExplorePipeline` takes
  `{ mode:"niche", normalizedInput, ... }` → `outlier-grid` block.
- **`/read` (text concept)** — chat-native. The concept is usually already in the message
  ("what would my audience think of: …"). Add a `read_concept` tool with a `concept` arg → `POST
  /api/tools/read` → `multi-audience-read` block. A `text` field only when the ask is bare.
- **`/test` (real video)** — the hard one. **DECISION NEEDED:** Test today *navigates* to `/analyze`
  and runs the heavy real-video pipeline. Options: (a) keep the navigate (the field collects the
  video, then routes to /analyze); (b) bring it in-thread behind a dedicated 300s route like remix,
  rendering `multi-audience-read` in the thread. (b) matches the "one thread" vision but is more work.
- **`profile`** — side-effecting (it WRITES a General audience via `bakeProfileSignature`). Needs an
  owner call before it becomes a chat tool (a chat message shouldn't silently mutate the audience).
- **simulate/predict** — still excluded (audience-tier ineligible; need a Directional audience path).
  See `docs/CHAT-AS-AGENT-2026-07-16.md` §4j. Out of scope unless the owner wants it.

## Guardrails to keep
- **Heavy skills use their own 300s route**, never inline in the chat route (no extended budget).
- **Paid leash**: every new paid dispatch counts against `maxSkillRuns` (default 2/turn).
- **Persist the field** (`uiBlocks`) or it vanishes on the post-turn reload (the #325 bug).
- **No model-generated UI**: the model only chooses to ask; the loop sets the field kind + copy.
- **Verify for real**: unit-test the loop branch + renderer, then a LIVE browser pass per skill
  (dev server, authed) — a real-model ask must actually emit the right field and run the skill.
  `/dev/cards` is the cheap visual gate; add a gallery row per new field kind.

## How to run / verify (same as this session)
- Dev server (this worktree): `NODE_OPTIONS='--max-old-space-size=3072' node ./node_modules/next/dist/bin/next dev --turbopack -p 3005`
- Tests (use the real binary — `npm test` prints fake results): `node ./node_modules/vitest/vitest.mjs run <file>`
- Login for `/dev/cards` (auth-walled): seeded `e2e-test@virtuna.local` / `e2e-test-password-2026`.
- The throwaway account already has an authed browser session in the Playwright profile.

---

## Copy-paste for the fresh session

> Continue the chat-as-agent work. #325 shipped context-aware follow-up chips + an agent-surfaced
> **in-thread input field** for Remix (`request_link` → `input-request` block → `/api/tools/remix/run`
> → reload). Now **generalize that pattern so chat routes ALL skills and asks for whatever it still
> needs via a nice inline field** — specifically `/test`, `/explore`, and `/account` (plus the text
> `/read`).
>
> Read `docs/HANDOFF-2026-07-18-chat-all-skills.md` first (full design + per-skill plan + the files).
> Plan of attack: (1) widen the `input-request` block to `kind: link|upload|text|none` and add a
> skill-capability map; (2) replace `request_link` with a generic `request_input({action})` in
> `chat-agent-loop.ts`; (3) wire the easy wins first — `/account` (no input, just run) and `/explore`
> (optional niche text field); (4) then the `text` `/read` (concept) field; (5) the `upload` field
> reusing composer's Supabase-storage upload path; (6) hold `/test` (real video) for an owner decision
> on navigate-vs-in-thread, and hold `profile` (it writes an audience). Keep the guardrails: heavy
> skills use their own 300s route (never inline in the chat route), persist fields in `uiBlocks`, no
> model-generated UI, paid leash. Unit-test each branch, then do a LIVE authed browser pass per skill
> on the dev server (`:3005`) — prove the model emits the right field and the skill runs. Ask me
> before the `/test` and `profile` calls.
