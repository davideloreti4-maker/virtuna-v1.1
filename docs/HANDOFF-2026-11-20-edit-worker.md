# Handoff 2026-11-20: the edit tool's worker (part 2)

Start here for part 2. Part 1 (the document, the kit, the Player) is in `docs/HANDOFF-2026-11-19-edit-fresh.md`; its rules for whoever works here still hold.

## Where things stand
- **Where:** worktree `~/virtuna-edit`, branch `feat/edit`. Every commit is local; nothing is pushed (X13).
- **Plan:** `docs/superpowers/plans/2026-11-20-edit-worker.md`. Each task's results are written under it, decisions X38 to X82 are in its table, and the final review's fix wave is its section "Final review".
- **How it is run:** subagent-driven, one task at a time, each reviewed. The ledger, `.superpowers/sdd/2026-11-20-edit-worker/progress.md`, says which tasks are done. Trust it and `git log` over memory. The folder also holds each task's brief, the controller's resolutions and rulings, and the reports.
- **Task 1** (the probe): done.
- **Task 2** (render: slices over four containers, joined, levelled to -14 LUFS, BT.709 tags): done and reviewed, its proof box ticked.
  - **The render look fix (X72, X73).** The bucket's CORS lists ports 3000–3005 and the engine gives eight browsers 3000–3007, so the last two browsers of each container drew without the look, silently.
    - Now the renderer fetches R2 files itself, once a container.
    - A render whose look cannot be drawn fails, naming the slice; it is decided per run of shots, not per frame.
    - The 90 s film through `/start`: 78.6 s, 32 of 32 slices with the look. The target of under a minute is not met.
- **Task 3** (the take's copies, on ffmpeg 5.1 in the image too): done and reviewed.
- **Task 4** (words timed to the sound, pauses): done and reviewed.
  - With the owner's ElevenLabs key, Scribe writes the text; without it, Whisper. WhisperX times the words either way. Cuts land only in pauses (X54).
  - **The worker batch** (done and reviewed):
    - on the no-key path, a pause gives way only where Silero hears speech lying wholly inside it (X79), so the take keeps all six pauses;
    - a `--no-key` switch for the development functions;
    - a film the limiter takes under X49's band is levelled once more, raised (the Task 7 edit now posts -14.7 LUFS);
    - a take over ten minutes is refused by the worker right after its probe.
- **Task 5** (faces, loudness, the whole analysis): done and reviewed.
- **Task 6** (R2, the rows, the web address, the deploy): done and reviewed.
  - Three migrations were applied to `virtuna-v1.1` on the owner's word ("you decide on database"):
    - the tables;
    - the grants;
    - X70's ownership key.
- **Task 7** (the app's routes `src/app/api/edit/*`, `src/lib/edit/worker/*`, and the page `/dev-edit/worker`): done and reviewed.
  - Proved end to end as the e2e test account: upload, analysis, the Player with captions, a render through a mid-render reload, download, frames compared.
  - Last run: PUT 6.4 s, analysis 27.9 s, render 47.9 s.
  - The upload is bound to its size and type on R2.
  - **X77**, the controller's ruling, the owner's to overturn: the Player as the creator sees it plays the preview copy, which is 1.7–2.8 levels from the take by its encode alone. It is held to 3.0 levels; the full copy is held to Task 2's 1.6.
  - **Test 6** (an iPhone take) is open; the run is written in the plan.
- **The final whole-branch review** (26eb254b..dc0c23c8): no Critical; ready to merge with fixes. **The one fix wave is done** (rulings `.superpowers/sdd/2026-11-20-edit-worker/final-fix.md`, results in the plan's "Final review"):
  - **Who may spend (X81):** only the creators named in `EDIT_CREATORS` get through the edit routes and the dev page (403 otherwise; `.env.local` names the owner and the e2e test account); one live job of a kind per creator (409); `analyse` at most 4 containers, `render` 2; the worker's web address behind Modal's proxy auth (the token made from the CLI, in `.env.local` as `EDIT_WORKER_PROXY_KEY` and `EDIT_WORKER_PROXY_SECRET`).
  - **Renders that queue (X82):** slices still out near the render's timeout are cancelled ("the render machines are busy; try again"); a job the app wrote failed is given up and its slices cancelled.
  - **Plain failure lines (X66, X71):** a row says the worker's own words only for its Refusals and render.mjs's marked line, else "the analysis/render failed on our side; try again". The last writes are retried; Scribe's 429 or 5xx falls back to Whisper (`fellBack`); `EDIT_WORKER_URL` must be https; the dev Volume is mounted by the development app only; kit paths are held to `KitPath`.
  - **Measured (B2):** a three-minute render, 98.9 s in the function, the 2-core parent at 351 MiB; a ten-minute analysis, 404.2 s and 2.3 GiB (X61 kept). Test 6 stays open: HEVC, HDR tone mapping's look, 4K time.
  - **Proved:** the page proof again through the gate (exit 0), an unlisted account refused by a real call, the in-image suite on ffmpeg 5.1.9.
  - **The public repo:** the plan no longer names the worker's address, production ids, a user count or an email. Earlier commits still do; history is the owner's call at push time.
- **Proof rows left in place:**
  - in the owner's account: the take from Task 6, and the render jobs from Task 6, the look fix and the worker batch;
  - in the test account: the takes, jobs and R2 objects of Task 7's proofs and the final review's (one take, two jobs, six objects more);
  - in the Volume `edit-dev-media`: the final review's ten-minute take and its analysis's files.
  
  Cleanup is the owner's word.
- **Setup done 2026-11-20:**
  - **Modal:** a payment method was added. Part 2 has spent about $2.02 metered in all.
  - **Keys:** `.env.local` was copied. The R2 keys and the ElevenLabs key were stored with `env-put.sh`, on the owner's word ("just use the sectrets its just for testing"). The Modal secret `edit-worker` was made.
  - **R2:** the bucket `edit-media` is in Cloudflare's EU jurisdiction (`<account>.eu.r2.cloudflarestorage.com`), with its CORS set.
  - **Before real users:** make new R2 and ElevenLabs keys, because these were pasted into the chat.

## What the owner owes
1. **His iPhone on a trusted Wi-Fi** (tests 1 and 2) and **one take filmed on it** in its default format (test 6: HEVC, HDR tone mapping, 4K time).
2. **To read, or overturn, decisions X38 to X82** in the plan (X77: the Player's preview copy; X81: who may spend, and how much at once). The ones that change the product:
   - X49: posts at -14 LUFS, or up to 1 LU under on a voice (the take reads -14.8), rather than limiting it harder;
   - X53: colour tags;
   - X54: cuts only in pauses;
   - X55: takes in English, German and Italian only;
   - X56: a take of at most 10 minutes.
3. **To look at the pictures:**
   - test 5's word timing in `.scratch/worker-proof/words/pictures/`; "Claude" at 6.87 s is read as a hesitation before the word, and nobody has listened to it;
   - the faces in `.scratch/worker-proof/faces/`.
4. **New R2 and ElevenLabs keys** before real users.
5. **A word on the old branch** and draft PR 560.
6. **A word on cleaning up** the proof rows and films (his account and the test account) and the Volume's ten-minute take.
7. **The ids in `EDIT_CREATORS`**: `.env.local` holds his and the e2e test account's. Any other deployment of the app (Vercel) needs `EDIT_CREATORS` and the worker's proxy token (`EDIT_WORKER_PROXY_KEY`, `EDIT_WORKER_PROXY_SECRET`) in its environment; the token was made with `modal workspace proxy-tokens create`, no dashboard needed. Scripts outside git that call the worker's address themselves now need the token too.
8. **At push time:** run `next build` first (not run yet: about 1.1 GB of disk was free, and the build replaces a 669 MB `.next`). Then decide whether to squash or rewrite the earlier commits that still name the worker's address and production ids (the final fix report lists which), or leave them.

## Deferred, with a ruling each (the ledger has them all)
- **Task 6:**
  - a failed slice should fail the job at once;
  - dev functions must stay out of `modal deploy`;
  - a container's cold start was once 62 s (the web address now starts in 9–17 s cold, under 1 s warm);
  - compare a stored object's size with the declared bytes.
- **Part 3:**
  - before the tool opens beyond `EDIT_CREATORS`: two requests at the same instant can both pass the one-live-job check. The fix is a partial unique index on `(user_id, kind)` for live jobs, with stale ones settled first and 23505 mapped to 409. It needs a production migration (his word);
  - a per-creator daily quota through the billing credit gate; the bucket's CORS for the production origin;
  - warm stills take about 2.6 s each;
  - guarded music can post 2 to 3 LU under -14;
  - Scribe `keyterms` for the creator's names;
  - the editor's Player with sound that ends early.
- **Final review:** done (the plan's "Final review"). What it left to part 3: the per-creator daily quota through the billing credit gate, and the rest of the ledger's triage (the product screen's retries, resumable uploads, stale `uploading` takes, the bucket's CORS for the production origin, the 300 s fetch bound for many remote files, the warm `web`).
- **Listening:**
  - the copies' sound is a second AAC generation;
  - the film's sound was measured, never listened to.

## Rules added on 2026-11-20
- **Modal:**
  - one run at a time;
  - `modal billing summary` before each, with a stated stop;
  - cores requested and limited to the same number;
  - a `timeout` on every function.
- **Images:**
  - `debian_slim` is Debian 13 in this builder, so the images start from `python:3.12-slim-bookworm` (ffmpeg 5.1);
  - every ffmpeg command must work on 5.1 and on this Mac's 8.
- **Disk:** about 1.2 GB is free on this Mac. Install no model or heavy package locally; models live in the images only.
