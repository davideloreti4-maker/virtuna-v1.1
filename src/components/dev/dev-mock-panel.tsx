"use client";

/**
 * DevMockPanel — a dev-only floating control for the zero-cost skill sandbox.
 *
 * Renders ONLY outside production (process.env.NODE_ENV is inlined + tree-shaken at build,
 * so this component and its handlers never ship to prod). Gives three actions:
 *
 *   • Seed demo thread  → POST /api/dev/mock/seed → reload (the preloaded populated chat)
 *   • Clear thread      → POST /api/dev/mock/clear → reload (blank composer)
 *   • Mock skills [⏻]   → toggles the `numen_mock` cookie so /api/tools/* replay fixtures
 *                          instead of calling Qwen (no reload needed — routes read per-request)
 *
 * Matte, on-system (surface-elevated + 6% borders), bottom-right, collapsible so it stays
 * out of the way while you iterate on the real UI.
 */

import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { MOCK_COOKIE } from "@/lib/dev/dev-mock";
import {
  setActiveThreadCookie,
  NEW_THREAD_SENTINEL,
} from "@/lib/threads/active-thread-cookie";

const IS_DEV = process.env.NODE_ENV !== "production";

function readMockCookie(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie.split("; ").some((c) => c === `${MOCK_COOKIE}=1`);
}

function writeMockCookie(on: boolean): void {
  // Session cookie (no Max-Age) scoped to the app — cleared on browser close or toggle-off.
  document.cookie = on
    ? `${MOCK_COOKIE}=1; path=/; SameSite=Lax`
    : `${MOCK_COOKIE}=; path=/; Max-Age=0; SameSite=Lax`;
}

export function DevMockPanel() {
  const [open, setOpen] = useState(false);
  const [mockOn, setMockOn] = useState(false);
  const [busy, setBusy] = useState<null | "seed" | "clear">(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    setMockOn(readMockCookie());
  }, []);

  const run = useCallback(async (action: "seed" | "clear") => {
    setBusy(action);
    setNote(null);
    try {
      const res = await fetch(`/api/dev/mock/${action}`, { method: "POST" });
      if (!res.ok) {
        setNote(`Failed (${res.status})`);
        setBusy(null);
        return;
      }
      // Point the active-thread cookie at the target so getOpenThread resolves it on reload
      // (the server sets it too — this makes the client immediate + independent of Set-Cookie).
      const json = (await res.json().catch(() => null)) as { threadId?: string } | null;
      if (action === "seed" && json?.threadId) {
        setActiveThreadCookie(json.threadId);
      } else if (action === "clear") {
        setActiveThreadCookie(NEW_THREAD_SENTINEL);
      }
      // Reload so the composer rehydrates from the freshly-seeded/cleared open thread.
      window.location.reload();
    } catch {
      setNote("Network error");
      setBusy(null);
    }
  }, []);

  const toggleMock = useCallback(() => {
    const next = !mockOn;
    writeMockCookie(next);
    setMockOn(next);
    setNote(next ? "Skill runs now replay fixtures (no Qwen)" : "Skill runs hit the real engine");
  }, [mockOn]);

  if (!IS_DEV) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[200] select-none font-sans">
      {open ? (
        <div className="w-[248px] rounded-[12px] border border-white/[0.06] bg-surface-elevated p-3 shadow-[0_16px_50px_rgba(0,0,0,0.5)]">
          <div className="mb-2.5 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-foreground-muted/70">
              Dev · Mock
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Collapse dev panel"
              className="grid h-6 w-6 place-items-center rounded-md text-foreground-muted transition-colors hover:bg-white/[0.05] hover:text-foreground"
            >
              ×
            </button>
          </div>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => run("seed")}
              disabled={busy !== null}
              className="rounded-lg bg-white/[0.06] px-3 py-2 text-left text-[13px] font-medium text-foreground transition-colors hover:bg-white/[0.10] disabled:opacity-50"
            >
              {busy === "seed" ? "Seeding…" : "Seed demo thread"}
            </button>
            <button
              type="button"
              onClick={() => run("clear")}
              disabled={busy !== null}
              className="rounded-lg border border-white/[0.06] px-3 py-2 text-left text-[13px] text-foreground-secondary transition-colors hover:border-white/[0.10] hover:text-foreground disabled:opacity-50"
            >
              {busy === "clear" ? "Clearing…" : "Clear thread"}
            </button>

            <button
              type="button"
              onClick={toggleMock}
              role="switch"
              aria-checked={mockOn}
              className="mt-0.5 flex items-center justify-between rounded-lg px-3 py-2 text-[13px] text-foreground transition-colors hover:bg-white/[0.04]"
            >
              <span className="flex flex-col text-left">
                <span className="font-medium">Mock skill runs</span>
                <span className="text-[11px] text-foreground-muted">replay fixtures · no Qwen</span>
              </span>
              <span
                className={cn(
                  "relative h-[18px] w-[32px] shrink-0 rounded-full transition-colors",
                  mockOn ? "bg-action" : "bg-white/[0.14]",
                )}
              >
                <span
                  className={cn(
                    "absolute top-[2px] h-[14px] w-[14px] rounded-full bg-white transition-transform",
                    mockOn ? "translate-x-[16px]" : "translate-x-[2px]",
                  )}
                />
              </span>
            </button>
          </div>

          {note && <p className="mt-2 text-[11px] leading-snug text-foreground-muted">{note}</p>}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open dev mock panel"
          className={cn(
            "grid h-9 w-9 place-items-center rounded-full border border-white/[0.06] bg-surface-elevated text-[13px] shadow-[0_8px_24px_rgba(0,0,0,0.4)] transition-colors hover:bg-white/[0.08]",
            mockOn ? "text-action" : "text-foreground-muted",
          )}
          title={mockOn ? "Dev mock — skill runs mocked" : "Dev mock panel"}
        >
          ⚙
        </button>
      )}
    </div>
  );
}
