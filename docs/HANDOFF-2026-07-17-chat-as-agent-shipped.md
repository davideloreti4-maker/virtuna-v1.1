# Handoff — Chat-as-agent SHIPPED (2026-07-17)

**Status: ✅ MERGED to `main` (PR #316, squash `4a648e83`) and ACTIVATED (flags default-on).**
This handoff closes out the chat-as-agent milestone. Nothing here is blocking; it's the record + the
next-step menu.

SSOT (full detail, on `main`): `docs/CHAT-AS-AGENT-2026-07-16.md` §4h–§4k.
Memory: `chat-as-agent-premium-pass.md`.

---

## 1. What shipped

The `/home` chat box is now a **streaming agent**. You talk, and it either answers conversationally or
**dispatches a real generator skill** (ideas / hooks / script) whose cards render inline in the same
thread. On by default — no manual skill selector needed for the generator path.

- **Eager generator dispatch** — ideas/hooks/script fire on the first clear "make X" ask (the old
  behavior deferred with "do you want cards or a chat opinion?"). Anti-slop pushback is preserved for
  vague/generic asks (a bare "give me morning-routine ideas" still asks for a sharper angle first).
- **Anti-hallucination** — the model never claims a card is "on screen" unless a tool actually ran that
  turn. (Before the fix, simulate/predict fabricated a phantom reaction/gauge card.)
- **simulate/predict REMOVED from chat dispatch** — they were audience-tier ineligible (see §3). Dropped
  the two `SKILL_TOOLS` entries + the orphaned analysis helpers + the forced-tool-choice machinery.
  **The standalone `/api/tools/{simulate,predict}` selector routes + runners are UNTOUCHED** — those
  skills still exist for the "Test a video" surface; they're just not reachable from chat.
- **Flags default-on** — `isChatAgentDispatchEnabled()` / `isCorpusChatToolEnabled()` now return
  `process.env.X !== "false"`. Set `CHAT_AGENT_DISPATCH="false"` / `GROUNDING_CHAT_TOOL="false"` to
  disable.

Files: `src/lib/tools/chat-agent-loop.ts` (the loop + directive), `src/lib/tools/skill-dispatch.ts` (the
registry), `src/app/api/tools/chat/route.ts` (flags + wiring). Tests in the sibling `__tests__/` dirs.

## 2. Verification (real browser, mock OFF, real engine)

- "Give me 3 ideas for budget meal-prep for broke college students" → **4 real idea-cards** (generator
  path intact), co-pilot closing line.
- "Test how my audience would react to this hook: …" → a clean conversational read, **no phantom card**
  (simulate cleanly gone; anti-hallucination holds).
- **151 tests green** across the touched + integration areas. tsc: the 4 grounding baseline errors are
  now FIXED (main's #313 came in with the merge). 0 console errors.

## 3. The simulate/predict blocker (why they're out of chat) — a real, pre-existing product gap

The default **"General" audience is `mode:"socials"`** (`audience-repo.ts:47`, the "PITFALL 1 collision
trap" — the General default runs the SOCIALS pack) → `resolveTier` returns **Validated**. But
`simulate`/`predict` **require a Directional audience** (`resolveTier(audience) !== "Directional"` → the
guard throws / the routes 400). **Every audience in the creator's switcher is Validated** (General,
Growth, Conversion); the only Directional (`mode:"general"`) audiences are the Analyst/Hiring
GENERAL_TEMPLATES, which aren't surfaced there. So simulate/predict **cannot render a card for a normal
creator account via chat OR the selector routes** — this is a product/audience-eligibility gap,
independent of the chat work. Owner call needed if they should come back to chat.

## 4. How to run / verify (for the next session)

- **Dev server:** `cd ~/virtuna-explore-c && npm run dev` (port 3000; `rm -rf .next` if CSS is stale).
  If a background `next dev` keeps getting killed by later commands, detach it (Python
  `os.fork()`+`os.setsid()`+`subprocess.Popen`, log to a scratchpad file) — see memory `dev-server-launch`.
- **Login** (throwaway dev account, onboarding complete): `maven-e2e-2026@example.com` / `TestMaven-123!`.
- ⚠️ **Turn Mock OFF before testing chat** — the ⚙ (bottom-right) DevMockPanel → "Mock skills" OFF (or
  clear the `numen_mock` cookie). Mock ON makes chat 503 with a misleading "rephrase" error (the chat
  skill has no fixture; dev-only, prod hard-gates mock off).
- **Tests:** `node ./node_modules/vitest/vitest.mjs run <paths>` (NOT `npm test`).
- **Playwright screenshots hang** on this app — verify via `browser_snapshot` / `getComputedStyle`, poll
  the DOM for card action buttons, and read chat POST latency from the dev log (a real skill run is
  20–65s; a pure-chat completion is 4–13s — the latency is the tell for whether a tool fired).
- ⚠️ This worktree is missing the `@gltf-transform` devDep that main's #315 added to the lockfile, so a
  full local `tsc` shows 5 errors in `brain/cortex-field.test.ts`. Run `pnpm install` here to clear it;
  CI/Vercel install from the lockfile, so the build/prod are unaffected.

## 5. Remaining follow-ups (ranked, none blocking)

1. **Watch the prod Vercel deploy** the #316 merge triggered — confirm it went green.
2. **Retire the tool selector** once the chat path is prod-proven (kept for now per the guardrail).
3. **Clean up** the throwaway test account (`maven-e2e-2026@example.com`) + the seeded mock threads it
   accumulated during testing.
4. **simulate/predict eligibility** — product decision: make the default socials "General" eligible, or
   surface a Directional (Analyst/Hiring) panel in the switcher, if these should return to chat.
5. Polish: skill-dispatch **progress spine** (the ~1min run shows only typing dots; `chat.stages` are
   already emitted), a formal **corpus-citation card** (model already cites in prose), and **read/profile
   as tools** (needs `supabase` on the skill context; profile WRITES an audience — an owner call).

## 6. Copy-paste for a fresh session

```
Chat-as-agent is SHIPPED + merged to main (PR #316, squash 4a648e83) and default-on. Repo: Virtuna.
The /home chat dispatches ideas/hooks/script inline as real cards; anti-hallucination + eager dispatch.
simulate/predict were REMOVED from chat (audience-tier ineligible — see below).

READ FIRST: docs/CHAT-AS-AGENT-2026-07-16.md §4h–§4k (SSOT, on main) + docs/HANDOFF-2026-07-17-chat-as-
agent-shipped.md. Memory: chat-as-agent-premium-pass.md.

This milestone is DONE. Pick from the remaining follow-ups (none blocking):
  (1) confirm the #316 prod Vercel deploy is green
  (2) retire the tool selector once prod-proven
  (3) clean up the throwaway test account (maven-e2e-2026@example.com) + seeded mock threads
  (4) simulate/predict eligibility — product call: make the default socials "General" Directional-
      eligible, or surface an Analyst/Hiring panel in the switcher, if they should return to chat
  (5) polish: skill-dispatch progress spine · corpus-citation card · read/profile as tools

HOW TO RUN: npm run dev (:3000). Login maven-e2e-2026@example.com / TestMaven-123!. TURN MOCK OFF (⚙
bottom-right → "Mock skills" off) before testing chat or it 503s. Tests:
node ./node_modules/vitest/vitest.mjs run <paths> (NOT npm test). Playwright screenshots hang — verify
via browser_snapshot/DOM polling + chat POST latency (20–65s = a real skill ran; 4–13s = pure chat).
⚠️ run `pnpm install` in the worktree if tsc flags missing @gltf-transform (main #315 lockfile devDep).
```
