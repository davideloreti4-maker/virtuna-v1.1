"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { Dialog as DialogPrimitive } from "radix-ui";
import { initialsOf } from "@/components/home-next/greeting";
import { useProfile } from "@/hooks/queries/use-profile";
import { useIsMobileHydrated } from "@/hooks/useIsMobile";
import { cn } from "@/lib/utils";
import { useShellStore } from "@/stores/shell-store";
import { DrawerRows, type DrawerAccount, type DrawerChoice } from "./drawer-rows";
import { DRAWER_WORDS } from "./drawer-words";
import type { ThreadActions } from "./use-thread-actions";

/** What the drawer gives the focus back to when it closes with nothing chosen: its opener. */
export const OPENER_SELECTOR = "[data-drawer-opener]";

const SCRIM = cn(
  "fixed inset-0 z-[var(--z-modal-backdrop)] bg-scrim md:hidden",
  "motion-safe:duration-300 motion-safe:data-[state=open]:animate-in motion-safe:data-[state=open]:fade-in-0",
  "motion-safe:data-[state=closed]:animate-out motion-safe:data-[state=closed]:fade-out-0",
);
/** On the page's ground, flush left, full height, the safe areas kept free. No shadow: the scrim separates it.
 *  While it slides out it takes no taps (Radix sets its pointer events inline: hence the `!`). */
const PANEL = cn(
  "fixed inset-y-0 left-0 z-[var(--z-modal)] flex w-[min(86vw,320px)] flex-col bg-background text-foreground outline-none md:hidden",
  "data-[state=closed]:pointer-events-none!",
  "pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)]",
  "motion-safe:duration-300 motion-safe:ease-[var(--ease-out-quart)]",
  "motion-safe:data-[state=open]:animate-in motion-safe:data-[state=open]:slide-in-from-left",
  "motion-safe:data-[state=closed]:animate-out motion-safe:data-[state=closed]:slide-out-to-left",
);
/** "Close", out of sight until the keyboard reaches it (a screen reader on a touch screen has no
 *  Escape, and the scrim is not a control), below the safe area. */
const CLOSE =
  "sr-only focus-visible:not-sr-only focus-visible:absolute focus-visible:right-4 focus-visible:top-[calc(env(safe-area-inset-top)+16px)] focus-visible:z-[1] focus-visible:rounded-lg focus-visible:bg-surface-sunken focus-visible:px-3 focus-visible:py-1.5 focus-visible:text-meta focus-visible:font-[560] focus-visible:text-foreground";

/**
 * The phone's left drawer (new look): what the desktop sidebar carries, over a scrim. Mounted once
 * by the shell and opened through the shell store, so any opener is a plain button. The Radix dialog
 * directly, not the shared sheet: its left side carries the legacy look and slides with no regard
 * for reduced motion.
 *
 * Focus: on open to the title; on close back to the opener, unless a row led elsewhere (the new
 * screen keeps it; on a blank Home, New chat's field). Not the sheets' return-to-what-had-it rule:
 * in a chat that is the message field, and the keyboard would come back.
 */
export function Drawer({ actions }: { actions: ThreadActions }): React.JSX.Element {
  const open = useShellStore((s) => s.drawerOpen);
  const closeDrawer = useShellStore((s) => s.closeDrawer);
  const setAccountFace = useShellStore((s) => s.setAccountFace);
  const pathname = usePathname();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const { isMobile, hydrated } = useIsMobileHydrated();
  // The line `md:` draws: from 768 the sidebar is there.
  const wide = hydrated && !isMobile;
  /** A row led elsewhere: the focus is not given back to the opener. */
  const handedOn = useRef(false);
  /** The balance shown last: from the second opening it is drawn while the new read is out. Here, not
   *  in the module: it goes with the frame, so nothing of one account outlives a sign-out. */
  const balanceRef = useRef<number | null>(null);

  // The account, read here, once per mount of the shell, from the query the sidebar already makes.
  // Home's rule for the initials, empty while the first read is out; the sidebar's for the name.
  const { data: profile, isPending, failureCount } = useProfile();
  const pending = isPending && failureCount === 0;
  const picture = profile?.avatar ?? null;
  const initials = pending ? "" : initialsOf(profile?.name, profile?.email);
  useEffect(() => {
    setAccountFace({ picture, initials });
  }, [picture, initials, setAccountFace]);
  const account: DrawerAccount = {
    name: profile?.name?.trim() || profile?.email?.trim() || "Account",
    picture,
    initials,
  };

  // The shell is leaving (signed out, or Back out of the app): the store outlives it, so nothing of the
  // drawer may stay behind for the next mount to open, nor the face of this account.
  useEffect(
    () => () => {
      closeDrawer();
      setAccountFace(null);
    },
    [closeDrawer, setAccountFace],
  );

  // Also an opening that comes before the last panel has unmounted starts clean.
  useEffect(() => {
    if (open) handedOn.current = false;
  }, [open]);

  // From 768 the sidebar is there: close, so no scroll lock and no hidden page is left behind, and
  // the store does not say open while nothing is drawn.
  useEffect(() => {
    if (wide && open) closeDrawer();
  }, [wide, open, closeDrawer]);

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
    closeDrawer();
  };

  return (
    <DialogPrimitive.Root
      open={open && !wide}
      onOpenChange={(next) => {
        if (!next) closeDrawer();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay data-part="scrim" className={SCRIM} />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className={PANEL}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            // No scroll: the panel may still be off the screen at the left as it slides in.
            titleRef.current?.focus({ preventScroll: true });
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            // Read and cleared before acting on it, so no close leaves it set for the next one.
            const ledElsewhere = handedOn.current;
            handedOn.current = false;
            if (ledElsewhere) return;
            const active = document.activeElement;
            if (active && active !== document.body) return;
            // No scroll: the opener may sit partly above the edge of the scrolled page.
            document.querySelector<HTMLElement>(OPENER_SELECTOR)?.focus({ preventScroll: true });
          }}
        >
          <DialogPrimitive.Title ref={titleRef} tabIndex={-1} className="sr-only outline-none">
            {DRAWER_WORDS.menu}
          </DialogPrimitive.Title>
          <DrawerRows actions={actions} account={account} choose={choose} balanceRef={balanceRef} />
          <DialogPrimitive.Close className={CLOSE}>Close</DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
