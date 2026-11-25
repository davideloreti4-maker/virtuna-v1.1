# The phone's drawer: implementation plan

> **Built 2026-11-25.** This plan was written before several points were settled during the build
> (how New chat closes the drawer, where the balance is read, where All chats sits, Home inside a
> chat, Back on You, Earn and Settings). Where it differs from the code, the spec's section 11
> ("As built") is what stands.

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. One task per
> implementer, a failing test first for every behaviour, a review after each task.

**Goal:** under the new look, on a phone, a left drawer that carries what the desktop sidebar carries (New
chat, the places, You, Earn, Recent, the account with Settings and Log out), opened from the creator's
picture on the four places and from a menu button in a chat not opened from Library. The bottom bar
stays. Spec: `docs/superpowers/specs/2026-11-25-phone-drawer-design.md` (it wins over this plan;
`.superpowers/sdd/2026-11-25-drawer/rulings.md` wins over both). Drawing:
`.scratch/next-look/part8b/drawer/drawer-drawing.png`. Leads: `.scratch/next-look/part8b/drawer/seam-map.md`
(corrections in Question 9).

**Shape:** no route, table, package or new request. Added: the drawer's state and the account's face in
the shell store; in `src/components/shell/` a words module, the drawer (`drawer.tsx` frame,
`drawer-rows.tsx` rows), the opener (`menu-button.tsx`) and one glyph; one optional prop on
`pushed-header.tsx`; the shell mounts the drawer and puts the menu in a chat's band; the four screens take
one optional `opener` slot. Not touched: `side-nav.tsx`, `tab-bar.tsx`, `thread-row.tsx`, `nav-config.ts`,
`ui/sheet.tsx`, `sidebar-store.ts`, the legacy `Sidebar.tsx`, every route file.

**Stack:** Next.js 16, React 19, TypeScript, zustand 5, TanStack Query 5, Radix Dialog (`radix-ui`),
`tw-animate-css`, Vitest 4 (happy-dom, Testing Library, vitest-axe), Tailwind v4.

## Global constraints (every task)

- Everything is under `NEW_LOOK_ENABLED`: the new shell and the four `*-next` screens render only with
  the flag on, and no flag-off file is edited. Flag off renders exactly as before. Never change an
  existing `@theme` value.
- Never edit: `src/components/shell/side-nav.tsx`, `tab-bar.tsx`, `thread-row.tsx`, `nav-config.ts`,
  `src/components/ui/*` (`sheet.tsx` included), `src/stores/sidebar-store.ts`,
  `src/components/sidebar/*`, `src/app/**` (except `src/app/(app)/dev/home/dev-home.tsx`, Task 3). Import
  from them only.
- Styling (`CLAUDE.md` "New look", `docs/DESIGN-SYSTEM.md` "Next look"): tokens only (no hex, `rgb(` or
  palette colour), no glass and no `backdropFilter` (the shell guard allows it in `tab-bar.tsx` only), a
  shadow only as `shadow-[var(--shadow-…)]`, no accent but the brand mark, type roles only.
- A failing test first for every behaviour. Stand-ins only at I/O boundaries: `fetch`, `next/navigation`,
  `innerWidth` with a `resize` event, `matchMedia`, the browser Supabase client, the flag, the clock. The
  shell's existing test files stand in its query hook modules (`next-shell.test.tsx:30-41`); new files use
  `fetch` and a real `QueryClient`. Never a stand-in for the unit under test; real stores; never `-u`.
  Component tests carry `/** @vitest-environment happy-dom */`.
- Comments give the reason, never a task, ruling or review number. Made-up names only (`Nia Long`,
  `nia.tests@example.com`, chat titles such as `Hooks for the dream headset video`).
- Words: the new ones from `DRAWER_WORDS` only; the reused ones as the sidebar writes them (`New chat`,
  `Recent`, `Settings`, `Log out`, `Close`, labels from `PLACES` / `YOU` / `EARN`, `creditsLabel`).
- Implementers do not commit, stash, push, read `.env*`, run a dev server, a build, the network or a
  database query. Each command once per task:
  `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run <paths> --testTimeout 30000`,
  `pnpm exec tsc --noEmit`, `pnpm exec eslint <changed files>`.
- Reports: `.superpowers/sdd/2026-11-25-drawer/task-N-report.md`. The reply follows `rulings.md` 2.

## Constants and contracts (shared by all tasks)

### The store (`src/stores/shell-store.ts`, additive; not persisted, as the whole store is today)

```ts
/** The creator's picture and initials as the drawer's openers draw them. */
export interface AccountFace { picture: string | null; initials: string }

// added to ShellState
  /** New look, phone: the left drawer is open. In memory only: a reload starts closed. */
  drawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  /** The account's face, published by the drawer's frame from the profile query the sidebar already
   *  reads, so an opener reads no query and sends no request. Null: not published yet. */
  accountFace: AccountFace | null;
  setAccountFace: (face: AccountFace | null) => void;

// added to create()
  drawerOpen: false,
  openDrawer: () => set({ drawerOpen: true }),
  closeDrawer: () => set({ drawerOpen: false }),
  accountFace: null,
  setAccountFace: (face) => set({ accountFace: face }),
```

`accountFace` is not in the controller's list: Question 1 says why the opener cannot read the profile.

### Words (`src/components/shell/drawer-words.ts`, pure)

```ts
/** The drawer's own words (spec section 6). The rest are reused as the sidebar writes them. */
export const DRAWER_WORDS = {
  openMenu: "Open menu", // every opener's name; not "Open sidebar" (`app-shell.next.test.tsx:46`)
  menu: "Menu",          // the drawer's title, for a screen reader
  allChats: "All chats", // under Recent, opens Library
} as const;
```

### The drawer

```ts
// drawer.tsx: the frame. Mounted once, by NextShell.
export const OPENER_SELECTOR = "[data-drawer-opener]";
export function Drawer({ actions }: { actions: ThreadActions }): React.JSX.Element;

// drawer-rows.tsx: what the panel holds.
export type DrawerChoice =
  | { kind: "stay" }                    // the row leads where the creator already is
  | { kind: "go" }                      // it leads elsewhere: a link, another chat, Log out
  | { kind: "after"; run: () => void }; // New chat: `run` once the drawer has gone
export interface DrawerAccount { name: string; picture: string | null; initials: string; balance: number | null }
export interface DrawerRowsProps { actions: ThreadActions; account: DrawerAccount; choose(choice: DrawerChoice): void }
export function DrawerRows(props: DrawerRowsProps): React.JSX.Element;
```

**Primitive.** The Radix dialog directly (`import { Dialog as DialogPrimitive } from "radix-ui"`), as
`discover-next/sheet-shell.tsx:66-83` does on a desk. Not `ui/sheet.tsx`: its left side carries a legacy
`border-r`, `w-3/4 sm:max-w-sm`, a surface fill, an X and slides that ignore reduced motion
(`sheet.tsx:118-124,144`); overriding each by class is more fragile, and the file stays untouched. Not
`useReturnFocus`: it returns the focus to what had it at open (`use-return-focus.ts:28`), in a chat the
message field, which would bring the keyboard back; the spec returns it to the opener.

**Imports, these module paths exactly** (the shell's tests stand in these modules): `useThreadList`
from `@/hooks/queries`; `useProfile` from `@/hooks/queries/use-profile`; `useSubscription` from
`@/hooks/use-subscription`; `createClient` from `@/lib/supabase/client`; `shownBalance` from
`@/lib/pricing`; `creditsLabel` from `@/components/thread-next/thread-field`; `initialsOf` from
`@/components/home-next/greeting` (pure; Question 2); `useIsMobileHydrated` from `@/hooks/useIsMobile`
(the hook `NextShell` already uses for the same 768 line, driven in tests by `innerWidth`; `useWide`
would make the shell import a screen's folder and need a `matchMedia` stand-in in five files);
`MavenMark` from `@/components/brand/maven-logo`; `GearSix`, `SignOut` from `@phosphor-icons/react` (the
sidebar's menu icons); `PLACES`, `SIDE_NAV_ORDER`, `YOU`, `EARN`, `RECENT_LIMIT`, `SHELL_FOCUS`,
`activePlace`, `youActive`, `earnActive` from `./nav-config`; `ComposeIcon` from `./icons`.

**The frame's subtle parts** (the rest follows the behaviour lists):

```tsx
const open = useShellStore((s) => s.drawerOpen);
const closeDrawer = useShellStore((s) => s.closeDrawer);
const setAccountFace = useShellStore((s) => s.setAccountFace);
const pathname = usePathname();
const titleRef = useRef<HTMLHeadingElement>(null);
const { isMobile, hydrated } = useIsMobileHydrated();
const wide = hydrated && !isMobile;                 // the line `md:` draws: innerWidth >= 768
const handedOn = useRef(false);                    // a row led elsewhere: no focus back to the opener
const after = useRef<(() => void) | null>(null);   // New chat, run once the drawer has gone

// The account, read once here (the frame never unmounts): Home's rule for the initials, held while
// the first read is out; the sidebar's rule for the name (side-nav.tsx:142-143).
const { data: profile, isPending, failureCount } = useProfile();
const pending = isPending && failureCount === 0;
const picture = profile?.avatar ?? null;
const initials = pending ? "" : initialsOf(profile?.name, profile?.email);
useEffect(() => { setAccountFace({ picture, initials }); }, [picture, initials, setAccountFace]);
const { usage, tier, isTrial } = useSubscription();
const account: DrawerAccount = {
  name: profile?.name?.trim() || profile?.email?.trim() || "Account",
  picture, initials, balance: shownBalance(usage, tier, isTrial),
};

useEffect(() => { if (open) { handedOn.current = false; after.current = null; } }, [open]);
// From 768 the sidebar is there: close, so no scroll lock and no hidden page is left behind.
useEffect(() => { if (wide) closeDrawer(); }, [wide, closeDrawer]);
// Another route while open (the system's Back): close; the new screen keeps the focus.
const shownAt = useRef(pathname);
useEffect(() => {
  if (shownAt.current === pathname) return;
  shownAt.current = pathname;
  if (!useShellStore.getState().drawerOpen) return;
  handedOn.current = true;
  closeDrawer();
}, [pathname, closeDrawer]);

const choose = (choice: DrawerChoice) => {
  if (choice.kind === "go") handedOn.current = true;
  if (choice.kind === "after") after.current = choice.run;
  closeDrawer();
};

<DialogPrimitive.Root open={open && !wide} onOpenChange={(next) => { if (!next) closeDrawer(); }}>
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className={SCRIM} />
    <DialogPrimitive.Content
      aria-describedby={undefined}
      className={PANEL}
      onOpenAutoFocus={(event) => { event.preventDefault(); titleRef.current?.focus(); }}
      onCloseAutoFocus={(event) => {
        event.preventDefault();
        const run = after.current;
        after.current = null;
        // New chat may put the cursor in the field: it runs only now, with the dialog's focus trap
        // gone, or the trap would pull the focus back into the closing drawer.
        if (run) { run(); return; }
        if (handedOn.current) { handedOn.current = false; return; }
        const active = document.activeElement;
        if (active && active !== document.body) return;
        document.querySelector<HTMLElement>(OPENER_SELECTOR)?.focus();
      }}
    >
      <DialogPrimitive.Title ref={titleRef} tabIndex={-1} className="sr-only outline-none">{DRAWER_WORDS.menu}</DialogPrimitive.Title>
      <DrawerRows actions={actions} account={account} choose={choose} />
      <DialogPrimitive.Close className={CLOSE}>Close</DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
</DialogPrimitive.Root>
```

Why New chat waits: `composer.tsx:3601-3616` focuses the field synchronously when `focusField` bumps,
and while the dialog is open Radix's trap (`trapFocus: context.open`, react-dialog `index.mjs:144`;
focus-scope `handleFocusIn`) moves any focus outside back in. `onCloseAutoFocus` fires after the
content unmounts (after the 300 ms slide), when the trap, `aria-hidden` and the pointer lock are gone.

**Classes that matter** (tokens only):

```ts
const SCRIM = cn("fixed inset-0 z-[var(--z-modal-backdrop)] bg-scrim md:hidden",
  "motion-safe:duration-300 motion-safe:data-[state=open]:animate-in motion-safe:data-[state=open]:fade-in-0",
  "motion-safe:data-[state=closed]:animate-out motion-safe:data-[state=closed]:fade-out-0");
const PANEL = cn("fixed inset-y-0 left-0 z-[var(--z-modal)] flex w-[min(86vw,320px)] flex-col bg-background text-foreground outline-none md:hidden",
  "pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)]",
  "motion-safe:duration-300 motion-safe:ease-[var(--ease-out-quart)]",
  "motion-safe:data-[state=open]:animate-in motion-safe:data-[state=open]:slide-in-from-left",
  "motion-safe:data-[state=closed]:animate-out motion-safe:data-[state=closed]:slide-out-to-left");
/** "Close", out of sight until the keyboard reaches it (sheet-shell.tsx:42-43), below the safe area. */
const CLOSE = "sr-only focus-visible:not-sr-only focus-visible:absolute focus-visible:right-4 focus-visible:top-[calc(env(safe-area-inset-top)+16px)] focus-visible:z-[1] focus-visible:rounded-full focus-visible:bg-surface-sunken focus-visible:px-3 focus-visible:py-1.5 focus-visible:text-meta focus-visible:font-[560] focus-visible:text-foreground";
/** A row: the sidebar's row (side-nav.tsx:223-229) at the phone's 44. Every row adds SHELL_FOCUS (it sits in a scroll box). */
const ROW = "flex h-11 w-full shrink-0 items-center gap-[11px] rounded-lg px-3 text-left text-ui font-[560] transition-colors duration-150";
const LIT = "bg-active text-foreground";
const UNLIT = "text-foreground-secondary hover:bg-hover hover:text-foreground";
```

No shadow on the panel (the scrim separates it; the drawing has none). Layout of `DrawerRows`: one column
`flex min-h-0 flex-1 flex-col p-3`: the brand row (`h-11`, the mark in a 26 square as `side-nav.tsx:177-180`,
then `Maven` in `text-title font-[640]`; spans, not a link, not a heading); New chat (the sidebar's raised
row, `side-nav.tsx:193-198`, at `h-11`, `ComposeIcon` 17, no `⌘N`); then the middle,
`mt-2.5 min-h-0 flex-1 overflow-y-auto overscroll-contain` (places, a hairline `mx-3 my-2 h-px bg-border`,
You, Earn, Recent); then `shrink-0` the hairline, the account block (`Avatar size="sm"` at 30, the name
`text-ui font-[640]` truncated, under it the balance `text-meta tabular-nums text-foreground-secondary`;
a `div`, not a control), Settings (`GearSix` 18), Log out (`SignOut` 18). Icons 18 in place rows. Recent
rows: no icon, `text-reading`, one line (`truncate`), lit as `ThreadRow` (`font-[560] text-foreground` on
`bg-active`). All chats: a `ROW` in `text-foreground`. No `nav` landmark inside: the dialog named `Menu`
is the container, and the sidebar's `App navigation` stays the only nav of that name.

**Recent and the lit row, copied from the sidebar** (the drawer has no rail, so `!collapsed` drops out):

```ts
// side-nav.tsx:132-134
const recent = (threads ?? [])
  .filter((thread, index) => index === 0 || Boolean(thread.title?.trim()))
  .slice(0, RECENT_LIMIT);
// side-nav.tsx:139, without `!collapsed`
const inThread = threadOpen && pathname === "/home" && recent.some((thread) => thread.id === activeThreadId);
// side-nav.tsx:215: a place row
const active = current === place.id && !(place.id === "home" && inThread);
// side-nav.tsx:253: a Recent row
const isActive = pathname === "/home" && thread.id === activeThreadId;
// thread-row.tsx:56: its name
const label = thread.title?.trim() || "New chat";
```

You and Earn are lit by `youActive` / `earnActive`. Settings is never lit (the sidebar has no such
row). With `recent.length === 0` (loading: `data` undefined; empty; failed) the label `Recent`, the list
and All chats are not drawn. The list is `<ul aria-labelledby={labelId}>` under `<p id={labelId}>Recent</p>`.

**What each row hands `choose`** (then does its own thing):

| Row | Choice | Then |
|---|---|---|
| New chat | `{ kind: "after", run: actions.newThread }` | nothing more |
| Home, Discover, Audience, Library, You, Earn, Settings, All chats (`next/link`, `href` as in `PLACES` / `YOU` / `EARN`, `/settings`, `/library`) | `pathname === href ? { kind: "stay" } : { kind: "go" }` | the link navigates |
| A Recent row, the open chat (`threadOpen && pathname === "/home" && thread.id === activeThreadId`) | `{ kind: "stay" }` | nothing (Question 5) |
| Any other Recent row | `{ kind: "go" }` | `actions.openThread(thread.id)` (no `back`: its band then shows the menu) |
| Log out (a `button`) | `{ kind: "go" }` | `void createClient().auth.signOut()`; `AuthGuard` leads to the sign-in page (`side-nav.tsx:314`) |

### The opener (`src/components/shell/menu-button.tsx`, `"use client"`)

```ts
export interface MenuButtonProps {
  variant: "picture" | "lines";
  /** "picture" only: drawn as given instead of the shell's face (dev previews and screen tests, which have no shell). */
  face?: AccountFace;
}
export function MenuButton({ variant, face }: MenuButtonProps): React.JSX.Element;
```

Both: a plain `button` (not a Radix trigger), `type="button"`, `data-drawer-opener=""`,
`aria-label={DRAWER_WORDS.openMenu}`, `aria-haspopup="dialog"`,
`aria-expanded={useShellStore((s) => s.drawerOpen)}`, `onClick={openDrawer}`, `md:hidden`. No text node
but the initials (the band's tests read its `textContent`). It reads the store only: no query, no
provider needed, no request.
- `picture`: `className="tap-44 shrink-0 rounded-full md:hidden"` around
  `<Avatar src={f?.picture ?? undefined} alt="" fallback={f?.initials ?? ""} size="sm" className="h-9 w-9" />`,
  where `f = face ?? accountFace` (Home's link today, `home-screen.tsx:266-268`).
- `lines`: `<IconButton … className="md:hidden"><MenuIcon aria-hidden /></IconButton>`, the 38 round
  button Back is. `MenuIcon` in `icons.tsx`: `<Glyph {...props}><path d="M5 7h14M5 12h14M5 17h14" /></Glyph>`.

### `PushedHeader` (`pushed-header.tsx`, additive)

```ts
/** Drawn in Back's 40px column instead of Back (a chat's menu). Without it: Back, as before. */
leading?: React.ReactNode;
// render: {leading ?? <IconButton aria-label="Back" onClick={onBack}><BackIcon aria-hidden /></IconButton>}
```

`onBack` stays required.

### The `opener` slot on the four screens

| Screen (props) | Type | Drawn |
|---|---|---|
| `HomeScreenProps` (`home-screen.tsx:105`) | `opener?: React.ReactNode` | first in the phone row, where the `/you` link was; `avatar` and `initials` go |
| `DiscoverScreenProps` (`discover-screen.tsx:32`) | `opener?: React.ReactNode` | before the `h1` in the 44 row (`:82`), the row gains `gap-3` |
| `LibraryScreenProps` (`library-screen.tsx:50`) | `opener?: React.ReactNode` | before the `h1` in the header (`:476`); hidden while the search is open |
| `AudienceScreenProps` (`audience-screen.tsx:55`) | `opener?: React.ReactNode` | before the `h1` (`:301`), only when `!pushed` |

Each wraps it as `<div data-part="opener" className={cn("flex shrink-0 md:hidden", <Library only> open && "hidden")}>{opener}</div>`,
only when given. Every container passes `<MenuButton variant="picture" />`. No guard forbids
`@/components/shell` (`discover-next-guard.test.ts:80`, `library-next-guard.test.ts:43-54`,
`audience-next-guard.test.ts:36-46`; `home-next-guard` checks colours and glass only).

---

### Task 1: the store, the words, the drawer (openable through the store)

**Files:** modify `src/stores/shell-store.ts`; create `src/components/shell/drawer-words.ts`,
`src/components/shell/drawer.tsx`, `src/components/shell/drawer-rows.tsx` (if `drawer-rows.tsx` passes
about 250 lines, its Recent block may move to `drawer-recent.tsx` in the same folder); tests: create
`src/stores/__tests__/shell-store-drawer.test.ts`, `src/components/shell/__tests__/drawer-words.test.ts`,
`src/components/shell/__tests__/drawer.test.tsx`. **Must not touch** anything else (`next-shell.tsx`
is Task 2).

**Consumes:** `ThreadActions` (`use-thread-actions.ts:17`), the hooks and constants above.
**Produces:** the store fields, `DRAWER_WORDS`, `OPENER_SELECTOR`, `Drawer`, `DrawerRows`, `DrawerChoice`,
`DrawerAccount`.

Behaviour:
1. `drawerOpen` starts false; `openDrawer` / `closeDrawer` set it; `accountFace` starts null. Nothing of
   it is written to storage.
2. With `drawerOpen` true on a phone (`innerWidth` < 768 once measured), a dialog named `Menu` opens and
   the focus is on its title. On a wide window it does not open, and the store is set back to closed.
3. It holds, in this order: Maven, New chat, Home, Discover, Audience, Library, a hairline, You, Earn,
   Recent with its rows and All chats, a hairline, the account, Settings, Log out, and Close.
4. The lit row and Recent follow the sidebar's rules quoted above; no Recent block while the list loads,
   is empty or failed.
5. The account: initials (Home's rule), the name (name, else email, else `Account`), the balance as
   `creditsLabel(balance)` only when `shownBalance` gives a number. The frame publishes
   `{ picture, initials }` to `accountFace` whenever either changes.
6. Closing: every row (the table above), the scrim, Escape, Close, a route change, the window reaching
   768. The focus then: back to the opener for the scrim, Escape, Close and a `stay` row; not moved for a
   `go` row or a route change; New chat runs after the drawer has gone.
7. While open, the page behind is hidden from a screen reader and does not scroll (Radix `hideOthers`,
   `RemoveScroll` on the overlay). The slide and the fade are `motion-safe:` only.

Tests, `drawer.test.tsx`. Stand-ins: `next/navigation` (`usePathname` from a variable, `useRouter` with
`push` / `back` spies), `fetch` (`/api/threads/list` → `{ threads }`, `/api/profile` →
`{ name: "Nia Long", email: "nia.tests@example.com", avatar: null }`, `/api/subscription` →
`{ tier: "pro", isTrial: false, usage: { used: 470, limit: 500, remaining: 30, enforced: false, inTrial: false, renewsAt: null, periodStart: null } }`;
each answer settable per test, one held to show loading), `@/lib/supabase/client` (`signOut` spy),
`@/lib/flags/new-look` on, `innerWidth` 390. Real: `QueryClient` (`retry: false`), `ToastProvider`,
`useThreadActions`, the stores, the drawer. The harness renders
`<button type="button" data-drawer-opener onClick={() => useShellStore.getState().openDrawer()}>open</button>`,
`<textarea aria-label="Message" />` and `<Drawer actions={useThreadActions()} />`; the textarea is
focused by a test-side `useShellStore.subscribe` on `fieldFocusSignal`, as the composer does
(`composer.tsx:3601-3616`). Link clicks: a capture-phase `click` listener on `window` calls
`preventDefault()` on anchors, so the row's `onClick` runs and `next/link` does not navigate. Scrim taps:
as `more-sheet.test.tsx:336-342` (let timers settle, `pointerDown`, settle). `beforeEach` resets
`drawerOpen`, `accountFace`, `threadOpen`, `threadBack`, `activeThreadId`, the thread cookie.

- `opens from the store: a dialog named Menu, the focus on its title`.
- `holds the rows in the sidebar's order` (behaviour 3, by `compareDocumentPosition`).
- `lights the place the creator is on`: `/home` Home, `/feed/video/v1` Discover, `/library` Library,
  `/audience/new` Audience, `/you` You, `/earn` Earn, `/settings` none.
- `inside a chat whose row is listed, that row is lit and Home is not; a chat Recent does not list leaves
  Home lit`. Fails if the `inThread` rule is not copied.
- `Recent: the newest always, then only named ones, six at most, in the list's order` (nine chats; the
  newest untitled shows `New chat`; two untitled further down are left out).
- `no Recent label, rows or All chats while the list loads, when it is empty, or when it failed`.
- `the account: the initials, the name, the balance in the sidebar's words`, and its fallbacks (no name:
  the email and its letter; neither: `Account` and `?`; a free tier: no balance line).
- `publishes the face for the openers: empty while the first read is out, then NL` (reads `accountFace`).
- `a row that leads elsewhere closes it and leaves the focus where the new screen puts it`: Home,
  Discover, Library, You, Earn, Settings, All chats at `/audience` (the `href`; `drawerOpen` false; the
  opener not focused).
- `a row that leads where the creator is closes it and the focus goes back to the opener` (Audience).
- `New chat inside a chat: the drawer goes first, then the new chat starts` (no dialog in the page when
  `router.push("/home")` runs; `activeThreadId` null). Fails if `run` is called in the click.
- `New chat on a blank Home: the drawer goes, then the cursor is in the field` (`/home`, no cookie,
  `threadOpen` false: the textarea ends focused). Fails if the action runs while the trap is up.
- `a recent chat opens on Home with no way back to Library` (`threadBack` set beforehand, null after;
  `activeThreadId`; `router.push("/home")`).
- `the open chat's own row only closes: nothing is opened again, the focus goes back to the opener`
  (`activeThreadSignal` unchanged, nothing pushed).
- `Log out signs out once and closes; nothing is pushed`.
- `Escape closes it; the focus goes back to the opener`; the same for `a tap on the scrim`.
- `Close is out of sight until focused, and closes it`.
- `another route closes it, and the focus is not moved to an opener` (`/library` → `/feed`, rerender).
- `the window reaching 768 closes it` (`innerWidth` 1024, a `resize` event) and `it does not open on a
  wide window`.
- `while it is open the page behind is hidden from a screen reader` (the opener inside
  `[aria-hidden="true"]`, and not after closing).
- `slides only when motion is allowed` (`motion-safe:` slide classes, no unprefixed `animate-in`).
- `axe finds nothing with it open` (`axe(document.body)`).

`shell-store-drawer.test.ts`: `starts closed, and openDrawer and closeDrawer set drawerOpen`;
`is not stored: no persist API, and nothing in localStorage after opening` (`"persist" in useShellStore`
false; `localStorage.length` 0); `accountFace starts null and holds what is set`.
`drawer-words.test.ts`: `holds the three new words` (the object equals the contract).

Run: vitest on `src/stores/__tests__/shell-store-drawer.test.ts src/components/shell`; tsc; eslint on
the changed files. **Done when** these pass and every other shell test is green unchanged (the guard
scans the new files). **Report:** `task-1-report.md`.

### Task 2: the opener, the band's `leading`, the shell's wiring in a chat

**Files:** create `src/components/shell/menu-button.tsx`; modify `src/components/shell/icons.tsx`
(`MenuIcon`), `src/components/shell/pushed-header.tsx`, `src/components/shell/next-shell.tsx`; tests:
create `src/components/shell/__tests__/menu-button.test.tsx`, `pushed-header.test.tsx`; modify
`next-shell.test.tsx`, `next-shell-pushed-title.test.tsx`. **Must not touch** the drawer files (report
a bug there instead), the `back` expression in `next-shell.tsx:74-88` (kept byte for byte: its no-marker
branch is no longer drawn in a chat, and the marker case stays as it is), anything outside the shell.

**Consumes:** Task 1's store, words, `Drawer`, `OPENER_SELECTOR`. **Produces:** `MenuButton`, `MenuIcon`,
`PushedHeader`'s `leading`.

Behaviour:
1. `MenuButton` as in the contract; a tap sets `drawerOpen`; `aria-expanded` follows it.
2. `PushedHeader` draws `leading` in Back's column when given, else Back as before.
3. `NextShell` mounts `<Drawer actions={actions} />` once, after the tab bar, outside `<main>`.
4. In a chat with no Library marker (`inThread && threadBack === null`) the band passes
   `leading={<MenuButton variant="lines" />}`; New chat stays at the right. A chat with the marker, a
   result, a video, a collection, a pull, You, Earn, Settings, a new audience: Back, as today.

Tests:
- `menu-button.test.tsx` (store only, no provider): `picture: a button named Open menu with the shell's face`
  (`accountFace` NL → text `NL`; `aria-haspopup` dialog; `aria-expanded` false, then true after
  `openDrawer`); `picture: an empty circle until the face is published, and face draws as given`;
  `lines: the round button with three lines, no text, the same name and state`;
  `a tap opens the drawer`; `both are phone only and carry the opener mark`
  (`md:hidden`; `matches(OPENER_SELECTOR)`).
- `pushed-header.test.tsx`: `without leading: Back in the first column, and a tap calls onBack`;
  `with leading: the node in Back's column, no Back; title, subtitle and trailing as before`.
- `next-shell.test.tsx`, helper: `const menu = () => screen.queryByRole('button', { name: 'Open menu' })`
  and `pushedHeader = () => (back() ?? menu())!.closest('header')!` (`:63`). This changes no assertion;
  it keeps `:112-118`, `:120-127` and `:515-538` (chats with no marker) finding the band. `beforeEach`
  (`:80`) also resets `drawerOpen: false, accountFace: null`.
- `next-shell.test.tsx`, tests that change because the menu takes Back's place in a chat with no marker
  (their names change too):
  - `:97-110` `a thread: no tab bar; Back returns to the blank Home` → `a thread: no tab bar; the menu at
    the top left, no Back` (the title in the band; the menu `aria-expanded` false; a tap sets
    `drawerOpen`; the chat stays open, nothing pushed).
  - `:257-269` `with no marker, Back starts a new chat, as today` → `with no marker, the menu takes Back's
    place`.
  - `:310-323` (each place): the first half unchanged (the marker drops); the second half, back on
    `/home`, asserts the menu and no Back instead of a new chat.
  - `:444-460` `the same chat found open again on Home after You…: Back starts a new chat` → `…: the menu,
    not Back`.
  Unchanged and still green, as they are: `:224-255`, `:271-282`, `:300-308`, `:346-397`, `:412-442`
  (Library's way back, the marker set: Back) and every other test in the file.
- `next-shell.test.tsx`, new (the drawer ones at `innerWidth` 390):
  - `a chat opened from Library keeps Back, and draws no menu`.
  - `every pushed page keeps Back and draws no menu`: `/simulation/a1` (with `threadOpen`),
    `/feed/video/v1`, `/feed/collection/meal-prep`, `/feed/discover`, `/you`, `/earn`, `/settings`,
    `/audience/new`, `/audience/a1`.
  - `a place draws no menu in the shell (its screen carries the opener)` (`/library`).
  - `on a phone the menu opens the drawer, and Escape gives the focus back to it`. Fails if the menu
    lacks the opener mark.
  - `the drawer is mounted once`; `a resize to 768 closes the open drawer`.
  - `a chat opened from the drawer shows the menu, and its row is lit`.
  - `the drawer's Recent lists the sidebar's Recent, in its order` (`SIDE_NAV_CHOICE_KEY` set and
    `isCollapsed` false, so the sidebar is not the rail; nine chats, some untitled; the names in `App
    navigation`'s Recent equal the dialog's). Fails if either copy of the rule drifts.
- `next-shell-pushed-title.test.tsx`: its helper `header()` (`:54`) finds the band through Back or the
  menu; `:91-96` `a thread still shows the thread title, not the pushed title` (no marker) keeps its
  assertion. Nothing else changes.
- Unchanged, and run: `icons.test.tsx` (it checks `MenuIcon` by itself), `app-shell.next.test.tsx`
  (`Open sidebar` stays absent), `app-shell.legacy.test.tsx`, `app-shell-palette.legacy.test.tsx`,
  `next-shell-palette.test.tsx`.

Run: vitest on `src/components/shell src/stores/__tests__/shell-store-drawer.test.ts
src/components/app/__tests__/app-shell.next.test.tsx src/components/app/__tests__/app-shell.legacy.test.tsx
src/components/app/__tests__/app-shell-palette.legacy.test.tsx`; tsc; eslint. **Done when** these pass.
**Report:** `task-2-report.md`.

### Task 3: the opener on the four places, Home's change

**Files:** modify `src/components/home-next/home-screen.tsx`, `home-next.tsx`,
`src/app/(app)/dev/home/dev-home.tsx`, `src/components/discover-next/discover-screen.tsx`,
`discover-next.tsx`, `src/components/library-next/library-screen.tsx`, `library-next.tsx`,
`src/components/audience-next/audience-screen.tsx`, `audience-next.tsx`; tests: modify
`src/components/home-next/__tests__/home-screen.test.tsx`, `home-next.test.tsx`; add tests to
`src/components/library-next/__tests__/library-screen.test.tsx`, `library-next.test.tsx`,
`src/components/discover-next/__tests__/discover-next.test.tsx`,
`src/components/audience-next/__tests__/audience-screen.test.tsx`, `audience-next.test.tsx`. **Must not
touch** the shell, the route files, the other dev previews (they render the screens without the slot and
keep looking as they do), every other part of these folders.

Behaviour:
1. Each screen takes `opener` and draws it as the slot table says. Home: the `Link` to `/you` and its
   `Avatar` go; `avatar` and `initials` leave `HomeScreenProps`; the credits badge gains `ml-auto` so it
   stays at the right with or without an opener; `Avatar` leaves the imports, `Link` stays (Money made).
2. `HomeNext`, `DiscoverNext`, `LibraryNext`, `AudienceNext` pass `<MenuButton variant="picture" />`;
   `AudienceNext` only when `!read.pushed`. `HomeNext` stops passing `avatar` / `initials` and drops the
   `initialsOf` import (`profilePending` stays for the greeting).
3. The loading frames draw it too, so the title does not move when the page lands:
   `DiscoverNextLoading` (`discover-next.tsx:331`), `LibraryNextLoading` (`library-next.tsx:1034`),
   `AudienceNextLoading` (`audience-screen.tsx:339`, only when `!pushed`). The opener reads the store
   only, so the bare renders of these frames in tests need no provider and send nothing.
4. `dev-home.tsx` passes `opener={<MenuButton variant="picture" face={{ picture: null, initials: start.noName ? "?" : "NL" }} />}`
   instead of `avatar` / `initials` (`:194-195`); its test (`fetch` must not be called) stays green.

Tests:
- `home-screen.test.tsx`: `props()` (`:24-38`) drops `avatar` / `initials`, adds
  `opener: <MenuButton variant="picture" face={{ picture: null, initials: "NL" }} />`. Changed:
  `:293-296` `the avatar is a link to You` → `the opener is the phone row's first child: Open menu, not a
  link to You` (text `NL`); `:313-317` `the row is the phone's only` checks through the button;
  `:589-617` (both order tests) start from `Open menu`. New: `without an opener the credits stay at the
  right` (`ml-auto` on `[data-part="credits"]`).
- `home-next.test.tsx`: `:267-283` `holds the heading and the avatar until…` → `holds the heading until
  the profile has answered: no nameless greeting` (its two `link You` lines go; the picture's hold is the
  frame's, pinned in Task 1). New: `Home's top row carries the shell's opener` (`accountFace` NL → button
  `Open menu` with `NL`; a tap sets `drawerOpen`).
- New, one each: `library-screen.test.tsx` `the opener sits before the heading on the phone` and `the
  opener hides while the search is open, and comes back when it closes`; `library-next.test.tsx`
  `Library carries the opener` and `LibraryNextLoading draws the opener too`; `discover-next.test.tsx`
  `the hub's row: the opener, then the heading` and `DiscoverNextLoading draws the opener too`;
  `audience-screen.test.tsx` `the opener comes before the heading on /audience` and `a pushed audience
  draws no opener, even when one is given`; `audience-next.test.tsx` `/audience carries the opener; a
  pushed audience does not`.
- Unchanged, and they prove the opener sends nothing: `library-next.test.tsx:1010`
  (`["/api/threads/library"]`) and every `expect(calls).toEqual(…)` in `audience-next.test.tsx`. If an
  existing container test fails because the opener is now first in a row, stop and report; do not edit it.

Run: vitest on `src/components/home-next src/components/library-next src/components/discover-next
src/components/audience-next "src/app/(app)/dev/home" src/components/app/home/__tests__/home-page-layout-composer.flag-on.test.tsx
src/components/app/home/__tests__/composer-home.flag-on.test.tsx` (the guards run with their folders);
tsc; eslint. **Done when** these pass. **Report:** `task-3-report.md`.

## Controller's checks (spec section 10; the controller runs them)

1. `df -h /` first. Flag on, the test account, a phone at 320, 375 and 393, light and dark: the picture
   before the title on the four places (Library's search hides it; Audience at 320, Question 7); the
   drawer's rows, the lit row, the account with or without a balance, the middle scrolling under the
   held top and account; each row as spec 3.4; Log out reaches the sign-in page.
2. Chats started with New chat, opened from the drawer's Recent (row lit) or Home's Recent show the menu;
   one opened from Library shows Back and returns at its chip, search and scroll; a result keeps Back.
   The drawer's Home inside a chat (Question 4).
3. Keyboard (a desktop browser at 393): the focus on `Menu` on open, Tab stays inside, Escape returns it
   to the opener, `Close` shows when focused. A chat with the keyboard up: the menu closes it, the scrim
   does not bring it back. While open the page behind does not scroll (a long Library, a long chat).
4. Widen past 768 while open: it closes, the sidebar shows, `<main>` scrolls. Reduced motion: no slide.
   768, 1024, 1440: nothing of it shows. Flag off against the baseline.
5. Types, the whole suite, lint, both production builds.

## Questions for the controller

Each has the plan's default in brackets; the implementers build the default unless the controller rules.

1. **Where the opener's picture comes from.** The controller's point 2 has the opener read the profile
   itself. It cannot without breaking the screens' tests: `DiscoverNext` is rendered with no
   `QueryClientProvider` (`discover-next.test.tsx:107-117`), so any query hook in the opener throws;
   Audience's container tests pin every request (`audience-next.test.tsx:286`, `:666` and fourteen more);
   Library's first page pins `["/api/threads/library"]` (`library-next.test.tsx:1010`); the loading
   frames render bare (`library-next.test.tsx:349`, `discover-next.test.tsx:740`,
   `audience-screen.test.tsx:452`); `/dev/home` asserts it sends nothing. [The drawer's frame, mounted
   once, reads `useProfile()` (shared with the sidebar's read: no request of its own) and publishes
   `accountFace` in the shell store; the opener reads the store only. One field more than point 1 lists.]
2. **One rule for the initials.** Spec 3.5 says "as the sidebar" (name → initials, else `?`). Home's
   corner today uses `initialsOf(name, email)`, held empty while the first read is out
   (`greeting.ts:17-23`, `home-next.tsx:141-146`): "a lone `?` reads as Help". [Home's rule, for the
   opener and the drawer's account. They differ only for a profile with an email and no name.]
3. **The balance is not a shared query.** Spec section 2 and seam-map fact 1 say the drawer reads the
   same queries; `useSubscription` is component state with its own `fetch` per caller
   (`use-subscription.ts:63-86`). [The frame calls it once: one more `GET /api/subscription` per app
   load. The other way, a shared query, edits `use-subscription.ts`, out of this part.]
4. **Home inside a chat.** The drawer's Home is the sidebar's link to `/home`; a chat is not a route, so
   on `/home` with a chat open the link most likely keeps the chat on screen, as the sidebar's does on a
   desk (not checked in a browser). [Copy the sidebar; check 2. If that is wrong, one line: in a chat,
   Home hands `{ kind: "after", run: actions.newThread }`.]
5. **The open chat's own row** only closes: `openThread` would run `switchThread()`, which resets the
   board for the chat on screen (`board-store.ts:275-284`); the sidebar calls it anyway. [Closes only.]
6. **New chat waits for the slide** (about 300 ms), or on a blank Home the cursor would not reach the
   field (the focus reason above). [Waits in every case: one rule.]
7. **Audience at 320.** The opener takes 48 from a row that already drops its title to 24 under 360
   (`audience-screen.tsx:303`); the pill's name is cut shorter. [Accept; check 1 looks.]
8. **Settings is never lit**, also on `/settings` (the sidebar has no such row). [Not lit.] **The glyph**
   is three equal lines; the drawing's may differ. [Equal; check 1 compares.]
9. **Seam-map corrections.** (a) Fact 1, "the balance [is] already loaded": Question 3. (b) Section 5
    lists `next-shell.test.tsx:97-110`, `:208-327`, `:329-401`, `:403-464` as changing; most of those
    have the marker and keep Back (Task 2 names the four that change), and it misses
    `next-shell-pushed-title.test.tsx:91-96`. (c) Section 9's open point is settled: Radix's scroll lock
    wraps the overlay (`RemoveScroll`, react-dialog `index.mjs:108`), so the overlay must be rendered.

## Self-review

- Spec 3.1: Tasks 2 (the chat's band, pushed pages keep Back) and 3 (the four places, Library's search).
  3.2, 3.4, 3.5: Task 1. 3.3: Task 1, and Task 2 for the real opener's focus. 4: Task 1 and Question 3.
  5: no task adds a swipe, row actions, a search or a theme switch. 6: `DRAWER_WORDS`, Task 1. 10: the
  tasks' tests and the controller's checks.
- No "TBD". The names agree across tasks: `drawerOpen`, `openDrawer`, `closeDrawer`, `accountFace`,
  `AccountFace`, `DRAWER_WORDS`, `OPENER_SELECTOR`, `Drawer`, `DrawerRows`, `DrawerChoice`,
  `DrawerAccount`, `MenuButton`, `MenuIcon`, `leading`, `opener`.

<!-- plan complete -->
