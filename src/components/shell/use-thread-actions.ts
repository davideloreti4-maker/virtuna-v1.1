"use client";

import { useEffect, useMemo, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { useArchiveThread } from "@/hooks/queries";
import {
  NEW_THREAD_SENTINEL,
  clearActiveThreadCookie,
  setActiveThreadCookie,
} from "@/lib/threads/active-thread-cookie";
import { useBoardStore } from "@/stores/board-store";

export interface ThreadActions {
  /** Leave the open thread for a blank one. No row is created until the first message is sent. */
  newThread: () => void;
  /** Re-open a past thread where it was; only a sent message re-orders history. */
  openThread: (id: string) => void;
  /** Archive a thread. `wasActive`: it is the one open right now. */
  deleteThread: (id: string, wasActive: boolean) => Promise<void>;
}

/**
 * The thread actions of the app chrome: the same three the legacy Sidebar keeps as private
 * handlers (Sidebar.tsx is not edited while both shells exist). A thread is not a route: the
 * open one is a cookie plus a store pointer, and /home renders it.
 */
export function useThreadActions(): ThreadActions {
  const router = useRouter();
  const pathname = usePathname();
  const archiveThread = useArchiveThread();
  const { toast } = useToast();
  const switchThread = useBoardStore((s) => s.switchThread);
  const setActiveThreadId = useBoardStore((s) => s.setActiveThreadId);

  // The object below is stable; these change every render and are read at call time. Synced in
  // an effect, not during render: a render React discards must not leave its values behind
  // (react-hooks/refs). useRef seeds the first pass.
  const live = useRef({ pathname, archiveThread, toast });
  useEffect(() => {
    live.current = { pathname, archiveThread, toast };
  });

  return useMemo<ThreadActions>(
    () => ({
      newThread: () => {
        // The sentinel makes /home render blank instead of re-opening the newest thread.
        setActiveThreadCookie(NEW_THREAD_SENTINEL);
        setActiveThreadId(null);
        switchThread();
        router.push("/home");
      },
      openThread: (id) => {
        setActiveThreadCookie(id);
        setActiveThreadId(id);
        switchThread();
        router.push("/home");
      },
      deleteThread: async (id, wasActive) => {
        // Where the creator is counts at click time, as in the legacy sidebar: a place switched
        // to while the request is out must not change what this delete does.
        const onHome = live.current.pathname === "/home";
        try {
          await live.current.archiveThread.mutateAsync(id);
        } catch {
          // The optimistic removal rolls back about two seconds later. Say so, and do NOT drop
          // the pointer: the thread still exists, and dropping it would strand the creator.
          live.current.toast({ variant: "error", title: "Couldn't delete that thread." });
          return;
        }
        if (wasActive && onHome) {
          clearActiveThreadCookie();
          setActiveThreadId(null);
          switchThread();
        }
      },
    }),
    [router, setActiveThreadId, switchThread],
  );
}
