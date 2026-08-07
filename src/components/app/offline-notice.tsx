"use client";

/**
 * THE STANDING OFFLINE CONDITION.
 *
 * A bar, not a dialog: a modal would trap the user in the one state they cannot act on. It is
 * `role="status"` + `aria-live="polite"` rather than an alert because being offline is a
 * condition they are already living in, not an event to interrupt them with.
 *
 * ⚠️ NO ACCENT. This is exactly where a red fill feels natural, and the accent dosage rule is
 * LOCKED — the sanctioned uses are the live-presence dot, the lit constellation node and the
 * brand mark, and this is none of them. The words carry the severity.
 *
 * ⚠️ IT SITS AT THE TOP, NOT THE BOTTOM. The composer dock is `absolute inset-x-0 bottom-0`
 * (composer.tsx:3535), so a bottom bar lands on top of the send button whose disabled state this
 * notice exists to explain.
 *
 * The mobile offset is a custom property set ON THIS ELEMENT rather than inherited.
 * `--mobile-nav-band` is declared inline on <main> (app-shell.tsx:172), so it reaches only
 * <main>'s descendants; a notice mounted anywhere else resolves it to nothing and the fallback
 * silently becomes 0 — which looks correct on desktop and covers the hamburger on mobile. Owning
 * the value means this renders correctly wherever it is mounted. It clears on `md`, at the same
 * 768px boundary as the opener tab's own `md:hidden`.
 */

import type { CSSProperties } from "react";

import { useOnline } from "@/hooks/use-online";
import { MOBILE_NAV_BAND } from "@/components/sidebar/Sidebar";

export function OfflineNotice() {
  const online = useOnline();
  if (online) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 top-[calc(env(safe-area-inset-top)+var(--offline-notice-top))] z-50 border-b border-white/[0.06] px-4 py-2 text-center text-sm md:top-0"
      style={
        {
          "--offline-notice-top": `${MOBILE_NAV_BAND}px`,
          background: "var(--color-chrome)",
          color: "var(--color-cream-secondary)",
        } as CSSProperties
      }
    >
      You’re offline. Nothing will send until the connection is back.
    </div>
  );
}
