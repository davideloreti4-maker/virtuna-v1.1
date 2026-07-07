/**
 * active-thread-cookie.ts — the "currently open thread" pointer.
 *
 * The multi-thread model used to infer the ACTIVE thread as "the most-recently
 * updated open thread" (getOpenThread ORDER BY updated_at DESC). That conflated
 * two different things:
 *   - which thread is CURRENTLY OPEN on screen, and
 *   - which thread was MOST RECENTLY MESSAGED (its sidebar sort position).
 * So merely re-opening an old thread had to bump its updated_at (jumping it to the
 * top of history), and starting a fresh thread had to insert a row (a blank thread
 * polluting history before a single message was sent).
 *
 * This decouples them with an explicit pointer: a same-origin cookie naming the
 * open thread id. Every API request carries it, so the server resolves the target
 * thread centrally (getOpenThread / createOpenThreadLazy) — no per-route wiring.
 *
 * Sort order stays `updated_at DESC`, but only a SENT MESSAGE bumps updated_at now
 * (insertMessage), never a plain open. Opening a thread just re-points the cookie.
 *
 * Not httpOnly by design: the value is only a thread id, and the server ALWAYS
 * re-verifies ownership (user_id scope) before trusting it — a forged/foreign id
 * simply falls through to the newest-open-thread default.
 */

/** Cookie name for the active-thread pointer (shared client ↔ server). */
export const ACTIVE_THREAD_COOKIE = "maven_active_thread";

/**
 * Sentinel value meaning "a fresh blank thread — no row exists yet". The composer
 * renders empty for this; the row is created lazily on the FIRST message send
 * (ensureThreadForSend), at which point the cookie flips to the real thread id.
 */
export const NEW_THREAD_SENTINEL = "__new__";

/** Client-only: point the cookie at a thread id (or the new-blank-thread sentinel). */
export function setActiveThreadCookie(value: string): void {
  if (typeof document === "undefined") return;
  // 1-year, path=/, SameSite=Lax — survives refresh, scoped to same-site nav.
  document.cookie = `${ACTIVE_THREAD_COOKIE}=${encodeURIComponent(value)}; path=/; max-age=31536000; samesite=lax`;
}

/** Client-only: clear the pointer (→ server falls back to the newest open thread). */
export function clearActiveThreadCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${ACTIVE_THREAD_COOKIE}=; path=/; max-age=0; samesite=lax`;
}

/** Client-only: read the current pointer value (thread id, sentinel, or null). */
export function getActiveThreadCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${ACTIVE_THREAD_COOKIE}=([^;]+)`),
  );
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}
