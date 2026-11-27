import { create } from 'zustand';
import { initialAutoRail } from '@/lib/shell/side-nav-default';

interface ShellState {
  /**
   * True while /home shows a thread (not the blank arrival). Published by HomePageLayout, read
   * by the new app shell, which gives a thread the phone's band (its title, Back or the menu, New
   * chat) instead of Home's own top row. A thread is not a route, so the shell cannot derive this
   * from the URL. Not persisted.
   */
  threadOpen: boolean;
  setThreadOpen: (open: boolean) => void;
  /**
   * True when the desktop sidebar shows as the rail only because the window is narrow and the
   * creator has never chosen. The app's default, not a choice, so it is not persisted: the
   * sidebar store's saved `isCollapsed` holds the creator's own choice only.
   */
  autoRail: boolean;
  setAutoRail: (v: boolean) => void;
  /**
   * The phone header's title on a pushed screen that is not a thread and names itself from its
   * data (the result page: "Video · 0:29"). The page sets it and clears it on unmount. Empty:
   * no title. Not persisted.
   */
  pushedTitle: string;
  setPushedTitle: (title: string) => void;
  /**
   * New look: the audience the open thread is for (thread answers step 1, Task 6), shown as
   * "For {audience}" under the title in the phone's thread header. Published by the composer, which
   * knows the thread's runs, and cleared when it goes. Empty: no line. Not persisted.
   */
  threadAudience: string;
  setThreadAudience: (audience: string) => void;
  /**
   * New look: a counter the composer watches to put the cursor in its field (Home plan 2026-11-23).
   * "New chat" on a Home that is already blank bumps it instead of reloading the screen.
   * Not persisted.
   */
  fieldFocusSignal: number;
  focusField: () => void;
  /**
   * New look (owner 2026-11-26): "New chat" (sidebar, drawer, ⌘N, the phone header) opens an empty
   * chat, not Home: no greeting, no Money made, no carousel; quick actions and the field. Set by
   * `newThread`; cleared by going Home (the Home row, the logo) and by opening a chat. The same
   * `/home` with no chat open draws Home while this is false.
   */
  newChat: boolean;
  setNewChat: (v: boolean) => void;
  /**
   * New look: where the phone's Back in a thread goes, when the thread was opened from a screen the
   * creator should get back to (Library, plan 2026-11-23). Null: the thread's band shows the menu in
   * Back's place.
   *
   * Written, with the two values beside it, by `openThread(id, { back, title, scroll })` in the same
   * call that clears all three for every other open (`setThreadBack`). Cleared, all three, by
   * `newThread`, by the command palette's open, by `useOpenThread` (the result page's "Script this
   * one"), by the dead-end result page's Home button, by a chat that turned out to be gone (the
   * composer), and when the creator leaves the thread for a screen that is neither the thread nor
   * one of its results (NextShell). The Back in that thread drops the marker and the title, and
   * leaves the scroll for Library to take (`backFromThread`). Not persisted.
   */
  threadBack: string | null;
  /**
   * The name the row that opened the chat showed, for a chat with no title of its own ("Video
   * simulation"): the thread header shows it while the chat's own title is null, so one chat has
   * one name (`useThreadTitle`). For that chat only (`id`). Null: none.
   */
  threadTitleHint: { id: string; title: string } | null;
  /** The hint alone, Back's marker and Library's scroll untouched. The composer names a chat with no
   *  title from its first message this way (thread feel §5.1), so the header does not say "New chat"
   *  until the list is read again. */
  setThreadTitleHint: (hint: { id: string; title: string } | null) => void;
  /** How far Library was scrolled when a row opened its chat, and at which address: Library takes
   *  it on its way back (`takeLibraryScroll`). Null: nothing to put back. */
  libraryScroll: LibraryScroll | null;
  /** The marker and the two values beside it, in one write; what is not given is cleared. */
  setThreadBack: (path: string | null, extras?: { title?: { id: string; title: string } | null; scroll?: LibraryScroll | null }) => void;
  /** Back in a thread opened from Library: the marker and the title go, the scroll stays for
   *  Library to put back. */
  backFromThread: () => void;
  /** Library's scroll to put back, taken (it is used once). */
  takeLibraryScroll: () => LibraryScroll | null;
  /** New look, phone: the left drawer is open. In memory only: a reload starts closed. */
  drawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  /** The account's face, published by the drawer's frame from the profile query the sidebar already
   *  reads, so an opener reads no query and sends no request. Null: not published yet. */
  accountFace: AccountFace | null;
  setAccountFace: (face: AccountFace | null) => void;
}

/** A Library address and how far its list was scrolled. */
export interface LibraryScroll {
  href: string;
  top: number;
}

/** The creator's picture and initials as the drawer's openers draw them. */
export interface AccountFace {
  picture: string | null;
  initials: string;
}

export const useShellStore = create<ShellState>()((set, get) => ({
  threadOpen: false,
  setThreadOpen: (open) => set({ threadOpen: open }),
  // Known before the first render, not set by an effect after it: the sidebar's first frame must
  // already be the rail, or it is drawn at 248 and slides to 56. An effect runs too late: on some
  // pages other code reads layout in the same commit (Radix Presence on /settings, the thread
  // autoscroll on /home), which fixes 248 as the transition's start before any re-render.
  // Safe: false on the server, and the new shell renders only on the client, inside AuthGuard
  // after the session check, so no server-rendered markup depends on this value.
  autoRail: initialAutoRail(),
  setAutoRail: (v) => set({ autoRail: v }),
  pushedTitle: '',
  setPushedTitle: (title) => set({ pushedTitle: title }),
  threadAudience: '',
  setThreadAudience: (audience) => set({ threadAudience: audience }),
  fieldFocusSignal: 0,
  focusField: () => set((s) => ({ fieldFocusSignal: s.fieldFocusSignal + 1 })),
  newChat: false,
  setNewChat: (v) => set({ newChat: v }),
  threadBack: null,
  threadTitleHint: null,
  libraryScroll: null,
  setThreadBack: (path, extras) =>
    set({ threadBack: path, threadTitleHint: extras?.title ?? null, libraryScroll: extras?.scroll ?? null }),
  backFromThread: () => set({ threadBack: null, threadTitleHint: null }),
  setThreadTitleHint: (hint) => set({ threadTitleHint: hint }),
  takeLibraryScroll: () => {
    const scroll = get().libraryScroll;
    if (scroll !== null) set({ libraryScroll: null });
    return scroll;
  },
  drawerOpen: false,
  openDrawer: () => set({ drawerOpen: true }),
  closeDrawer: () => set({ drawerOpen: false }),
  accountFace: null,
  setAccountFace: (face) => set({ accountFace: face }),
}));
