---
status: diagnosed
trigger: "Clicking Develop & predict on Adapt concept card → WSOD; reload recovers to score-mode child board Calculating. Server: 'Invalid state: Controller is already closed'. goal: find_root_cause_only"
created: 2026-06-02
updated: 2026-06-02
---

## Eliminated

- hypothesis: WSOD is the fetch-abort AbortError rejection from start()
  evidence: Fix C (.catch on developStream.start()) correctly attached AdaptFrameBody.tsx:93-103; Fix B onError short-circuits on abortRef.signal.aborted (use-analysis-stream.ts:389). Live test confirms server close-throw + rogue GET gone, WSOD persists. Abort path fully handled → not the cause.
  timestamp: 2026-06-02 (attempt 2)

- hypothesis: WSOD is a score-frame render throw on the null-score child row escaping (app)/error.tsx
  evidence: All score frames guard with ?. and ?? null (AudienceNode:94, VerdictNode:46/56/72 result-gated, ActionsNode:49, EngineGroup:99). Render "Calculating…" gracefully. No unguarded deref.
  timestamp: 2026-06-02 (attempt 2)

## Resolution (REVISED — attempt 2)

root_cause: |
  BUG 1 (handoff — symptom #2, confirmed): developStream is owned by AdaptFrameBody, which
  renders ONLY when boardMode==='remix' (Board.tsx:522). navigate-on-started flips boardMode
  remix→score → AdaptFrameBody UNMOUNTS → developStream cleanup aborts the POST body-reader
  (~1082ms) while the server pipeline runs to completion (132s) detached. The child board's
  persistent Board.stream mounts FRESH against the null-score placeholder row: completedFromInitial
  is null (overall_score null) → phase 'idle' → no body-reader (that was developStream's, now dead),
  no polling (pollEnabled gates phase==='polling', never set), no GET reconnect (fix B removed it).
  So the child sits on "Calculating…" forever until manual reload. The normal command-bar flow
  never hits this: Board.stream IS the instance that POSTed AND it persists in analyze/layout.tsx
  across the /analyze→/analyze/[id] push, so the SAME stream keeps reading the SSE body after nav
  (it's the body-reader loop, not the URL, that carries progress).

  BUG 2 (WSOD — symptom #1, NOT yet root-caused from code alone): the persistent black screen is
  NOT the fetch abort (eliminated above) and NOT a guarded score-frame render. Leading remaining
  candidates require a live stack trace to disambiguate (see capture instructions). Most probable:
  a synchronous throw in the react-konva BoardCanvas/GroupFrame commit when resolvedFrames swaps
  the entire frame set (remix→score) in the SAME persistent canvas — react-konva crashes are NOT
  caught by (app)/error.tsx the way DOM render throws are, and produce a blank canvas (black).
fix: |
  Recommended: approach (a) RESUME path — see proposed fix. Develop should NOT depend on
  AdaptFrameBody staying mounted to carry the stream. (find_root_cause_only — not applied.)
files_changed: []

## Current Focus

hypothesis: developStream POST body-reader keeps running after AdaptFrameBody unmounts on router.push; server controller double-closes (POST route has UNGUARDED controller.close()); client throw on unmount during navigation → WSOD.
test: compare POST route controller.close() guarding vs GET route; trace developStream lifecycle on navigation; check whether AdaptFrameBody unmounts.
expecting: POST route finally{controller.close()} unguarded → throws if already closed by client abort; client side throw separate.
next_action: read Board.tsx navigate-on-started pattern; check if AdaptFrameBody unmounts across /analyze→/analyze/[id] nav (layout persists Board).

## Symptoms

expected: Click "Develop & predict" → smooth navigation to child score board in Calculating state.
actual: Screen goes BLACK (WSOD). Manual reload → lands on child score board "Calculating…". Child analysis DID launch + navigate.
errors: Server: ERROR Pipeline error {"error":"Invalid state: Controller is already closed"}. Child stream e0Dr ran 38s. Client: uncaught exception / black screen.
reproduction: Click "Develop & predict" on an Adapt concept card in remix mode.
started: Phase 5 UAT (developStream feature is Phase 5 work).

## Evidence

- timestamp: 2026-06-02
  checked: POST /api/analyze SSE stream controller.close() (route.ts:945-947)
  found: default-branch stream uses try/catch/finally with UNGUARDED `controller.close()` in finally. No try/catch around close. send() also enqueues unguarded (line 768).
  implication: If client aborts (AbortController on unmount) the body stream, the ReadableStream is canceled; a later send()/close() throws "Invalid state: Controller is already closed". Matches server log.

- timestamp: 2026-06-02
  checked: GET /api/analyze/[id]/stream controller.close() (stream route 124,205)
  found: GET route guards EVERY close with try{}catch{}. POST route does NOT.
  implication: asymmetry — POST is the unprotected one. The error is on POST (requestId GV53k... module pipeline/analyze), confirmed by log.

- timestamp: 2026-06-02
  checked: developStream lifecycle — handleDevelop calls developStream.start() (POST). navigate-on-started effect router.push on analysisId null→string.
  found: developStream is the POST body-reader. start() = mutation.mutateAsync. AbortController in abortRef. Cleanup-on-unmount effect aborts abortRef + closes ES.
  implication: router.push to /analyze/[id] — does AdaptFrameBody unmount? If yes, cleanup effect fires controller.abort() → cancels client read → server send/close throws.

- timestamp: 2026-06-02
  checked: (app)/error.tsx exists and wraps analyze segment; FrameErrorBoundary in Board/BoardMobile.
  found: there IS a route-segment error boundary. A render throw shows "Something went wrong", not black.
  implication: WSOD is NOT a render throw caught by error.tsx. It is either (a) an error during navigation/commit phase React can't recover from, or (b) thrown outside React render (async/event handler) that bubbles to window. Need to confirm what throws client-side.

- timestamp: 2026-06-02
  checked: Board.tsx mount location (analyze/layout.tsx) vs AdaptFrameBody mount (Board.tsx:522 adapt frame, conditional on layout.id, driven by boardMode).
  found: Board persists across /analyze→/analyze/[id] nav (mounted in layout). AdaptFrameBody is conditionally rendered only when boardMode==='remix'. developStream lives INSIDE AdaptFrameBody.
  implication: When child row (mode:'score') lands → boardMode flips remix→score → adapt frame unmounts → developStream cleanup effect (use-analysis-stream.ts:459-464) fires abortRef.abort(). Board's own stream is the persistent one Board uses for nav — NOT developStream.

- timestamp: 2026-06-02
  checked: mutation.onError (use-analysis-stream.ts:384-392) + AbortError handling.
  found: NO AbortError guard. On abort, reader.read() rejects → mutationFn throws → onError: if analysisIdRef.current (now SET, started arrived) && phase!=='reconnecting' → reconnect(). reconnect() calls setPhase('reconnecting') + new EventSource on the unmounting component.
  implication: This is exactly the rogue GET /api/analyze/e0Dr/stream that ran 38s in the log. The abort was MEANT to cancel everything; instead it spawned a reconnect that finished the analysis (why reload shows Calculating→completes). Also: start() was void-called in handleDevelop (AdaptFrameBody.tsx:90) so the AbortError rejection is unhandled.

- timestamp: 2026-06-02
  checked: server log requestId mapping.
  found: POST requestId GV53k = developStream POST (the one that throws Controller-already-closed). GET stream requestId fw2e4 id e0Dr = the rogue reconnect (ran 38s, completed). Two distinct server requests from ONE click.
  implication: Confirms developStream abort cancels POST client-side (→ unguarded close throws) AND spawns a reconnect GET. The GET route IS guarded (try/catch on close) so it doesn't throw; the POST route is not.

- timestamp: 2026-06-02
  checked: Board.tsx submittedIntent (line 106, default 'score', set at original submit) + boardMode derivation (166-169).
  found: submittedIntent stays 'remix' from the original remix submit; never reset on Develop click. boardMode = stream.result?.mode ?? permalinkQuery.data?.mode ?? submittedIntent. Board's stream is NOT reset, so stream.result is the stale remix result during the nav gap.
  implication: boardMode stays 'remix' until the child permalinkQuery resolves (child row mode:'score'), THEN flips → adapt unmount. Explains the brief delay then unmount-abort. Board never reset its stream for the new child id, so on nav it relies on permalinkQuery + the route-leave wipe in use-analysis-stream.
