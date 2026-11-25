"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { ChatCircleText, Gift, Plus, SlidersHorizontal, UserCircle, UsersThree } from "@phosphor-icons/react";
import type { CommandItem } from "@/components/primitives/CommandPalette";
import { useThreadList } from "@/hooks/queries";
import { NEW_LOOK_ENABLED } from "@/lib/flags/new-look";
import {
  clearActiveThreadCookie,
  setActiveThreadCookie,
} from "@/lib/threads/active-thread-cookie";
import { useBoardStore } from "@/stores/board-store";
import { useShellStore } from "@/stores/shell-store";

/** Compact relative time for a thread row's subtitle ("3d", "2mo"). */
const rtf =
  typeof Intl !== "undefined"
    ? new Intl.RelativeTimeFormat("en", { numeric: "auto", style: "narrow" })
    : null;

function relativeTime(iso: string | undefined): string {
  if (!iso || !rtf) return "";
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return "";
  const diffSec = (parsed - Date.now()) / 1000;
  const abs = Math.abs(diffSec);
  if (abs < 60) return rtf.format(Math.round(diffSec), "second");
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), "hour");
  if (abs < 2592000) return rtf.format(Math.round(diffSec / 86400), "day");
  if (abs < 31536000) return rtf.format(Math.round(diffSec / 2592000), "month");
  return rtf.format(Math.round(diffSec / 31536000), "year");
}

/**
 * The items of the ⌘K palette: threads first (the only thing here that grows without bound),
 * then the actions and destinations. Shared by the legacy shell and the new shell.
 */
export function useCommandItems(): CommandItem[] {
  const router = useRouter();
  const { data: threads } = useThreadList();
  const switchThread = useBoardStore((s) => s.switchThread);
  const setActiveThreadId = useBoardStore((s) => s.setActiveThreadId);

  // The first version listed only Home / Audience / Settings / New audience, and
  // was rightly called out as pointless: every one of those is already visible in
  // a two-item sidebar, so the palette navigated you to things you could already
  // see. Threads are the only thing here that grows without bound and cannot be
  // scanned at a glance — they are what a search is FOR, and they are what the
  // trigger on the Threads header promises.
  //
  // Destinations stay, demoted below the threads: they cost nothing and they make
  // typing "set" resolve, but they are no longer the payload.
  const threadItems = useMemo<CommandItem[]>(
    () =>
      (threads ?? []).map((t) => ({
        id: `thread-${t.id}`,
        title: t.title ?? "New chat",
        subtitle: relativeTime(t.updated_at),
        group: "Threads",
        icon: <ChatCircleText size={16} />,
        // Same path the sidebar rows take — cookie, store pointer, switch, /home.
        // Anything less leaves the composer pointing at the previous thread.
        onSelect: () => {
          // Not opened from Library: Back in it starts a new chat (Library plan 2026-11-23).
          useShellStore.getState().setThreadBack(null);
          setActiveThreadCookie(t.id);
          setActiveThreadId(t.id);
          switchThread();
          router.push("/home");
        },
      })),
    [threads, router, setActiveThreadId, switchThread],
  );

  const commandItems = useMemo<CommandItem[]>(
    () => [
      ...threadItems,
      {
        id: "new-thread",
        title: "New thread",
        subtitle: "Start a fresh conversation",
        group: "Actions",
        icon: <Plus size={16} />,
        onSelect: () => {
          useShellStore.getState().setThreadBack(null);
          clearActiveThreadCookie();
          setActiveThreadId(null);
          switchThread();
          router.push("/home");
        },
      },
      {
        id: "new-audience",
        title: "New audience",
        subtitle: "Calibrate from a handle, an account, or a description",
        group: "Actions",
        icon: <UsersThree size={16} />,
        onSelect: () => router.push("/audience/new"),
      },
      {
        id: "audience",
        title: "Audience",
        subtitle: "Your calibrated audiences",
        group: "Go to",
        icon: <UsersThree size={16} />,
        onSelect: () => router.push("/audience"),
      },
      // You (plan 2026-11-24-you) and Earn (plan 2026-11-24-earn) exist under the new look only.
      ...(NEW_LOOK_ENABLED
        ? [
            { id: "you", title: "You", group: "Go to", icon: <UserCircle size={16} />, onSelect: () => router.push("/you") } satisfies CommandItem,
            { id: "earn", title: "Earn", group: "Go to", icon: <Gift size={16} />, onSelect: () => router.push("/earn") } satisfies CommandItem,
          ]
        : []),
      {
        id: "settings",
        title: "Settings",
        group: "Go to",
        icon: <SlidersHorizontal size={16} />,
        onSelect: () => router.push("/settings"),
      },
    ],
    [threadItems, router, setActiveThreadId, switchThread],
  );

  return commandItems;
}
