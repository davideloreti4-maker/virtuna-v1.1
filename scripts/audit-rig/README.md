# E2E audit rig

Drivers for the audit lane (`docs/AUDIT-E2E-2026-07-26.md`). Committed because session 1's
equivalents lived only in a session-scoped temp dir and had to be hunted down to resume.

**They drive a real logged-in browser against a real backend. Runs are billed.**

## Setup

```bash
# 1. dev server, detached, on :3040 (NOT :3030 — the onboarding worktree owns that)
python3 scripts/audit-rig/launch-audit-dev.py

# 2. ALWAYS verify it is serving THIS worktree before trusting a visual check
pid=$(lsof -tiTCP:3040 -sTCP:LISTEN | head -1); lsof -a -p $pid -d cwd
#    -> must print /Users/davideloreti/virtuna-e2e-audit

# 3. shared headed Chromium, persistent profile, CDP on :9222 (login survives sessions)
```

Output (screenshots + JSON) goes to `.scratch/audit/` — gitignored. `mkdir -p .scratch/audit/shots`
before the first run. Logs: `.scratch/audit/dev-3040.log`.

## Drivers

| Script | What it answers |
|---|---|
| `station.mjs <slug> [path]` | Screenshot + measured facts for one surface |
| `skill.mjs <Skill> "<prompt>" [waitMs]` | Run ONE skill in-thread; captures payload, response, degrade surface, CTAs |
| `redirects.mjs` | Where every candidate route actually lands (F-013) |
| `nav.mjs` | The shipped nav, from rendered buttons — desktop + mobile |
| `actb-run2.mjs` | Does the fidelity selector reach the payload? (F-015) |
| `actb-bind.mjs` | Does the audience chip bind? (the discriminating test) |
| `remix2.mjs` | Polls visible text so a TRANSIENT error line isn't missed |
| `db-model.mjs` | What a run actually persisted (`messages.body.blocks`) |

## Traps these encode — do not "simplify" them back out

- **Match the skill-menu row by its DESCRIPTION** (`Funnel-top idea cards`), never the label.
  The Start-view artifact tile renders nearly the same string, and a sidebar thread title starting
  "ideas…" outranks both. **The two doors behave differently — that is F-017.**
- **Find send by walking a fixed 6 levels up from the skill pill**, then the rightmost non-`⚙`
  button. Walking "up until it contains the textarea" short-circuits when the textarea is absent and
  returns a card CTA; a y-band around the model pill catches a card's `Simulate` at the same height.
- **Never `animation:none`** to freeze the room — it resets entrance animations to `opacity:0` and
  shoots a blank page. Playwright's `animations:'disabled'` fast-forwards to the END state.
- **A 1.2 s settle is too short to observe a redirect chain** — it manufactures false orphans.
- **Don't grep rendered copy for bare `error`/`failed`** — hook copy legitimately contains
  *"Prediction Error"*. The real failure copy is *"Couldn't **read** that video"*.
- `/api/threads/open` omits `active_audience_id`; read the thread pin from the DB.
  Tables are `threads` / `messages`; blocks live in **`messages.body.blocks`**.
- Not every skill is under `/api/tools/*` — **account teardown posts to `/api/account-read`**.
- The dev server can die on a video-bearing run (2 GB heap cap). Chrome's `ERR_CONNECTION_REFUSED`
  shell reads exactly like an empty UI — **confirm the server is alive before calling a surface
  empty.**
