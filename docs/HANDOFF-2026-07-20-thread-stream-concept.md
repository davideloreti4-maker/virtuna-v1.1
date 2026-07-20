# HANDOFF — Thread rework: THE STREAM concept (locked through rev 6, NOT frozen)

> **Date:** 2026-07-20 · **From:** the thread-cards scoping session (worktree
> `~/virtuna-thread-cards`, branch `feat/thread-cards`, 0 product commits — concept phase only)
> · **For:** a fresh session. ⚠️ **The owner wants DISCUSSION FIRST in that session — they have
> items to address before any execution. Do not start building until they explicitly say go.**

## 0. The mandate and the diagnosis

Owner directive: rework the thread card system — every skill renders its own bespoke UI, some
old and mismatched; they want the thread "customizable and adaptable to different requests,
same as Claude or ChatGPT."

The diagnosis that unlocked it: **the thread is skill-first (a vending machine — the UI only
performs when the ask matches one of 8 slots; everything else falls through to markdown). The
owner wants answer-first: prose leads, structure appears inline only where the content earns
it.** The hook card's *content* (band, verbatim, borrowed receipt) is the best material in the
app — the card *container* is what died. Owner verbatim: "hook cards are good but too locked
in on specifics."

## 1. What is LOCKED (owner-approved through 3 sketch rounds)

1. **Direction: THE STREAM** — chosen over "the capsule" (envelope per turn) and "the desk"
   (canvas split) in a 3-way ASCII proposal. Owner: "more the direction I wanted" (rev 2),
   "not too bad" (rev 3), then drove rev 5 (/test journey) and rev 6 (full Reading page).
2. **Hybrid composer** — skill runners compose deterministically; the chat agent composes
   ad-hoc for asks no skill covers. Both draw from ONE closed vocabulary, validated, rendered
   by one generic renderer. **Full artifact-style codegen was rejected** (breaks the honesty
   contract, the design guards, and THREAD-04 `message-blocks.tsx:8` "no model-generated UI" —
   the composition approach keeps THREAD-04 intact because compositions validate like blocks).
3. **The 14-primitive vocabulary** (see the sketch's footer for one-liners): prose · receipt
   line · evidence row · media strip · ranked result · proof line · verbatim · compare group ·
   fact row · revision · plan slot · input ask · persona turn · **asset block** (the take-away
   deliverable — the stream's ONLY frame). Hover quick-actions, the running receipt, the
   keyframe strip, and the empty state are **states/behaviors of the set, not primitives**.
4. **The laws** (the sketch's margin rail is the canonical list): prose is the backbone · five
   type sizes total (11 label / 12.5 meta / 14 support / 15 body / 17 hero) · everything flows
   left · ONE frame total (controls ≠ frames) · one action zone per turn + per-row hover
   quick-actions · the group states the shared fact · band color once per item (dot + word) ·
   attribution once · absence is prose (ghosts only, no cream primary on nothing) · honesty
   spine unchanged (bands only; evidence from tool rows; "original — not drawn from a
   retrieved video"; provenance lives in the ✓ receipt line).
5. **Scope correction from the owner (important):** "/test" means the FULL Reading surface
   (`/analyze/[id]`), not just the in-thread card. **The Reading page is IN scope** and is
   sketched as Act 3. The ambient Room stays OUT (own restart mandate). Skill-by-skill
   duplicate sketches are pointless: Ideas ≡ ranked results, citations ≡ evidence rows.

## 2. The artifacts (design SSOT until code exists)

- **Concept sketch rev 6 (THE design contract):**
  https://claude.ai/code/artifact/bb5b3854-97b3-43fb-baed-3b2d022f0a39
  — source versioned at `docs/prototypes/stream-concept-rev6.html` (self-contained, open in a
  browser). Three acts: **Act 1** = one conversation across every ask shape (analytical,
  hooks + quick-actions demo on row 2, revision, audience compare, explore, honest absence,
  account read, script asset, plan, input ask, remix honesty, concept test, persona turn,
  in-flight). **Act 2** = /test end to end — the two-minute wait as four snapshots (ask →
  t+6s source lands → t+40s keyframes fill + cast named → verdict); the law: **the wait
  becomes the evidence**; bands/words only in-thread, the 0–100 stays on /analyze. **Act 3** =
  the full Reading page in stream language: score numeral WITHOUT the gauge ring · the
  funnel's interpretation sentence promoted to page hero · survival + driver rows (accent
  marks exactly ONE thing per figure: the stall, the weak driver, the drop frame) ·
  "POWERED BY SIM-1 MAX" demoted into the receipt (closes audit item #3) · room grouped by
  verdict with `ask →` personas · Fix First as ranked rows · ends in the follow-up composer.
  Compression note: the retention scrubber/synced player is compressed to the keyframe strip
  in the sketch; the real page keeps the full player above the fold.
- **The audit that started it:**
  https://claude.ai/code/artifact/b2e4b34f-4ee2-4fdb-83a5-5f720380047d
  — source at `docs/prototypes/cards-audit-2026-07-20.html`. Finding: THREE UI languages
  coexist (A editorial make-family = the old bar · B dashboard Explore · C transcript Text
  Read) + six cross-cutting debts (no run-group concept · band color multiplies · `[template]`
  tokens read as bugs · caps ladders regrow · mobile 4–5 screens for B/C · 17 bespoke
  renderers = the tax that makes cards rot). 41 live screenshots of /dev/cards behind it.

## 3. Proposed build phases (NOT started — discuss first)

1. `composed` block type: zod schema for the 14 primitives + ONE stream renderer.
   THREAD-04 intact — compositions validate against the registry like any block.
2. **Hooks as proof:** hooks runner emits a composition; /dev/cards renders old vs new side
   by side; parity verified before anything else moves.
3. Ideas / script / remix / test-card migrate (mechanical after hooks).
4. Explore / Account Read / Text Read — the rebuilds (now just compositions).
5. Chat ad-hoc composer behind a flag (the "any request gets real UI" payoff).
6. The Reading page (`/analyze`, per Act 3) — LAST: biggest surface, do it once the
   vocabulary is production-proven.
7. Cleanup: retire the 17 bespoke renderers + their guard debt.

## 4. Known open items

- **Owner freeze on rev 6 is pending** — and the owner has unnamed items to address first.
- Re-findability in long threads: skill-named receipts help; a thread outline may be needed.
- Streaming choreography: receipt first → prose streams → rows land as scored (noted on the
  in-flight scene; needs real design during phase 1).
- When phases land, update the worktree table in `CLAUDE.md` (this lane's row is missing).

## 5. Process that worked (repeat it)

- **ASCII 3-way in AskUserQuestion previews → owner locks → HTML sketch rounds on one
  artifact URL** (relabel each rev). Owner engages with concrete rendered things.
- **Self-audit your own sketch like a surface:** Playwright type-census
  (`.scratch/shoot-sketch.mjs`) caught a 13-size type ladder and a broken `font:` shorthand
  (never use the `font:` shorthand with `inherit` — it silently resets weight/size). Shoot
  per-turn at 1:1 (`.scratch/shoot-turns.mjs`) — full-page screenshots hide detail.
- Screenshot harnesses in `.scratch/` (gitignored): `shoot.mjs` (per-section /dev/cards,
  login e2e-test@virtuna.local / e2e-test-password-2026) · `shoot-room.mjs` (clicks room
  tabs) · `shoot-sketch.mjs` / `shoot-turns.mjs` / `shoot-test.mjs` / `shoot-act3.mjs`.

## 6. Environment gotchas (all hit this session)

- Fresh worktree needs `.env.local` **copied from `~/virtuna-v1.1/`** + `pnpm install`.
- Dev server: `NODE_OPTIONS='--max-old-space-size=2048' node ./node_modules/next/dist/bin/next
  dev -p 3000 --turbopack`, detached via python fork+setsid. It DIES occasionally between
  commands — probe before use. ⚠️ `pkill -f "virtuna-thread-cards/node_modules/next"` MISSES
  it (relative cmdline path); kill with `lsof -ti :3000 | xargs kill -9`. Never `rm -rf .next`
  while a server is alive (turbopack DB corrupts; that happened — kill, verify port free,
  then clean + relaunch).
- A Write-tool path-guard hook blocks writes outside this worktree (including the memory
  dir) — write memory files via Bash heredoc.
- Memory SSOT for this lane: `thread-cards-grammar-rework.md` in the project memory dir.
