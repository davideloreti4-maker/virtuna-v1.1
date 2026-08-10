# Copy-paste this to start the next session

Everything below the line is the prompt. It is written to be pasted as-is into a fresh session.

---

We're picking up the in-thread chat lane in `~/virtuna-in-thread-chat` (branch
`lane/in-thread-chat`, merged to `main` on 2026-08-10 — nothing is deployed, Vercel is
disconnected while I switch accounts, so treat this as local-only).

**Read these two docs first, in this order, before touching anything:**

1. `docs/CONTEXT-AUDIT-2026-08-10.md` — the brief for this session
2. `docs/HANDOFF-2026-08-10-session-6-stage-b-merged.md` — what just shipped, what was measured,
   and the traps (several will bite you: Playwright timeouts that fake a 30s plateau, a CTA whose
   accessible name is not its visible text, two dev servers fighting over one lock)

**The topic: what the model actually sees.**

Three findings from last session are all the same subsystem, and fixing them separately would mean
three separate live-measurement cycles:

- **The generators have no conversation context.** `runHooksPipeline` / `runIdeasPipeline` /
  `runScriptPipeline` receive a `topic` string, an anchor, the profile and the audience. Twenty
  turns of conversation reach them only as whatever the agent compressed into that one string.
- **Context makes the chat agent claim work it did not do.** Ask for the same thing twice in a
  thread and it answers "Here are 5 hooks for X…" with no dispatch and no cards. Reproducible.
- **The chat agent is the only mode with no `voice` role.** It gets niche + audience + platform and
  nothing else — the front door knows the least about me.

**Start with brainstorming, not code.** These are architecture and taste decisions, and I don't
think there's an obvious default:

- Does the whole conversation go into the generator bundle, a rolling summary, or the last N turns?
- It competes with voice/wins/flops under `BUNDLE_CHAR_CAP`, which sheds roles from the tail —
  what gets dropped first, and does that change the role ordering?
- Should the co-pilot's prose sound like me, or like Maven? That one is my call, so ask me.
- Does fixing the repeat-ask defect belong in the prompt, in a guard, or in how context is framed?

Once we've settled the shape, build it behind a flag (this lane's convention — default OFF), and
hold to the lane's standard before claiming anything works: **tsc + the full suite + a prod build +
a live measurement**, and write down what you did NOT verify. The last session's A/B harnesses are
in `.scratch/` and re-runnable; the recipes are in §8 of the handoff.

**Also worth knowing:**

- Commit at every green point, even mid-stage. The post-commit hook auto-pushes. Last session
  inherited a half-built, uncommitted stage and spent a third of its budget reconstructing it.
- My memory file for this lane (`in-thread-chat-audit-lane.md`) is STALE — it still says "Stages
  B/C/D not started". The path guard blocks writing to `~/.claude/...` from this worktree, so it
  can only be fixed from the trunk worktree. Don't trust it; trust the docs.
- A smaller, related piece you can fold in if it fits: a typed "rewrite these" never calls a tool —
  the model rewrites cards as prose, bypassing scoring entirely. The chip path works because the
  client hands over the pack. Measured both with and without the Stage B flag; identical.
