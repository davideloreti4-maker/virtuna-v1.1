"use client";

/**
 * useOpenThread — re-open a past thread from anywhere in the app.
 *
 * ⚠️ There is NO `/home?thread=<id>` route. The Library handoff assumed one ("the provenance line
 * resolves thread_id to /home?thread=…"), and nothing in the codebase reads a thread search param
 * — `grep -rn "searchParams" src/app/(app)/home/` is empty. Linking there would have opened
 * whatever thread was already active and looked like a working deep link.
 *
 * The real contract is a three-step client handshake, extracted verbatim from
 * `Sidebar.handleOpenThread` (the only implementation that existed):
 *
 *   1. `setActiveThreadCookie(id)` — the pointer every API request carries; the server resolves
 *      the target thread from it centrally, so no route needs per-call wiring.
 *   2. `setActiveThreadId(id)` — the board store, for the sidebar's active highlight.
 *   3. `switchThread()` — resets board state and bumps the signals the composer reloads on.
 *   4. `router.push("/home")`.
 *
 * Deliberately does NOT touch `updated_at` (no POST to /api/threads/[id]/activate): re-opening a
 * thread must not jump it to the top of history. Only a sent message re-orders the sidebar.
 *
 * Extracted rather than duplicated so the Library and the sidebar cannot drift — a second
 * hand-rolled copy of this sequence that forgets `switchThread()` opens the thread server-side
 * while the composer keeps rendering the previous one.
 */

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useBoardStore } from "@/stores/board-store";
import { setActiveThreadCookie } from "@/lib/threads/active-thread-cookie";

export function useOpenThread(): (threadId: string) => void {
  const router = useRouter();
  const setActiveThreadId = useBoardStore((s) => s.setActiveThreadId);
  const switchThread = useBoardStore((s) => s.switchThread);

  return useCallback(
    (threadId: string) => {
      setActiveThreadCookie(threadId);
      setActiveThreadId(threadId);
      switchThread();
      router.push("/home");
    },
    [router, setActiveThreadId, switchThread],
  );
}
