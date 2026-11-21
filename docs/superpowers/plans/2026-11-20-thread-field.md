# The Thread Frame and the Message Field (part 3, slice 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Under `NEXT_PUBLIC_NEW_LOOK`, the thread and Home show a new message field (`+` · text · send; the tools Simulate · Hooks · Script · Remix · More as visible pills; a More sheet with the other skills and the audience) and a new thread frame (bubble, "Maven" label, quiet next-step chips under the last answer), while every request path stays exactly as today.

**Architecture:** New presentational components in `src/components/thread-next/` render from props only. The 4,120-line composer keeps all its state and request logic and, under the flag, renders the new field in place of its old box, passing its existing state and handlers. The thread frame branches inside the three existing frame components. Flag off: nothing changes.

**Tech Stack:** Next.js (app router), React 19, TypeScript, Tailwind v4 tokens (`data-look="next"`), Radix (via `src/components/ui/sheet.tsx`), Vitest + happy-dom, Playwright for looking at it.

Spec: `docs/superpowers/specs/2026-11-20-thread-field-design.md` (sections 4, 5, 7, 9). Seams with file:line: `.scratch/next-look/part3/seam-map.md` (read sections 1, 2, 4, 5, 6, 8, 9 before your task). Inventory: `.scratch/next-look/part3/inventory.md`.
Reference to match: `.scratch/next-look/part3/field-reference.png`; single renders `.scratch/next-look/part3/design/renders/f1-*.png`; measured boxes `.scratch/next-look/part3/design/field-boxes.json`; source `.scratch/next-look/part3/design/field.html` (classes prefixed `f1-`). **Read the source before building and port its geometry exactly.**

## Global Constraints

- Work only in `~/virtuna-next-look` on branch `design/next-look`. Never edit another worktree.
- **Do not commit, push or stash.** The controller commits. The repository is public: no ids, links, tokens or account data in code, tests, fixtures or docs.
- Flag `NEW_LOOK_ENABLED` (`src/lib/flags/new-look.ts`): **flag off must render and behave exactly as today.** Every edit to a legacy file is a flag branch, as small as possible. Every existing test stays green.
- **No request logic moves.** `handleSubmit`, `onSubmitForm`, `armFired`, the stream hooks, prices and endpoints are untouched. The send button stays `type="submit"` inside the form; Enter keeps calling the existing key handler; Stop keeps `e.preventDefault()`.
- **Skill mapping:** the "Simulate" pill selects `ToolId "test"` (never `"simulate"`); the profile read in More clicks the evidence file input (never `handleUserSelectTool("profile")`). File inputs are clicked synchronously inside the user's gesture.
- No new dependencies. pnpm. Tests: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run <path>`; types `pnpm exec tsc --noEmit`; lint `pnpm exec eslint <path>` (`react-hooks/set-state-in-effect` is on).
- Tests exercise real behaviour; stand-ins only for what cannot run (network, file pickers, matchMedia, WebGL). Never a stand-in for our own code. Write the test first and watch it fail. Flag-on tests use `vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }))`.
- Never read `.env*` files.
- Tokens only in `src/components/thread-next/`: no hex, `rgb()`, `rgba()`; `backdropFilter` only as an inline style and only in the field (the guard of Task 2 enforces it). Type from role tokens, radii from the scale, shadows as `shadow-[var(--shadow-…)]`. The existing guards scan `thread` and `app/home` too (`type-scale`, `radius-scale`, `section-label-scale`).
- Nothing coral on these parts. Buttons ink or white. Copy short and plain, sentence case. Say "Simulate", never "Test". No mic.
- Strings: the field's `aria-label` and the send button's `aria-label` reuse today's strings verbatim (tests and screen readers rely on them; `composer.tsx:3384-3398, 3530`). New strings must not collide with existing ones (seam map §6: "Remove video" for the tile, not "Remove attachment"; the More button is "More", not "Skills").
- Every control at least 44px to tap (`.tap-44` where the drawn size is smaller). Focus always visible.
- A part with visible UI is not done until it was rendered in the running app and compared with the reference (side by side, measured boxes). Say plainly what you did not check.
- Dev server (run by the controller): `http://127.0.0.1:3021`, flag on. Cookies: `.scratch/next-look/cookie.json`. Screenshots: `scripts/result-shots.cjs` shows the pattern (Playwright, cookies, 393×852 / 1440×900 at 2x); write any new script under `.scratch/next-look/part3/`.

## File Structure

```
src/lib/video-file.ts                 validateVideoFile, VIDEO_ACCEPT, VIDEO_MAX_BYTES (lifted from video-upload.tsx)   (Task 1)
src/hooks/use-video-meta.ts           useVideoMeta(file) -> { durationSec, thumbnail }  (lifted from video-upload.tsx)  (Task 1)
src/components/app/home/composer-controls.tsx   + BILLABLE_BY_TOOL (beside MAX_BILLABLE_BY_TOOL)                    (Task 1)
src/components/app/video-upload.tsx   uses the lifted helpers; behaviour unchanged                                   (Task 1)

src/components/thread-next/           new-look only
  thread-field.tsx      ThreadField: the field (form, rows, pills, +, tile, send/stop, errors, slash slot)            (Task 2)
  more-sheet.tsx        MoreSheet: other skills with prices, audience, lens                                         (Task 2)
  field-icons.tsx       send, stop, close glyphs (the shell's icons have none)                                     (Task 2)
  user-turn.tsx, assistant-label.tsx, followup-chips.tsx                                                           (Task 4)
  __tests__/thread-next-guard.test.ts   no colour literals; backdropFilter only in thread-field.tsx               (Task 2)

src/app/(app)/dev/field/page.tsx      the field and More in each state of the reference, for looking at it       (Task 2)

Legacy files touched (flag branches only):
  src/components/app/home/composer.tsx       THE BOX swap, + / evidence / drop wiring, phone room, scroll reserve (Task 3)
  src/components/ambient-overview/…/AmbientOverviewSheet.tsx (path per seam map)  optional `barless` prop     (Task 3)
  src/components/thread/thread-shell.tsx     ThreadUserTurn / ThreadAssistantTurn branch                         (Task 4)
  src/components/thread/followup-row.tsx     branch                                                               (Task 4)
  src/components/thread/thread-turn.tsx      showFollowups prop                                                   (Task 4)
  src/components/thread/persisted-thread-stream.tsx   last-turn-only chips under the flag                         (Task 4)
  src/components/offer/hero-product-window.tsx        keeps the legacy bubble and label                           (Task 4)
```

---

### Task 1: Shared helpers and prices

**Files:** create `src/lib/video-file.ts` (+ test), `src/hooks/use-video-meta.ts` (+ test); modify `src/components/app/video-upload.tsx`, `src/components/app/home/composer-controls.tsx` (+ test).

**Produces (exact):**

```ts
// src/lib/video-file.ts
export const VIDEO_MAX_BYTES: number;          // today's 200 MB limit, the same number video-upload.tsx uses
export const VIDEO_ACCEPT: string;             // the accept string today's input uses
export function validateVideoFile(file: File): string | null;   // null when valid, else today's error text, verbatim

// src/hooks/use-video-meta.ts
export function useVideoMeta(file: File | null): { durationSec: number | null; thumbnail: string | null };
//  Today's extraction from video-upload.tsx (object URL, loadedmetadata, a frame to canvas), moved; it revokes
//  its object URL when the file changes or the component unmounts.

// src/components/app/home/composer-controls.tsx
export const BILLABLE_BY_TOOL: Partial<Record<ToolId, BillableAction>>;
//  { test: "score", hooks: "hooks", idea: "ideas", script: "script", remix: "remix", explore: "explore", account: "account" }
```

- [ ] Tests first: `validateVideoFile` accepts each type today's code accepts and refuses a wrong type and a file over the limit with today's exact messages (copy them from `video-upload.tsx:124-132`); `useVideoMeta` returns nulls for `null` and revokes its URL on unmount (stand in for `URL.createObjectURL`/`revokeObjectURL` and the video element's events: browser APIs); `BILLABLE_BY_TOOL` maps to the prices of spec §3 (`creditCost(BILLABLE_BY_TOOL.hooks!) === 1`, script 2, remix 10, test 10, idea 1, explore 1, account 5) and has no entry for `chat`.
- [ ] Move the code; `VideoUpload` uses the helpers; its own tests stay green unchanged.

### Task 2: The field and the More sheet (presentational)

**Files:** create `src/components/thread-next/thread-field.tsx`, `more-sheet.tsx`, `field-icons.tsx`, `__tests__/thread-field.test.tsx`, `__tests__/more-sheet.test.tsx`, `__tests__/thread-next-guard.test.ts`, `src/app/(app)/dev/field/page.tsx`.

**Consumes:** Task 1; `Chip`, `IconButton`, `Button`, `Sheet` (`src/components/ui`); `PlusIcon` (`src/components/shell/icons.tsx`); `ToolId`, `SKILLS`, `BILLABLE_BY_TOOL` (`composer-controls.tsx`); `creditCost` (`src/lib/pricing.ts`); `PROMISE_BY_TOOL` (`v8/skills-panel.tsx`) for More's lines (shortened as drawn).

**Produces (exact):**

```ts
export type FieldTool = "test" | "hooks" | "script" | "remix";            // the four pills, in this order
export interface ThreadFieldProps {
  value: string; onChange(value: string): void;
  onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>): void;
  onSubmit(e: React.FormEvent<HTMLFormElement>): void;                  // the form's submit; send is type="submit"
  tool: ToolId; onSelectTool(tool: ToolId): void;                       // a second tap on the selected pill calls onSelectTool("chat")
  priceOf(tool: ToolId): number | null;                                 // null = free (chat)
  canSend: boolean; busy: boolean; online: boolean;
  streaming: boolean; onStop(e: React.MouseEvent<HTMLButtonElement>): void;
  video: File | null; onVideoChange(file: File | null): void;          // + and a dropped video; remove = onVideoChange(null)
  evidence: File | null; onRemoveEvidence(): void;                     // the profile read's staged file, shown as a chip
  onDropFile(file: File): void;                                         // a dropped non-video file (the composer routes it to evidence)
  errors: Array<string | null>;                                         // shown under the field, nulls skipped
  placeholder: string; ariaLabel: string; sendLabel: string;
  brief?: { hookLine: string } | null; onDismissBrief?(): void;         // only rendered while tool === "test"
  slashMenu?: React.ReactNode;                                          // rendered by the composer, anchored to anchorRef
  anchorRef?: React.Ref<HTMLDivElement>;                                // forwarded to the field's outer element
  moreArmed?: { label: string; price: number | null } | null;           // a skill picked from More: shown on the More button
  onOpenMore(): void;
}
export function ThreadField(props: ThreadFieldProps): React.JSX.Element;

export interface MoreSheetProps {
  open: boolean; onOpenChange(open: boolean): void;
  skills: Array<{ id: ToolId; label: string; line: string; price: number | null }>;   // Ideas, Explore, Your account
  onSelectSkill(id: ToolId): void;                                      // closes the sheet
  onReadFile(): void;                                                   // the profile read: must click the evidence input synchronously
  readFilePrice: number;                                                // creditCost("profile")
  audienceLabel: string; onOpenAudience(): void;                        // opens today's audience sheet
  lens: "tiktok" | "instagram" | "youtube"; onLensChange(lens: MoreSheetProps["lens"]): void;
}
export function MoreSheet(props: MoreSheetProps): React.JSX.Element;
```

- [ ] **Geometry from the reference** (`field-boxes.json`, `field.html`): field radius 32, glass (`bg-glass`, `shadow-[var(--shadow-float)]`, blur as an inline style like `src/components/shell/tab-bar.tsx`), padding 8 top and sides, 10 bottom, 10 between rows; row 1 = `+` (32 circle) · textarea · send (32 circle); row 2 = four pills + More, 32 tall, 14px weight 560, phone padding 8 and gap 4, desktop padding 12 and gap 6; field 96 tall at rest, 164 with a video tile. Placeholder colour `--color-foreground-secondary` (contrast 4.86:1 light, 6.87:1 dark). Every target under 44px gets `.tap-44`.
- [ ] **Pills:** filled when selected (`Chip selected`), label "Hooks · 1" etc. only when selected (`priceOf`). The More button shows `moreArmed` the same way. A tile for `video`: thumbnail, length (`useVideoMeta`), a remove `IconButton` named "Remove video".
- [ ] **`+`:** a hidden `<input type="file" accept={VIDEO_ACCEPT}>` inside the field, clicked synchronously from `+`; on change `validateVideoFile`; invalid → the error under the field, valid → `onVideoChange(file)`. The button's name: "Add a video".
- [ ] **Drop:** a video file dropped anywhere on the field → validated → `onVideoChange`; any other file → `onDropFile`.
- [ ] **Send / Stop:** send `type="submit"`, `aria-label={sendLabel}`, disabled unless `canSend && online && !busy`, shows a spinner while `busy`; while `streaming` it is Stop (`aria-label="Stop the run"`, `type="button"`, `onClick={onStop}`).
- [ ] **Focus:** the field owns its textarea ref and returns focus to the text after a pill tap, a More pick and removing the tile.
- [ ] **More sheet:** bottom sheet on the phone, a popover above the field on desktop (as drawn); rows Ideas, Explore, Your account (each `price` "1 credit" / "5 credits"), "Read a file" (`readFilePrice`); then "Audience": the current audience row (opens `onOpenAudience`) and the TikTok / Instagram / YouTube segmented lens. Escape closes.
- [ ] **Guard** `thread-next-guard.test.ts`: every file in `src/components/thread-next/` has no colour literal; `backdropFilter` appears only in `thread-field.tsx` (copy the method of `src/components/shell/__tests__/shell-guard.test.ts`).
- [ ] **Dev page** `/dev/field?state=rest|hooks|typed|video|simulate|more|streaming` renders `ThreadField` and `MoreSheet` with local state over a plain background (notFound with the flag off, as `/dev/result` does).
- [ ] **Tests first** (happy-dom, real components): each pill selects its tool and a second tap calls `onSelectTool("chat")`; the Simulate pill selects `"test"`; the price shows only on the selected pill; `+` opens the picker and a valid file calls `onVideoChange`, an invalid one shows the error and does not; the tile shows the length and "Remove video" clears it; a dropped video goes to `onVideoChange`, a dropped `.txt` to `onDropFile`; send is disabled when `canSend` is false and submits the form when true; Stop calls `onStop` and is not a submit; the brief shows only while `tool === "test"`; More rows call `onSelectSkill` / `onReadFile`; the lens changes; Escape closes the sheet; the field's text and every control have names.
- [ ] **Browser:** the dev page in each state, phone and desktop, light and dark, measured against `field-boxes.json`; a side-by-side sheet with the reference renders (`.scratch/next-look/sbs.cjs`).

### Task 3: The composer renders the new field under the flag

**Files:** modify `src/components/app/home/composer.tsx`, the phone room's sheet component (path in seam map §5.4); create `src/components/app/home/__tests__/composer-next-field.flag-on.test.tsx`.

**Consumes:** Task 1 and 2. Seam map §1.2 (every prop's source), §2 (the attachments), §5.2 to §5.4 (dock, room), §8 (the prop table).

- [ ] Under `NEW_LOOK_ENABLED`, THE BOX (`composer.tsx` ~3677-3695) renders `<ThreadField …>` built from existing state exactly as seam map §8's table says; no plate, no `composer-veil`, no legacy box chrome. Flag off: the same JSX as today.
- [ ] `onVideoChange = (f) => { setFile(f); if (f) handleUserSelectTool("test"); }`; the tile shows only while `activeTool === "test"` (the staged file is never cleared after a send today, and the failure retry re-reads it: do not change that).
- [ ] Evidence: the More sheet's "Read a file" calls `evidenceInputRef.current?.click()` synchronously; the evidence `<input>` stays mounted; a staged evidence file shows as a chip in the field; a dropped non-video file calls today's `acceptEvidenceFile`.
- [ ] `moreArmed`: when the selected tool is Ideas, Explore or Your account, `{ label, price }` from `SKILLS` and `BILLABLE_BY_TOOL`.
- [ ] Placeholders (flag-on copy): rest "Message Maven"; `test` without a video "Add a video or paste a link"; `test` with a video "Send to simulate this video"; hooks "A topic for your hooks"; other tools today's `PLACEHOLDER_BY_TOOL` text. `ariaLabel` and `sendLabel`: today's strings, unchanged.
- [ ] The phone room: under the flag the room's sheet stays mounted without its legacy bar (add an optional `barless` prop if it has none), so a card door that opens the room still shows it.
- [ ] Scroll reserve: under the flag the thread's bottom padding is the new field's height plus its bottom offset (measure; today 184 / 240).
- [ ] Out of the new field under the flag: the skill pill + skills panel (replaced by More), the model selector, the armed-skill tag. The Explore params popover stays reachable while Explore is selected (keep `ComposerControls` mounted for it).
- [ ] Tests first (`composer-next-field.flag-on.test.tsx`, mocking the flag and the stream hooks' network as the existing composer tests do): pill Hooks selects hooks and the next send calls the hooks stream once with the typed topic; Simulate selects `test`; a picked video stages the file and selects Simulate, and sending it reaches the existing upload path (stand in for the storage upload); "Read a file" clicks the evidence input; a staged evidence file + send runs the profile read (the form path); Enter with text and no evidence sends chat; Stop sends one abort; the room's sheet is mounted. Every existing composer test still passes untouched.
- [ ] Browser: a real thread of the test user on `/home` (phone and desktop, light and dark), against the reference.

### Task 4: The thread frame

**Files:** create `src/components/thread-next/user-turn.tsx`, `assistant-label.tsx`, `followup-chips.tsx` (+ tests); modify `thread-shell.tsx`, `followup-row.tsx`, `thread-turn.tsx`, `persisted-thread-stream.tsx`, `src/components/offer/hero-product-window.tsx`.

- [ ] `ThreadUserTurn` under the flag renders the new bubble (right-aligned, as drawn), keeping `<h2 className="sr-only">You</h2>`; an optional `video?: { posterUrl?: string | null; durationLabel?: string | null }` shows the tile above it (live turn: the composer's staged file via `useVideoMeta`; reloaded turn: the same turn's `video-test-card` block's first frame and `durationLabel`; neither → no tile).
- [ ] `ThreadAssistantTurn` under the flag: the same `<h2>` "Maven", new-look classes as drawn.
- [ ] `FollowupRow` under the flag: each chip a `Chip` with `aria-label={"Follow up: " + label}`, `data-testid="followup-row"` kept, wrap gap as drawn.
- [ ] `ThreadTurn` gains `showFollowups?: boolean` (default `true`); `PersistedThreadStream` passes `!NEW_LOOK_ENABLED || isLastTurn`.
- [ ] The offer hero passes an opt-out so it keeps the legacy bubble and label under the flag.
- [ ] Tests first: flag-on bubble, label, chips render with their names and headings; chips only under the last turn under the flag, under every settled turn without it (existing `run-header.test.tsx:159` and `chat-turn.test.tsx:305` stay green); the offer hero is unchanged under the flag.
- [ ] Browser: the reference's "whole turn" state on a real thread.

### Task 5: Checks (controller)

- [ ] In a browser on a real thread: one chat send, one Hooks run (1 credit) through the new field; a video picked with `+` reaches the upload (stop before it uploads, or run it once: 10 credits, the owner's test account).
- [ ] Keyboard: Tab order text → pills → More → send; Enter sends; Escape closes More; focus visible.
- [ ] Flag off: `node scripts/next-look-probe.cjs` against the baseline; the composer tests untouched.
- [ ] Full suite (run alone; it flakes under load), `tsc`, `eslint`, `pnpm build`.
- [ ] Independent review of the slice; fix what holds.
- [ ] Sheets: built against reference. Update `docs/DESIGN-SYSTEM.md` (Next look: the field and frame), the spec's status line, and the Result section below.

## Spec coverage

| Spec | Task |
|---|---|
| §4.1 the field, two rows, no mic, glass | 2, 3 |
| §4.2 `+` adds a video, selects Simulate | 1, 2, 3 |
| §4.3 the pills, prices, one-shot, Simulate needs a video, More | 1, 2, 3 |
| §4.4 the frame: bubble, label, chips under the last answer | 4 |
| §4.5 nothing else changes | 3 (tests), 5 |
| §7 done-when 1 to 8 | 2 to 5 |
| §9 planning decisions | 3, 4 |

## Result (2026-11-21)

Built and reviewed; nothing committed until the owner says so.

| Check | Result |
|---|---|
| The real app, in a browser (phone, `localhost:3021`) | A chat send answered in about 20 s with the bubble, the "Maven" label and the chips; a Hooks run gave 5 cards and the field went back to chat; `+` staged a clip, selected "Simulate · 10", named the send "Send to simulate", and the simulation's card arrived; a double tap on the first send of a new chat started one thread and one run; after a finished video run, Simulate showed no tile and could not send |
| Flag off | A production build without the flag matched the recorded baseline: 1,164 token values (after whitespace), landmarks and `<html>` attributes; `/simulation/x` and `/dev/field` answer "Page not found"; the screens show the old look and the old field |
| Suites | Full suite alone 634 files / 7,621 tests before the final fix wave; the touched folders 1,128 passed after it; `tsc` clean; eslint 0 errors (the 7 warnings are older) |
| Reviews | A task review and scoped re-reviews on every task (Task 2: two fix rounds, Task 3: three, Task 4: two), one whole-slice review ("ready after fixes"), one fix wave, one scoped re-review |

**Where the build departs from the plan** (rulings during the build; the ledger has each):
`+` and send sit in row 1 (width); one attachment at a time, and selecting a skill clears a staged file;
staging a file returns the field to chat; a skill picked from More shows on More like a pill ("Ideas · 1",
"Account · 5"); phone pill padding 7 (drawn 8); the send is named "Send to simulate" while Simulate is
selected; placeholders shortened (one module, `field-copy.ts`); no balance line under the field; chips
under the last answer; link turns show no tile; under the flag Enter submits like the send button; a
finished run clears its staged clip and brief; a latch stops a second send during the first send of a
new chat.

**Open**

- **Known residual (Important, under the flag only):** a clip re-sent under the same file name as the
  previous turn stays staged after its run, so selecting Simulate again would upload it again (10
  credits) ahead of a pasted link. Fix: record what a run sent where the run is armed, not in an effect.
- Minor: Enter skips the button's online / no-stream checks (older behaviour); `requestSubmit` is missing
  on Safari 15 and older; the thread loading skeleton keeps the old "MAVEN" label; the stored frame
  links of older video runs have expired, so their tiles show the length only.
- Not checked: iOS Safari and a real phone keyboard over the field; a screen reader on a device.
- Testing sends in a browser on the dev server: open it at `localhost`, not `127.0.0.1` (the app's
  cross-site check refuses POSTs from a different host name).
