import { NEW_LOOK_ENABLED } from "@/lib/flags/new-look";
import { NEW_THREAD_SENTINEL, getActiveThreadCookie } from "@/lib/threads/active-thread-cookie";

/**
 * New look (Home plan 2026-11-23): does /home start on a chat's load rather than on Home?
 * Yes unless the pointer is a blank new chat. A thread id opens that chat; no pointer at all lets
 * the server open the newest chat, if there is one. Read once, as the first value of the composer's
 * and the page layout's `rehydrating`, so the first paint already shows the loading outline and
 * hides the phone tab bar, never Home for a frame.
 *
 * Client only (`document.cookie`): /home renders inside AuthGuard after its session check, so no
 * server markup depends on it. Flag off: always false, as before.
 */
export function opensIntoThread(): boolean {
  return NEW_LOOK_ENABLED && getActiveThreadCookie() !== NEW_THREAD_SENTINEL;
}
