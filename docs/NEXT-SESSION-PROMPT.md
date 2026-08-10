# Copy-paste this to start the next session

Everything below the line is the prompt. It is written to be pasted as-is into a fresh session.

---

We're picking up the in-thread chat lane in `~/virtuna-in-thread-chat` (branch
`lane/in-thread-chat`). Nothing is deployed — Vercel is disconnected while I switch accounts — so
treat this as local-only. Stages A and B are merged to `main`; session 7's work is committed to the
lane and unmerged.

**Read this first, before touching anything:**

`docs/HANDOFF-2026-08-10-session-7-thread-context.md` — what shipped, what was measured, what was
NOT verified (§5), and the traps (§7 — several will bite you).

Two docs it supersedes, so don't be misled by them: `docs/CONTEXT-AUDIT-2026-08-10.md`'s role
table is **wrong about `voice`**, and my memory file for this lane is thinner than the handoff.
Trust the handoff.

**The job: verify what session 7 built, through the real app.**

Session 7 shipped four things. Two are unconditional (`BUNDLE_CHAR_CAP` 4000→6000, and a shed
order that makes the corpus yield before the creator's profile). Two are behind flags, both OFF:

- `ENGINE_GEN_CONVERSATION` — the creator's own turns + on-screen card lines now reach the
  generators as data on `SkillRunContext`, instead of only via the `topic` string
- `ENGINE_REPEAT_ASK_PIN` — asking for the same thing twice in a thread now dispatches instead of
  being narrated

Both were measured one layer down — real model, real pipeline — and both moved the number:
constraint violations 9→1 across two A/B runs, and the repeat-ask defect reproduced and fixed.
**Neither has been walked through `/api/tools/chat` signed-in.** That is the gap.

What I want from this session:

1. **A signed-in walk of both flags**, on a real thread, in a browser. Does the digest actually
   arrive at the generator through the route? Does the pin fire on a real repeat ask, get gated
   and billed once, and produce cards? The recipes are in the handoff §8 and the session-6 handoff
   §8 (`mint-auth.ts`, `probe-full-turn.mjs`).
2. **The digest under a calibrated audience.** The A/B ran with `audience: null`, so the
   interaction between the digest and the audience `overrides` block is untested live.
3. **Whether the pin over-fires on real traffic.** It is tuned against 151 historical same-skill
   pairs (threshold 0.7, clear air 0.67–0.75) but has no live sample.

Then tell me plainly what you could not verify, the way the last handoff does.

**Do NOT do these without asking me:**

- The `writing_voice_sample` migration. The column does not exist in the database and
  `creatorProfilePatchSchema` strips the field anyway. **Widening the zod schema before the
  migration lands would send an unknown column to the upsert and break profile saving for
  everyone.** It's a prod DB write, it's parked on purpose, and it is my call.
- Adding `goals`/`wins`/`flops` to `MODE_ROLES.chat`. Parked with a measured reason: `goals` is
  null for 16 of 18 profiles and `wins`/`flops` have 0 rows ever. See handoff §1.4.

**Standing rules for this lane:**

- The standard before claiming anything works: tsc + full suite + prod build + a live measurement,
  and write down what you did NOT verify. `npm run build` matters — a `src/lib/surfaces/*` import
  into an API route breaks it while tsc stays clean.
- **Commit at every green point, even mid-stage.** The post-commit hook auto-pushes.
- Don't derive prompt-budget headroom from an output length — that mistake is what hid the voice
  eviction for months. Assert on which roles survive.
- Mutation-test anything important: break it on purpose and confirm the test fails. That is how
  session 7 found a hole in its own cap test before it shipped.
- My memory store cannot be written from this worktree (path guard). The docs are the record.
