# Offline + Expired Session Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A run that fails because the device is offline, or because the session died, says which — instead of the generic "the generation or SIM-1 pass dropped out."

**Architecture:** Two mechanisms, because the failures differ in kind. Offline is ambient device state (`useSyncExternalStore` over `window`'s online/offline events) read by a persistent notice and by the composer's send gate. Expired session is a response, so it mirrors `credit-wall.ts` exactly — one event, one listener, one line per fetch site — and deliberately does **not** navigate, because `AuthGuard` is the declared single owner of the `/login` redirect (WR-04). The cause is classified in each stream hook's `catch` and carried to the glass as a sentinel string, because `live.error` is typed `string | null` and destroys an Error object before the render site ever sees it.

**Tech Stack:** Next.js 15.5 (App Router, `src/proxy.ts`), React 19, TypeScript, Tailwind v4, Supabase (`@supabase/ssr`), Vitest + Testing Library + happy-dom.

**Spec:** `docs/superpowers/specs/2026-08-07-offline-and-expired-session-design.md`

## Global Constraints

Every task's requirements implicitly include all of these.

- **No accent colour, anywhere in this work.** The accent dosage rule is LOCKED: monochrome by default, sanctioned uses are the live-presence dot, the lit constellation node, and the brand mark. An offline banner is none of them. Use `var(--color-cream-secondary)` / `var(--color-cream-muted)`, `border-white/[0.06]`. **Never `#fff`.** Severity is carried by words, not colour.
- **Never claim connectivity.** `navigator.onLine === true` does not mean reachable (captive portals). Only ever special-case the negative.
- **A `TypeError` from `fetch` is not proof of offline** — CORS, DNS, and an unreachable server all produce it. Require `navigator.onLine === false` as well.
- **`AbortError` is never a failure.** That is the user tapping Stop.
- **Do not add a second `router.replace` owner.** `AuthGuard` (`src/components/app/auth-guard.tsx:42`) owns the post-logout redirect. Two competing router calls made the landing route non-deterministic once already (WR-04, `Sidebar.tsx:757`).
- Test files opt into DOM with `/** @vitest-environment happy-dom */` on line 1. Default env is `node`.
- Run `./node_modules/.bin/vitest` and `./node_modules/.bin/tsc`, **never `npx`** — the npx wrapper here swallows stderr, so unhandled rejections go invisible.
- Commit format: `type(scope): description`.
- Do not push or open a PR until Task 11 passes.

---

## File Structure

| Path | Responsibility | Task |
|---|---|---|
| `src/hooks/use-online.ts` | Ambient online/offline state. One export, no UI. | 1 |
| `src/lib/net/run-failure.ts` | Pure: classify a caught error → cause sentinel; resolve cause+skill → copy. No React, no DOM writes. | 2 |
| `src/components/app/offline-notice.tsx` | The persistent bar. Reads `useOnline`, renders nothing when online. | 5 |
| `src/lib/auth/session-expired.ts` | 1:1 mirror of `lib/billing/credit-wall.ts`. Event, reporter, refusal throwable. | 8 |
| `src/components/app/session-expired-listener.tsx` | Mirror of `credit-wall-listener.tsx`. Renders the dialog. | 9 |
| `src/app/(app)/providers.tsx` | Modified: mounts both new listeners beside `CreditWallListener`. | 5, 9 |
| `src/components/thread/run-notices.tsx` | Modified: retry disables while offline. | 7 |
| `src/components/thread/thread-turn.tsx` | Modified: copy resolves cause → skill → default. | 3 |
| `src/components/app/home/composer.tsx` | Modified: send gate folds in offline (non-streaming arm only). | 6 |
| 14 files, 20 sites | Modified: one `reportSession401` line each. | 10 |

---

## Task 1: The `useOnline` hook

**Files:**
- Create: `src/hooks/use-online.ts`
- Test: `src/hooks/__tests__/use-online.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `useOnline(): boolean` — `true` when the browser reports a connection or when rendering on the server.

- [ ] **Step 1: Write the failing test**

```tsx
/** @vitest-environment happy-dom */

import { describe, it, expect, afterEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";

import { useOnline } from "@/hooks/use-online";

afterEach(() => {
  cleanup();
  // happy-dom keeps navigator.onLine across tests; restore the default.
  Object.defineProperty(window.navigator, "onLine", { value: true, configurable: true });
});

function setOnLine(value: boolean) {
  Object.defineProperty(window.navigator, "onLine", { value, configurable: true });
}

describe("useOnline", () => {
  it("reports the browser's current state on first render", () => {
    setOnLine(false);
    const { result } = renderHook(() => useOnline());
    expect(result.current).toBe(false);
  });

  it("flips to false when the browser fires `offline`", () => {
    setOnLine(true);
    const { result } = renderHook(() => useOnline());
    expect(result.current).toBe(true);

    act(() => {
      setOnLine(false);
      window.dispatchEvent(new Event("offline"));
    });

    expect(result.current).toBe(false);
  });

  it("flips back to true when the browser fires `online`", () => {
    setOnLine(false);
    const { result } = renderHook(() => useOnline());
    expect(result.current).toBe(false);

    act(() => {
      setOnLine(true);
      window.dispatchEvent(new Event("online"));
    });

    expect(result.current).toBe(true);
  });

  it("unsubscribes on unmount — a dispatched event must not update a dead hook", () => {
    setOnLine(true);
    const { result, unmount } = renderHook(() => useOnline());
    unmount();

    act(() => {
      setOnLine(false);
      window.dispatchEvent(new Event("offline"));
    });

    // The last committed value stays; no act() warning, no update after unmount.
    expect(result.current).toBe(true);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails for the right reason**

Run: `./node_modules/.bin/vitest run src/hooks/__tests__/use-online.test.ts`
Expected: FAIL — cannot resolve `@/hooks/use-online`.

- [ ] **Step 3: Implement**

```ts
"use client";

/**
 * Ambient connection state — is this device reporting a network at all?
 *
 * `useSyncExternalStore` rather than `useState(navigator.onLine)` because `navigator` does not
 * exist while rendering on the server: the naive form throws in SSR, and the `useEffect` variant
 * hydration-mismatches (server paints "online", client immediately repaints "offline"). The
 * server snapshot is hardcoded `true` — the honest default, since a server render knows nothing
 * about the visitor's radio and a page that paints "you are offline" before hydration is a lie.
 *
 * ⚠️ `true` here does NOT mean reachable. A captive portal reports `onLine: true` while dropping
 * every request. Nothing in this codebase may use a `true` reading to CLAIM connectivity; the
 * only sound use is special-casing the negative.
 */

import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void): () => void {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

const getSnapshot = (): boolean => navigator.onLine;

/** The server knows nothing about the visitor's connection. Assume online; never paint a lie. */
const getServerSnapshot = (): boolean => true;

export function useOnline(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
```

- [ ] **Step 4: Run the test — expect 4 passing**

Run: `./node_modules/.bin/vitest run src/hooks/__tests__/use-online.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/hooks/use-online.ts src/hooks/__tests__/use-online.test.ts
git commit -m "feat(net): useOnline — ambient connection state, SSR-safe"
```

---

## Task 2: The failure classifier and the copy resolver

This is the honesty core. Both functions are pure and DOM-free apart from reading `navigator.onLine`.

**Files:**
- Create: `src/lib/net/run-failure.ts`
- Test: `src/lib/net/__tests__/run-failure.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type RunFailureCause = "offline" | "session"`
  - `const RUN_FAILURE_SENTINEL: Record<RunFailureCause, string>` — the strings hooks put into `live.error`
  - `classifyRunFailure(err: unknown): RunFailureCause | null`
  - `isAbort(err: unknown): boolean`
  - `runErrorCopy(error: string | null | undefined, skill: string): { headline: string; body: string; retryLabel: string }`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, afterEach } from "vitest";

import {
  classifyRunFailure,
  isAbort,
  runErrorCopy,
  RUN_FAILURE_SENTINEL,
} from "@/lib/net/run-failure";

const originalOnLine = Object.getOwnPropertyDescriptor(globalThis.navigator ?? {}, "onLine");

function setOnLine(value: boolean) {
  Object.defineProperty(globalThis, "navigator", {
    value: { onLine: value },
    configurable: true,
    writable: true,
  });
}

afterEach(() => {
  if (originalOnLine) Object.defineProperty(globalThis.navigator, "onLine", originalOnLine);
});

describe("classifyRunFailure", () => {
  it("calls a fetch TypeError OFFLINE only when the browser also says so", () => {
    setOnLine(false);
    expect(classifyRunFailure(new TypeError("Failed to fetch"))).toBe("offline");
  });

  it("does NOT call a TypeError offline while the browser reports a connection", () => {
    // CORS, DNS, and an unreachable host all throw TypeError with navigator.onLine === true.
    // Saying "you're offline" there is a fabricated diagnosis.
    setOnLine(true);
    expect(classifyRunFailure(new TypeError("Failed to fetch"))).toBeNull();
  });

  it("never classifies an AbortError — that is the user tapping Stop, not a failure", () => {
    setOnLine(false);
    const abort = new DOMException("The operation was aborted.", "AbortError");
    expect(classifyRunFailure(abort)).toBeNull();
    expect(isAbort(abort)).toBe(true);
  });

  it("classifies the session refusal by its flag, surviving module duplication", () => {
    setOnLine(true);
    expect(classifyRunFailure({ sessionExpired: true })).toBe("session");
  });

  it("returns null for an ordinary engine error", () => {
    setOnLine(true);
    expect(classifyRunFailure(new Error("Ideas request failed"))).toBeNull();
  });
});

describe("runErrorCopy — cause beats skill", () => {
  it("an OFFLINE explore run does not blame the handle", () => {
    const copy = runErrorCopy(RUN_FAILURE_SENTINEL.offline, "explore");
    expect(copy.body).not.toMatch(/handle/i);
    expect(copy.headline).toMatch(/offline|connection/i);
  });

  it("an ONLINE explore failure keeps the skill's own copy", () => {
    const copy = runErrorCopy("some engine error", "explore");
    expect(copy.body).toMatch(/handle or niche/i);
  });

  it("falls back to the generic copy for a skill with no override", () => {
    const copy = runErrorCopy("some engine error", "hooks");
    expect(copy.body).toMatch(/dropped out/i);
  });

  it("the session sentinel outranks every skill's copy too", () => {
    const copy = runErrorCopy(RUN_FAILURE_SENTINEL.session, "account");
    expect(copy.body).not.toMatch(/handle/i);
    expect(copy.headline).toMatch(/session|signed out/i);
  });

  it("states nothing was charged for both causes — neither reached the engine", () => {
    for (const cause of ["offline", "session"] as const) {
      expect(runErrorCopy(RUN_FAILURE_SENTINEL[cause], "ideas").body).toMatch(/nothing was charged/i);
    }
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `./node_modules/.bin/vitest run src/lib/net/__tests__/run-failure.test.ts`
Expected: FAIL — cannot resolve `@/lib/net/run-failure`.

- [ ] **Step 3: Implement**

```ts
/**
 * WHY A RUN FAILED, AND WHAT TO SAY ABOUT IT.
 *
 * Two rules, both learned the expensive way:
 *
 * 1. CAUSE BEATS SKILL. `thread-turn.tsx` keys its error copy by skill, so an Explore run that
 *    dies offline says "Check the handle or niche" — accusing a handle that is fine. That is the
 *    same defect PR #449 fixed in calibrate, where the client overwrote three honest server
 *    reasons with "Account not found. Check the handle", an accusation the route's own comment
 *    says "costs the creator another paid scrape to act on".
 *
 * 2. NEVER DIAGNOSE WHAT YOU CANNOT SEE. A fetch TypeError is not proof of being offline — CORS,
 *    DNS and an unreachable host produce the identical error with the radio up. So the offline
 *    verdict requires `navigator.onLine === false` as corroboration, and a `true` reading is
 *    never used to claim the opposite (a captive portal reports online while dropping everything).
 *
 * The cause travels to the glass as a SENTINEL STRING because `live.error` is typed
 * `string | null` (thread-turn.tsx:106) — an Error object cannot survive the trip.
 */

export type RunFailureCause = "offline" | "session";

/** What a hook writes into its `error` state. Namespaced so it can never collide with a real message. */
export const RUN_FAILURE_SENTINEL: Record<RunFailureCause, string> = {
  offline: "maven:run-failure/offline",
  session: "maven:run-failure/session",
};

/** The user pressed Stop, or the component unmounted. Not a failure; renders nothing. */
export function isAbort(err: unknown): boolean {
  return !!err && typeof err === "object" && (err as { name?: unknown }).name === "AbortError";
}

/**
 * Identified by a FLAG rather than `instanceof`, so the check survives module duplication —
 * the same reason `isCreditWallRefusal` works this way.
 */
function isSessionRefusal(err: unknown): boolean {
  return !!err && typeof err === "object" && (err as { sessionExpired?: unknown }).sessionExpired === true;
}

export function classifyRunFailure(err: unknown): RunFailureCause | null {
  if (isAbort(err)) return null;
  if (isSessionRefusal(err)) return "session";

  const isNetworkTypeError = err instanceof TypeError;
  const browserSaysOffline = typeof navigator !== "undefined" && navigator.onLine === false;
  if (isNetworkTypeError && browserSaysOffline) return "offline";

  return null;
}

type Copy = { headline: string; body: string; retryLabel: string };

/** Cause copy — outranks every skill's copy, because the cause is the more specific truth. */
const CAUSE_COPY: Record<RunFailureCause, Copy> = {
  offline: {
    headline: "You’re offline.",
    body: "That run never left the device — nothing was charged. It’ll work once you’re back on.",
    retryLabel: "Retry once you’re back online",
  },
  session: {
    headline: "You’ve been signed out.",
    body: "Your session ended before that run started — nothing was charged. Sign in again to pick up where you left off.",
    retryLabel: "Retry after signing in",
  },
};

/** Per-skill copy — moved here from thread-turn.tsx so cause and skill resolve in one place. */
const SKILL_COPY: Record<string, Copy> = {
  explore: {
    headline: "Couldn’t reach that source.",
    body: "Check the handle or niche and try again — nothing was charged.",
    retryLabel: "Retry the Explore pull",
  },
  account: {
    headline: "Couldn’t read that account.",
    body: "Check the handle and try again — nothing was charged.",
    retryLabel: "Retry the account read",
  },
};

const DEFAULT_COPY: Copy = {
  headline: "Couldn’t finish that run.",
  body: "The generation or SIM-1 pass dropped out. Tap to retry — nothing was charged.",
  retryLabel: "Retry the run",
};

/** Cause first, skill second, default last. */
export function runErrorCopy(error: string | null | undefined, skill: string): Copy {
  for (const cause of Object.keys(CAUSE_COPY) as RunFailureCause[]) {
    if (error === RUN_FAILURE_SENTINEL[cause]) return CAUSE_COPY[cause];
  }
  return SKILL_COPY[skill] ?? DEFAULT_COPY;
}
```

- [ ] **Step 4: Run the test — expect 10 passing**

Run: `./node_modules/.bin/vitest run src/lib/net/__tests__/run-failure.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/lib/net/run-failure.ts src/lib/net/__tests__/run-failure.test.ts
git commit -m "feat(net): classify run failures by cause, and resolve copy cause-first"
```

---

## Task 3: Wire the cause through one hook and the glass

Proves the whole path end to end on the smallest surface before it is repeated. `use-ideas-stream.ts` is the reference because it has two `reportCredit402` sites and the fullest catch.

**Files:**
- Modify: `src/hooks/queries/use-ideas-stream.ts` (the outer `catch` of the run)
- Modify: `src/components/thread/thread-turn.tsx:70-81` (delete local `ERROR_COPY`), `:319-324` (call `runErrorCopy`)
- Test: `src/components/thread/__tests__/thread-turn-error-copy.test.tsx`

**Interfaces:**
- Consumes: `classifyRunFailure`, `RUN_FAILURE_SENTINEL`, `runErrorCopy`, `isAbort` from Task 2.
- Produces: the convention every remaining hook copies in Task 4 — on catch, `setError(RUN_FAILURE_SENTINEL[cause] ?? message)`.

- [ ] **Step 1: Write the failing test**

```tsx
/** @vitest-environment happy-dom */

import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

import { ThreadTurn } from "@/components/thread/thread-turn";
import type { ChatTurnKind } from "@/lib/tools/chat-followups";
import { RUN_FAILURE_SENTINEL } from "@/lib/net/run-failure";

afterEach(cleanup);

/**
 * `skill` is NOT a prop. ThreadTurn derives it (`thread-turn.tsx:196`):
 *   live?.skill ?? header?.skill ?? classifyTurn(blockTypes)
 * so the live run is how a test names the skill. `LiveRun` requires `skill` + `isStreaming`.
 */
function renderError(error: string, skill: ChatTurnKind) {
  return render(
    <ThreadTurn
      blocks={[]}
      live={{ skill, isStreaming: false, stages: [], error, onRetry: () => {} }}
    />,
  );
}

describe("the glass resolves cause before skill", () => {
  it("an OFFLINE explore failure does not accuse the handle", () => {
    const { container } = renderError(RUN_FAILURE_SENTINEL.offline, "explore");
    expect(container.textContent).not.toMatch(/handle or niche/i);
    expect(container.textContent).toMatch(/offline/i);
  });

  it("an ordinary explore failure still gets Explore's own copy", () => {
    const { container } = renderError("Explore request failed", "explore");
    expect(container.textContent).toMatch(/handle or niche/i);
  });

  it("never renders the raw sentinel to the user", () => {
    const { container } = renderError(RUN_FAILURE_SENTINEL.offline, "ideas");
    expect(container.textContent).not.toContain("maven:run-failure");
  });

  it("keeps the alert role — a failure must be announced, not merely drawn", () => {
    renderError(RUN_FAILURE_SENTINEL.offline, "ideas");
    expect(screen.getByRole("alert")).toBeTruthy();
  });
});
```

> If `ThreadTurn`'s props differ from the shape above, read the component and fix the harness — do not change the assertions.

- [ ] **Step 2: Run it and confirm it fails**

Run: `./node_modules/.bin/vitest run src/components/thread/__tests__/thread-turn-error-copy.test.tsx`
Expected: FAIL — the offline case renders "Check the handle or niche".

- [ ] **Step 3: Replace the skill-keyed lookup at the glass**

Delete the local `ERROR_COPY` map at `thread-turn.tsx:70-81` (it moved to `run-failure.ts` in Task 2), add the import, and replace the render site at `:319-324`:

```tsx
import { runErrorCopy } from '@/lib/net/run-failure';

// …

{hasError && (() => {
  const copy = runErrorCopy(live?.error, skill);
  return (
    <SkillRunError
      onRetry={live?.onRetry}
      retryLabel={copy.retryLabel}
      headline={copy.headline}
      body={copy.body}
    />
  );
})()}
```

- [ ] **Step 4: Make the hook record the cause**

In `use-ideas-stream.ts`, in the outer `catch` that currently sets the error state:

```ts
} catch (err) {
  // An abort is the user tapping Stop — not a failure, and it must draw nothing.
  if (isAbort(err)) return;
  // The wall dialog is up and IS the UI; drawing an error under it is the futile-retry bug.
  if (isCreditWallRefusal(err)) return;

  const cause = classifyRunFailure(err);
  setError(cause ? RUN_FAILURE_SENTINEL[cause] : (err as Error)?.message ?? 'Ideas request failed');
}
```

Add to the existing import block:

```ts
import { classifyRunFailure, isAbort, RUN_FAILURE_SENTINEL } from '@/lib/net/run-failure';
```

> Read the real `catch` before editing — preserve every existing branch (`finally` resets, stream teardown). Only the error-setting line changes.

- [ ] **Step 5: Run the test and the hook's existing suite**

Run: `./node_modules/.bin/vitest run src/components/thread/__tests__/ src/hooks/queries/__tests__/`
Expected: the 4 new tests pass and **no existing test regresses**. If a test asserted the old per-skill copy from `thread-turn.tsx`, it should still pass — the strings were moved verbatim, not rewritten.

- [ ] **Step 6: Commit**

```bash
git add src/components/thread/thread-turn.tsx src/hooks/queries/use-ideas-stream.ts src/components/thread/__tests__/thread-turn-error-copy.test.tsx
git commit -m "feat(thread): resolve run-error copy by cause first, skill second"
```

---

## Task 4: Roll the catch convention to the remaining stream hooks

**Files (modify the outer `catch` in each):**
- `src/hooks/queries/use-hooks-stream.ts`
- `src/hooks/queries/use-script-stream.ts`
- `src/hooks/queries/use-explore-stream.ts`
- `src/hooks/queries/use-remix-stream.ts`
- `src/hooks/queries/use-chat-stream.ts`
- `src/hooks/queries/use-account-read-stream.ts`
- `src/hooks/queries/use-analysis-stream.ts` — ⚠️ **easy to miss.** It is the one stream hook
  with **zero** `reportCredit402` calls, so it does not appear in the §4 call-site table and
  is invisible to any list derived from that set. It has a real error path all the same
  (`error: string | null` + `setError`, `use-analysis-stream.ts:106,149`) and handles the
  quota inline via `isCreditQuotaExceeded` rather than through the shared reporter. It needs
  the cause classification like every other hook; it does **not** get a `reportSession401`
  line in Task 10.

**Interfaces:**
- Consumes: the Task 3 convention verbatim.
- Produces: every skill run now reports its cause.

- [ ] **Step 1: Write the failing guard first**

Create `src/hooks/queries/__tests__/every-stream-classifies.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * A drift guard, not a behaviour test. Six hooks each own a catch block, and a seventh added
 * later will not be covered by any of the per-hook tests — it will simply render the generic
 * copy again, which is the exact defect this lane exists to remove.
 */
const DIR = join(process.cwd(), "src/hooks/queries");

describe("every stream hook classifies its failures", () => {
  const streams = readdirSync(DIR).filter((f) => /^use-.*-stream\.ts$/.test(f));

  it("finds the stream hooks at all — a rename must fail loudly, not vacuously pass", () => {
    // 8 today: account-read, analysis, chat, explore, hooks, ideas, remix, script.
    // `analysis` is the one with no reportCredit402 call, so any list derived from the
    // credit-wall set silently omits it — which is exactly why this guard reads the directory.
    expect(streams.length).toBeGreaterThanOrEqual(8);
  });

  it.each(streams)("%s classifies its caught errors", (file) => {
    const src = readFileSync(join(DIR, file), "utf8");
    expect(src, `${file} never calls classifyRunFailure`).toContain("classifyRunFailure");
    expect(src, `${file} never guards on isAbort`).toContain("isAbort");
  });
});
```

- [ ] **Step 2: Run it — expect failures for every hook not yet converted**

Run: `./node_modules/.bin/vitest run src/hooks/queries/__tests__/every-stream-classifies.test.ts`
Expected: FAIL for all but `use-ideas-stream.ts`.

- [ ] **Step 3: Convert each hook**

For each file, apply the Task 3 Step 4 edit, changing only the fallback message to that hook's existing one. Read each `catch` first; several have hook-specific teardown that must survive untouched.

- [ ] **Step 4: Run the guard plus the full hooks suite**

Run: `./node_modules/.bin/vitest run src/hooks/`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/queries/
git commit -m "feat(streams): every stream hook classifies its failure cause"
```

---

## Task 5: The offline notice

**Files:**
- Create: `src/components/app/offline-notice.tsx`
- Modify: `src/app/(app)/providers.tsx`
- Test: `src/components/app/__tests__/offline-notice.test.tsx`

**Interfaces:**
- Consumes: `useOnline` (Task 1).
- Produces: `<OfflineNotice />`, self-mounting, no props.

- [ ] **Step 1: Write the failing test**

```tsx
/** @vitest-environment happy-dom */

import { describe, it, expect, afterEach } from "vitest";
import { render, screen, act, cleanup } from "@testing-library/react";

import { OfflineNotice } from "@/components/app/offline-notice";

afterEach(() => {
  cleanup();
  Object.defineProperty(window.navigator, "onLine", { value: true, configurable: true });
});

function setOnLine(value: boolean) {
  Object.defineProperty(window.navigator, "onLine", { value, configurable: true });
}

describe("OfflineNotice", () => {
  it("renders nothing at all while online — zero chrome for the normal case", () => {
    setOnLine(true);
    const { container } = render(<OfflineNotice />);
    expect(container.firstChild).toBeNull();
  });

  it("appears when the connection drops and states what it means", () => {
    setOnLine(false);
    render(<OfflineNotice />);
    const note = screen.getByRole("status");
    expect(note.textContent).toMatch(/offline/i);
  });

  it("is polite, not an alert — it is a standing condition, not an event", () => {
    setOnLine(false);
    render(<OfflineNotice />);
    expect(screen.getByRole("status").getAttribute("aria-live")).toBe("polite");
  });

  it("disappears the moment the connection returns", () => {
    setOnLine(false);
    render(<OfflineNotice />);
    expect(screen.queryByRole("status")).toBeTruthy();

    act(() => {
      setOnLine(true);
      window.dispatchEvent(new Event("online"));
    });

    expect(screen.queryByRole("status")).toBeNull();
  });

  it("carries NO accent — the dosage rule is locked, severity is carried by words", () => {
    setOnLine(false);
    const { container } = render(<OfflineNotice />);
    const html = container.innerHTML;
    expect(html).not.toMatch(/#FF6363/i);
    expect(html).not.toMatch(/--color-accent/);
    expect(html).not.toMatch(/#fff\b/i);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `./node_modules/.bin/vitest run src/components/app/__tests__/offline-notice.test.tsx`

- [ ] **Step 3: Implement**

```tsx
"use client";

/**
 * THE STANDING OFFLINE CONDITION.
 *
 * A bar, not a dialog: a modal would trap a user in the one state they cannot act on. It is
 * `role="status"` + `aria-live="polite"` rather than an alert because being offline is a
 * condition the user is already living in, not an event to interrupt them with.
 *
 * ⚠️ NO ACCENT. This is exactly where a red fill feels natural, and the accent dosage rule is
 * LOCKED — the sanctioned uses are the live-presence dot, the lit constellation node and the
 * brand mark, and this is none of them. The words carry the severity.
 */

import { useOnline } from "@/hooks/use-online";

export function OfflineNotice() {
  const online = useOnline();
  if (online) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 top-[var(--mobile-nav-band,0px)] z-50 border-b border-white/[0.06] px-4 py-2 text-center text-sm"
      style={{ background: "var(--color-chrome)", color: "var(--color-cream-secondary)" }}
    >
      You’re offline. Nothing will send until the connection is back.
    </div>
  );
}
```

⚠️ **It must not sit at the bottom.** The composer dock is `absolute inset-x-0 bottom-0`
(`composer.tsx:3535`), so a `bottom-0` bar lands directly on top of the send button whose
disabled state this notice exists to explain. It goes to the top instead, offset by
`--mobile-nav-band` (set on the shell at `app-shell.tsx:172`, derived from
`MOBILE_NAV_BAND` in `Sidebar.tsx:819`) so it clears the fixed mobile burger rather than
covering that too. **Both clearances are verified in the browser in Task 11, at both
viewports** — this is a layout claim, and jsdom cannot see it.

> `--color-chrome` is `#1a1a19`, verified in `globals.css:68`. (There is no `--color-charcoal-chrome`; the near-neighbours are `--color-charcoal-chip` `#2c2c2b` and `--color-charcoal-composer` `#1a1a19`.) `globals.css` is the SSOT — if any of this disagrees with it, measure and trust the CSS.

- [ ] **Step 4: Mount it in providers**

In `src/app/(app)/providers.tsx`, beside the existing listener:

```tsx
import { OfflineNotice } from "@/components/app/offline-notice";

// …inside the provider tree, after <CreditWallListener />:
      {/* The standing offline condition — renders nothing while online. */}
      <OfflineNotice />
```

- [ ] **Step 5: Run the tests**

Run: `./node_modules/.bin/vitest run src/components/app/__tests__/offline-notice.test.tsx`
Expected: 5 passing.

- [ ] **Step 6: Commit**

```bash
git add src/components/app/offline-notice.tsx src/components/app/__tests__/offline-notice.test.tsx "src/app/(app)/providers.tsx"
git commit -m "feat(app): a standing offline notice, mounted app-wide"
```

---

## Task 6: The composer send gate

**Files:**
- Modify: `src/components/app/home/composer.tsx:3218`
- Test: `src/components/app/home/__tests__/composer-offline-gate.test.tsx`

**Interfaces:**
- Consumes: `useOnline` (Task 1).
- Produces: nothing downstream.

- [ ] **Step 1: Write the failing test**

The composer mounts whole in tests already — `renderWithClient(<Composer />)` from `@/test/render-with-client`. **Read `src/components/app/home/__tests__/composer-stop-disc.test.tsx` first**: it mounts the composer and drives this exact button through its streaming state, so its `beforeEach` mocks are the ones this test needs, and it is the precedent for the Stop assertion below.

```tsx
/** @vitest-environment happy-dom */

import { describe, it, expect, afterEach } from "vitest";
import { screen, act, cleanup } from "@testing-library/react";

import { Composer } from "@/components/app/home/composer";
import { renderWithClient } from "@/test/render-with-client";

afterEach(() => {
  cleanup();
  Object.defineProperty(window.navigator, "onLine", { value: true, configurable: true });
});

function setOnLine(value: boolean) {
  Object.defineProperty(window.navigator, "onLine", { value, configurable: true });
}

const sendButton = () => screen.getByRole("button", { name: /generate ideas|send message|simulate/i }) as HTMLButtonElement;

describe("the composer's send button offline", () => {
  it("is disabled while offline", () => {
    setOnLine(false);
    renderWithClient(<Composer />);
    expect(sendButton().disabled).toBe(true);
  });

  it("re-enables the moment the connection returns, with no remount", () => {
    setOnLine(false);
    renderWithClient(<Composer />);

    act(() => {
      setOnLine(true);
      window.dispatchEvent(new Event("online"));
    });

    // Not asserting `false` outright: whether it enables also depends on `canSubmit`, which an
    // empty composer leaves false. Assert only that OFFLINE is no longer the reason.
    expect(sendButton().getAttribute("aria-label")).not.toMatch(/stop/i);
  });

  it("NEVER disables Stop while a run is streaming — losing the connection is when you most want it", () => {
    setOnLine(false);
    // Drive the composer into its streaming state exactly as composer-stop-disc.test.tsx does,
    // then assert the control it becomes:
    const stop = screen.getByRole("button", { name: /stop the run/i }) as HTMLButtonElement;
    expect(stop.disabled).toBe(false);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

- [ ] **Step 3: Implement — fold offline into the non-streaming arm only**

```tsx
const online = useOnline();

// …at line 3218:
disabled={isAnyStreaming ? false : !online || (evidenceFile ? profiling : !canSubmit)}
```

The `isAnyStreaming ? false` arm is untouched **on purpose**: that control is Stop while a run is in flight (`aria-label="Stop the run"`), and disabling Stop at the moment the connection dies is precisely backwards.

- [ ] **Step 4: Run the composer's full existing suite**

Run: `./node_modules/.bin/vitest run src/components/app/home/`
Expected: green. ⚠️ `composer.test.tsx` carries **3 pre-existing unhandled rejections** whose line numbers move as the file changes — match on the message and the count of 3, never the line. They are not yours.

- [ ] **Step 5: Commit**

```bash
git add src/components/app/home/composer.tsx src/components/app/home/__tests__/composer-offline-gate.test.tsx
git commit -m "feat(composer): gate send on the connection, never Stop"
```

---

## Task 7: Retry follows the connection

**Files:**
- Modify: `src/components/thread/run-notices.tsx:25-56`
- Test: `src/components/thread/__tests__/run-notices-offline.test.tsx`

**Interfaces:**
- Consumes: `useOnline` (Task 1).
- Produces: unchanged public props for `SkillRunError`.

- [ ] **Step 1: Write the failing test**

```tsx
/** @vitest-environment happy-dom */

import { describe, it, expect, afterEach } from "vitest";
import { render, screen, act, cleanup } from "@testing-library/react";

import { SkillRunError } from "@/components/thread/run-notices";

afterEach(() => {
  cleanup();
  Object.defineProperty(window.navigator, "onLine", { value: true, configurable: true });
});

function setOnLine(value: boolean) {
  Object.defineProperty(window.navigator, "onLine", { value, configurable: true });
}

describe("SkillRunError retry", () => {
  it("is disabled while offline — a retry into a dead connection is the futile loop again", () => {
    setOnLine(false);
    render(<SkillRunError onRetry={() => {}} />);
    expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(true);
  });

  it("re-enables on reconnect without a remount", () => {
    setOnLine(false);
    render(<SkillRunError onRetry={() => {}} />);
    act(() => {
      setOnLine(true);
      window.dispatchEvent(new Event("online"));
    });
    expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(false);
  });

  it("still renders no button at all when no retry was given", () => {
    setOnLine(true);
    render(<SkillRunError />);
    expect(screen.queryByRole("button")).toBeNull();
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

- [ ] **Step 3: Implement**

Add `const online = useOnline();` to `SkillRunError` and `disabled={!online}` to the retry button. Keep the button rendered — a connection that returns a second later should not require a remount to act on.

- [ ] **Step 4: Run the thread suite**

Run: `./node_modules/.bin/vitest run src/components/thread/`

- [ ] **Step 5: Commit**

```bash
git add src/components/thread/run-notices.tsx src/components/thread/__tests__/run-notices-offline.test.tsx
git commit -m "feat(thread): retry disables while offline, re-enables on reconnect"
```

---

## Task 8: The session-expired module

A deliberate 1:1 of `src/lib/billing/credit-wall.ts`. Read that file first — the mirror is the point.

**Files:**
- Create: `src/lib/auth/session-expired.ts`
- Test: `src/lib/auth/__tests__/session-expired.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `const SESSION_EXPIRED_EVENT = "maven:session-expired"`
  - `raiseSessionExpired(): void`
  - `reportSession401(status: number): boolean`
  - `class SessionExpiredRefusal extends Error` with `readonly sessionExpired = true`
  - `isSessionExpiredRefusal(err: unknown): boolean`

- [ ] **Step 1: Write the failing test**

```ts
/** @vitest-environment happy-dom */

import { describe, it, expect, vi, afterEach } from "vitest";

import {
  SESSION_EXPIRED_EVENT,
  reportSession401,
  SessionExpiredRefusal,
  isSessionExpiredRefusal,
} from "@/lib/auth/session-expired";

afterEach(() => vi.restoreAllMocks());

describe("reportSession401", () => {
  it("raises the event on a 401 and reports that it did", () => {
    const listener = vi.fn();
    window.addEventListener(SESSION_EXPIRED_EVENT, listener);
    expect(reportSession401(401)).toBe(true);
    expect(listener).toHaveBeenCalledOnce();
    window.removeEventListener(SESSION_EXPIRED_EVENT, listener);
  });

  it("ignores every other status, including the credit 402", () => {
    const listener = vi.fn();
    window.addEventListener(SESSION_EXPIRED_EVENT, listener);
    for (const status of [200, 402, 403, 429, 500]) expect(reportSession401(status)).toBe(false);
    expect(listener).not.toHaveBeenCalled();
    window.removeEventListener(SESSION_EXPIRED_EVENT, listener);
  });
});

describe("SessionExpiredRefusal", () => {
  it("is identified by its flag, so the check survives module duplication", () => {
    expect(isSessionExpiredRefusal(new SessionExpiredRefusal())).toBe(true);
    expect(isSessionExpiredRefusal({ sessionExpired: true })).toBe(true);
    expect(isSessionExpiredRefusal(new Error("nope"))).toBe(false);
    expect(isSessionExpiredRefusal(null)).toBe(false);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

- [ ] **Step 3: Implement**

```ts
/**
 * THE SESSION ENDED, ANNOUNCED FROM ANYWHERE — the client half of the 401.
 *
 * A deliberate 1:1 mirror of lib/billing/credit-wall.ts, so the two refusals are learned once.
 *
 * ⚠️ IT DOES NOT NAVIGATE. `AuthGuard` (components/app/auth-guard.tsx:42) is the declared single
 * owner of the post-logout redirect — WR-04 records what two competing router calls did to the
 * landing route. This module only says the session is gone; the listener explains it, and the
 * user stays exactly where they are. That is also what preserves an unsent composer draft: every
 * piece of composer state is local `useState`, so it survives precisely as long as nothing
 * unmounts it.
 *
 * Client-safe: no server imports. No-ops outside the browser.
 */

export const SESSION_EXPIRED_EVENT = "maven:session-expired";

export function raiseSessionExpired(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
}

/**
 * The one-liner for fetch sites: announce the dead session iff this response is the 401.
 * Returns true when it was — the caller should stop its own error theatrics.
 */
export function reportSession401(status: number): boolean {
  if (status !== 401) return false;
  raiseSessionExpired();
  return true;
}

/**
 * The refusal as a throwable — how a stream hook unwinds without ALSO drawing an error.
 * Same trap as CreditWallRefusal: raising the dialog and then throwing put a futile retry
 * underneath the modal. Identified by a FLAG, not `instanceof`, to survive module duplication.
 */
export class SessionExpiredRefusal extends Error {
  readonly sessionExpired = true;
  constructor(message = "session expired") {
    super(message);
    this.name = "SessionExpiredRefusal";
  }
}

export function isSessionExpiredRefusal(err: unknown): boolean {
  return !!err && typeof err === "object" && (err as { sessionExpired?: unknown }).sessionExpired === true;
}
```

- [ ] **Step 4: Run the test — expect 3 passing**

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/session-expired.ts src/lib/auth/__tests__/session-expired.test.ts
git commit -m "feat(auth): announce an expired session without navigating"
```

---

## Task 9: The session-expired listener

**Files:**
- Create: `src/components/app/session-expired-listener.tsx`
- Modify: `src/app/(app)/providers.tsx`
- Test: `src/components/app/__tests__/session-expired-listener.test.tsx`

**Interfaces:**
- Consumes: `SESSION_EXPIRED_EVENT` (Task 8).
- Produces: `<SessionExpiredListener />`, no props.

Read `src/components/app/credit-wall-listener.tsx` first and mirror its structure and dialog primitive.

- [ ] **Step 1: Write the failing test**

```tsx
/** @vitest-environment happy-dom */

import { describe, it, expect, afterEach } from "vitest";
import { render, screen, act, cleanup } from "@testing-library/react";

import { SessionExpiredListener } from "@/components/app/session-expired-listener";
import { SESSION_EXPIRED_EVENT } from "@/lib/auth/session-expired";

afterEach(cleanup);

function raise() {
  act(() => {
    window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
  });
}

describe("SessionExpiredListener", () => {
  it("renders nothing until the session actually dies", () => {
    const { container } = render(<SessionExpiredListener />);
    expect(container.firstChild).toBeNull();
  });

  it("explains what happened and offers a way back", () => {
    render(<SessionExpiredListener />);
    raise();
    expect(screen.getByRole("dialog").textContent).toMatch(/signed out|session/i);
    expect(screen.getByRole("link", { name: /sign in/i })).toBeTruthy();
  });

  it("sends the user to /login only when they choose to — never on its own", () => {
    render(<SessionExpiredListener />);
    raise();
    expect(screen.getByRole("link", { name: /sign in/i }).getAttribute("href")).toContain("/login");
  });

  it("carries no accent", () => {
    const { container } = render(<SessionExpiredListener />);
    raise();
    expect(container.innerHTML).not.toMatch(/--color-accent|#FF6363/i);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

- [ ] **Step 3: Implement**

Mirror `credit-wall-listener.tsx`: `useEffect` subscribing to `SESSION_EXPIRED_EVENT`, local `open` state, the shared dialog primitive. The action is a **link** to `/login`, not a `router.replace` — the user chooses; `AuthGuard` keeps sole ownership of automatic navigation.

⚠️ Use `w-[calc(100%-2rem)]`, not `w-full max-w-sm`. The shared dialog primitive's `max-w-sm` has **no gutter below the max** — measured at exactly the viewport width (x=0, w=375) on iPhone SE/8, with borders and rounded corners severed by the screen edge. That fix shipped in PR #449 for 16 dialogs; a new dialog must not reintroduce it.

- [ ] **Step 4: Mount in providers, beside the other two**

- [ ] **Step 5: Run the tests**

- [ ] **Step 6: Commit**

```bash
git add src/components/app/session-expired-listener.tsx src/components/app/__tests__/session-expired-listener.test.tsx "src/app/(app)/providers.tsx"
git commit -m "feat(app): explain an expired session instead of silently redirecting"
```

---

## Task 10: The 20 call sites

**Files (20 sites across 14 — the full list is in the spec's §4 table):**
`composer.tsx` ×3 · `input-request-block.tsx` ×3 · `use-ideas-stream.ts` ×2 · `use-hooks-stream.ts` ×2 · `saved-row.tsx` · `SimulateDoorHost.tsx` · `AmbientOverviewRail.tsx` · `idea-card-block.tsx` · `reaction-distribution-block.tsx` · `use-account-read-stream.ts` · `use-script-stream.ts` · `use-explore-stream.ts` · `use-remix-stream.ts` · `use-chat-stream.ts`

**Interfaces:**
- Consumes: `reportSession401`, `SessionExpiredRefusal` (Task 8).
- Produces: nothing downstream.

- [ ] **Step 1: Write the drift guard first**

```ts
import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";

/**
 * Every fetch site that can be refused for credit can equally be refused for a dead session.
 * This guard exists because the two lists drifting apart is invisible: the 401 site simply
 * renders the generic engine copy again, exactly the defect this lane removed.
 *
 * Counted by LISTING, never by piping a filtered grep into `wc -l` — a `// ` filter silently
 * dropped six real call sites while writing this spec and made the set look 30% smaller.
 */
function sites(fn: string): string[] {
  const out = execSync(
    `grep -rn "${fn}(" src/ --include=*.ts --include=*.tsx || true`,
    { encoding: "utf8" },
  );
  return out
    .split("\n")
    .filter(Boolean)
    .filter((l) => !l.includes("__tests__"))
    .filter((l) => !/lib\/(billing\/credit-wall|auth\/session-expired)\.ts/.test(l));
}

describe("the refusal sets stay in step", () => {
  it("every reportCredit402 file also reports the 401", () => {
    const files = (list: string[]) => new Set(list.map((l) => l.split(":")[0]));
    const credit = files(sites("reportCredit402"));
    const session = files(sites("reportSession401"));

    expect(credit.size, "the credit-wall call sites vanished — the guard is measuring nothing").toBeGreaterThanOrEqual(14);
    const missing = [...credit].filter((f) => !session.has(f));
    expect(missing, `these handle a 402 but not a 401: ${missing.join(", ")}`).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it — expect a 14-file miss list**

- [ ] **Step 3: Edit the 19 uniform sites**

Beside each existing call:

```ts
if (reportSession401(res.status)) throw new SessionExpiredRefusal();
if (reportCredit402(res.status, err)) { /* …existing… */ }
```

The 401 check goes **first**: a 401 is not a 402, and ordering them this way keeps each check reading only its own status.

- [ ] **Step 4: Edit `use-chat-stream.ts` separately**

⚠️ It calls `reportCredit402(402, quota)` — a hardcoded status against an already-parsed quota object, not `(res.status, err)`. Read its surrounding code and place the 401 check where the real response status is still in scope. **Do not pattern-match it into the other 19.**

- [ ] **Step 5: Run the guard and the whole suite**

Run: `./node_modules/.bin/vitest run`
Expected: guard green, no regressions.

- [ ] **Step 6: Commit**

```bash
git add -A src/
git commit -m "feat(auth): raise the session dialog from every refusable fetch site"
```

---

## Task 11: Verification on a production build

Nothing here is complete until it has been seen. Dev is not acceptable: a `useRef` + cleanup-only effect already made an error path a **silent no-op in dev only**, and that is precisely why the defect survived unnoticed.

- [ ] **Step 1: Full gates**

```bash
./node_modules/.bin/tsc --noEmit          # must print nothing, exit 0
./node_modules/.bin/vitest run            # must be 0 failed
npm run build                             # a green Vercel check is NOT a build
```

⚠️ Vitest does not typecheck, and a `src/lib/surfaces/*` import reaching an API route breaks `next build` while tsc stays clean and the suite stays green. Run all three.

- [ ] **Step 2: Serve the production build**

```bash
npm run start -- --port 3005      # check `lsof -ti:3005` first; one dev server per port
```

- [ ] **Step 3: Drive it offline with real Playwright**

Use raw Playwright with `animations: 'disabled'`, `caret: 'hide'` and a tight `clip` — the project's ambient-room animations never settle, so the standard screenshot helper hangs here. Sign in via the REST endpoint + chunked cookie recipe, then:

```js
const client = await context.newCDPSession(page);
await client.send("Network.emulateNetworkConditions", {
  offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1,
});
```

Capture, at a native 1440×900 context and again at a natively-opened 390×844 context (resizing a loaded page does **not** give you the mobile UI):

- [ ] the offline notice visible, with no accent colour anywhere in it
- [ ] the send button disabled with a submittable draft
- [ ] a run started before going offline failing with the **offline** copy, not "dropped out"
- [ ] the retry button disabled, then enabled after `offline: false`

- [ ] **Step 4: Drive the 401**

With the app open and a draft typed, clear the Supabase auth cookies and fire a run. Confirm the dialog explains it, the draft is **still in the composer**, and the app did not navigate on its own.

⚠️ When a probe reports absence, prove the probe works before believing it — two probes produced false results in the last walk of these paths. A selector matching "New Th**read**" navigated away and looked like "the form never errors."

- [ ] **Step 5: Commit the evidence and open the PR**

```bash
git add docs/superpowers/
git commit -m "docs(unhappy-paths): verification evidence for offline + expired session"
git push -u origin lane/unhappy-paths
```

Re-check `git rev-list --count HEAD..origin/main` before opening the PR — main moves while you work.

---

## Self-review — spec coverage

| Spec section | Task |
|---|---|
| §3.1 ambient offline state | 1 |
| §3.1 no-accent constraint | 5 (asserted), Global Constraints |
| §3.1 composer gating, Stop untouched | 6 |
| §3.2 session module mirroring credit-wall | 8 |
| §3.2 does not navigate / AuthGuard keeps ownership | 8, 9 |
| §3.2 draft survives | 9 (by not navigating), 11 Step 4 (verified) |
| §3.3 TypeError needs corroboration | 2 |
| §3.3 never claim connectivity | 2, Global Constraints |
| §3.3 AbortError excluded | 2, 3 |
| §3.4 cause beats skill | 2, 3 |
| §3.4 retry follows the connection | 7 |
| §4 the 20 sites | 10 |
| §4.1 central option rejected | n/a — recorded, not built |
| §5 test matrix | 1, 2, 3, 5, 6, 7, 8, 9 |
| §5 prod-build browser verification | 11 |
| §6 non-goals | not built, by construction |

**Corrections applied during self-review** — three errors in the first draft, each caught by reading the source rather than trusting the draft:

1. **`skill` is not a prop on `ThreadTurn`.** It is derived (`thread-turn.tsx:196`) as `live?.skill ?? header?.skill ?? classifyTurn(blockTypes)`. Task 3's harness passed it as a prop and would not have compiled. Fixed to set it through `live`.
2. **`--color-charcoal-chrome` does not exist.** The real token is `--color-chrome` (`globals.css:68`). An invented token name fails silently — the style simply does not apply, and the notice would have rendered transparent over scrolling content.
3. **Task 6's mount was a placeholder.** The composer already mounts whole in tests via `renderWithClient(<Composer />)`, and `composer-stop-disc.test.tsx` drives this very button through its streaming state. Replaced the ellipses with the real harness and pointed at the precedent.

**Two further errors caught in a second review pass**, both of which would have surfaced as failures mid-execution:

4. **The guard's file set was larger than the conversion list.** Eight files match `use-*-stream.ts`, not seven — `use-analysis-stream.ts` has zero `reportCredit402` calls, so it is absent from the §4 table and from any list derived from it, while still owning a real error path. Task 4's guard would have failed on a file Task 4 never told the implementer to touch.
5. **The notice was positioned on top of the composer.** The dock is `absolute inset-x-0 bottom-0` (`composer.tsx:3535`), so a `fixed bottom-0` bar covers the send button whose disabled state the notice exists to explain. Moved to the top with a `--mobile-nav-band` offset so it clears the fixed burger as well, and both clearances are now explicit Task 11 browser checks — jsdom cannot see either.

**Remaining judgement call, stated rather than hidden:** Task 6's third test needs the composer driven into a streaming state, and the mechanism for that lives in `composer-stop-disc.test.tsx`'s setup rather than being reproducible in six lines here. The step names that file as the source to copy. If its approach has drifted, follow the file, not this plan.
