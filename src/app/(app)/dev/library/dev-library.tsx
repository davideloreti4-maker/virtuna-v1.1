"use client";

import { useEffect, useRef, useState } from "react";

import { fallbackTitle } from "@/components/library-next/chat-row";
import { LibraryScreen, type ChatRowData, type LibraryFilter, type SavedRowData } from "@/components/library-next/library-screen";
import { RowMenu } from "@/components/library-next/row-menu";

/**
 * Library on local state, for /dev/library (`page.tsx`). The fixtures follow the real mix of a
 * creator's chats (most hold no picture: half are plain chats, most of the rest drafts, a few
 * simulated; a stored frame exists for about one run in ten): one video with a frame, one with
 * neither frame nor stored file, an untitled video chat (its fallback title), a pinned chat, a title
 * that needs two lines, a plain chat. The lines are what `rowLine` writes. The filter, the search and
 * "Show more" work on the fixtures; nothing here sends anything.
 */

/** The states the page can open in (`page.tsx` checks the name). */
export type DevLibraryState = "chats" | "loading" | "empty" | "drafts" | "simulated" | "saved" | "search" | "error";

/** A video frame, drawn: a person in front of a wall of posters, 9:16. */
const FRAME =
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 90 160">` +
      `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d9c6aa"/><stop offset="1" stop-color="#8d7258"/></linearGradient></defs>` +
      `<rect width="90" height="160" fill="url(#g)"/>` +
      `<rect x="4" y="18" width="24" height="38" rx="3" fill="#c0503f" opacity=".6"/>` +
      `<rect x="63" y="10" width="23" height="34" rx="3" fill="#3f6f8f" opacity=".55"/>` +
      `<rect x="60" y="50" width="26" height="30" rx="3" fill="#e3b448" opacity=".55"/>` +
      `<path d="M8 160c2-36 18-54 37-54s35 18 37 54z" fill="#5b7fa6"/>` +
      `<rect x="38" y="84" width="14" height="22" rx="6" fill="#b98262"/>` +
      `<ellipse cx="45" cy="66" rx="17" ry="21" fill="#c48e6a"/>` +
      `<path d="M24 70c-6-24 8-40 21-40s28 14 21 40c-2-10-6-20-21-22c-15 2-19 12-21 22z" fill="#2c211b"/>` +
      `</svg>`,
  );

const TEXT_RESULT = "/dev/answers?state=p7";
const VIDEO_RESULT = "/dev/result?fixture=middle";

const CHATS: ChatRowData[] = [
  {
    id: "dev-1",
    title: "Hook formats, the $400 test",
    pinned: true,
    line: "3 hooks · simulated 2h ago",
    lead: "hooks",
    stageWord: "Simulated",
    frame: null,
    still: null,
    gauge: { number: 66, describes: "66% would stop to watch", href: TEXT_RESULT },
  },
  {
    id: "dev-2",
    title: "Reacting to my first video",
    pinned: false,
    line: "Video · simulated 5h ago",
    lead: "video",
    stageWord: "Simulated",
    frame: FRAME,
    still: null,
    gauge: { number: 38, describes: "38% watch to the end", href: VIDEO_RESULT },
  },
  {
    id: "dev-3",
    title: "Remix: the $100,000 challenge",
    pinned: false,
    line: "Remix · 1d ago",
    lead: "remix",
    stageWord: "Draft",
    frame: null,
    still: null,
    gauge: null,
  },
  {
    id: "dev-4",
    title: "Morning routine, no cuts",
    pinned: false,
    line: "Script · simulated 2d ago",
    lead: "script",
    stageWord: "Simulated",
    frame: null,
    still: null,
    gauge: { number: 63, describes: "63% would stop to watch", href: TEXT_RESULT },
  },
  {
    id: "dev-5",
    title: fallbackTitle("video"),
    pinned: false,
    line: "Video · simulated 3d ago",
    lead: "video",
    stageWord: "Simulated",
    frame: null,
    still: null,
    gauge: { number: 47, describes: "47% watch to the end", href: VIDEO_RESULT },
  },
  {
    id: "dev-6",
    title: "Ideas for next week",
    pinned: false,
    line: "5 ideas · 4d ago",
    lead: "ideas",
    stageWord: "Draft",
    frame: null,
    still: null,
    gauge: null,
  },
  {
    id: "dev-7",
    title: "Ranking five ways to spend $1,000 on a new setup",
    pinned: false,
    line: "Script · 6d ago",
    lead: "script",
    stageWord: "Draft",
    frame: null,
    still: null,
    gauge: null,
  },
  {
    id: "dev-8",
    title: "Why the last one flopped",
    pinned: false,
    line: "Chat · Oct 24",
    lead: "chat",
    stageWord: null,
    frame: null,
    still: null,
    gauge: null,
  },
];

/** What "Show more" brings: three older chats. */
const OLDER: ChatRowData[] = [
  { id: "dev-9", title: "One take, no script", pinned: false, line: "Chat · Oct 19", lead: "chat", stageWord: null, frame: null, still: null, gauge: null },
  { id: "dev-10", title: "Gym intro, three ways", pinned: false, line: "3 hooks · Oct 12", lead: "hooks", stageWord: "Draft", frame: null, still: null, gauge: null },
  {
    id: "dev-11",
    title: "Night routine voiceover",
    pinned: false,
    line: "Script · simulated Oct 3",
    lead: "script",
    stageWord: "Simulated",
    frame: null,
    still: null,
    gauge: { number: 52, describes: "52% would stop to watch", href: TEXT_RESULT },
  },
];

const SAVED: SavedRowData[] = [
  {
    id: "dev-s1",
    kind: "hooks",
    text: "I spent $400 testing every viral hook format. One won by a mile.",
    line: "Hook · from Hook formats, the $400 test",
    canOpen: true,
  },
  { id: "dev-s2", kind: "ideas", text: "Rank the five worst openings I ever posted", line: "Idea · from Ideas for next week", canOpen: true },
  // Just removed: its "Removed. Undo" line, in its place.
  {
    id: "dev-s4",
    kind: "script",
    text: "I quit sugar for a month and this happened",
    line: "Script · from Sugar month",
    canOpen: true,
    state: "removed",
  },
  { id: "dev-s3", kind: "video", text: "There's a wave of $100,000 challenges", line: "Video · saved in Discover", canOpen: false },
];

const START: Record<DevLibraryState, { filter?: LibraryFilter; state?: "loading" | "error"; none?: boolean; search?: boolean }> = {
  chats: {},
  loading: { state: "loading" },
  empty: { none: true },
  drafts: { filter: "drafts" },
  simulated: { filter: "simulated" },
  saved: { filter: "saved" },
  search: { search: true },
  error: { state: "error" },
};

/** How long the fake next page takes, so the busy "Show more" can be seen. */
const MORE_MS = 900;

export function DevLibrary({ state, query: startQuery }: { state: DevLibraryState; query: string | null }) {
  const start = START[state];
  const [filter, setFilter] = useState<LibraryFilter>(start.filter ?? "all");
  const [query, setQuery] = useState(startQuery ?? (start.search ? "morning" : ""));
  const [screen, setScreen] = useState<"loading" | "ready" | "error">(start.state ?? "ready");
  const [chats, setChats] = useState<ChatRowData[]>(start.none ? [] : CHATS);
  const [saved, setSaved] = useState<SavedRowData[]>(start.none ? [] : SAVED);
  const [hasMore, setHasMore] = useState(!start.none);
  const [loadingMore, setLoadingMore] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const words = query.trim().toLowerCase();
  const shown = chats.filter(
    (chat) =>
      (filter === "all" || (filter === "drafts" && chat.stageWord === "Draft") || (filter === "simulated" && chat.stageWord === "Simulated")) &&
      (words === "" || chat.title.toLowerCase().includes(words)),
  );

  return (
    // On the phone /dev/library is not a place, so the shell draws its Back header in the band that
    // Library's header takes on /library (where the shell draws no header). The page starts under
    // that header here, so the header stays in view; /library itself has no such offset.
    <div className="flex min-h-full flex-col max-md:pt-[var(--mobile-nav-band)]">
      <LibraryScreen
        filter={filter}
        onFilter={setFilter}
        query={query}
        onQuery={setQuery}
        state={screen}
        onRetry={() => setScreen("ready")}
        chats={shown}
        saved={saved}
        hasMore={hasMore && words === ""}
        loadingMore={loadingMore}
        onMore={() => {
          setLoadingMore(true);
          timer.current = setTimeout(() => {
            setChats((all) => [...all, ...OLDER]);
            setHasMore(false);
            setLoadingMore(false);
          }, MORE_MS);
        }}
        // Opening a chat, a saved piece or a new chat is the container's; nothing here.
        onOpenChat={() => {}}
        onOpenSaved={() => {}}
        // Remove shows the row's "Removed. Undo" line and Undo takes it back; nothing is sent here.
        onRemoveSaved={(id) => setSaved((all) => all.map((item) => (item.id === id ? { ...item, state: "removed" } : item)))}
        onUndoSaved={(id) => setSaved((all) => all.map((item) => (item.id === id ? { ...item, state: undefined } : item)))}
        onNewChat={() => {}}
        // Each row's More works on the fixtures (rename, pin, delete); nothing is sent here. The
        // untitled video chat renames from an empty field, as a real untitled chat does.
        renderRowMenu={(chat) => (
          <RowMenu
            title={chat.title}
            renameFrom={chat.id === "dev-5" ? "" : chat.title}
            pinned={chat.pinned}
            // What the delete step says goes: the line's first part, as the container's summary says it.
            inside={chat.lead === "chat" ? null : (chat.line.split(" · ")[0] ?? "").toLowerCase() || null}
            onRename={(title) => setChats((all) => all.map((c) => (c.id === chat.id ? { ...c, title } : c)))}
            onTogglePin={() => setChats((all) => all.map((c) => (c.id === chat.id ? { ...c, pinned: !c.pinned } : c)))}
            onDelete={() => setChats((all) => all.filter((c) => c.id !== chat.id))}
          />
        )}
      />
    </div>
  );
}
