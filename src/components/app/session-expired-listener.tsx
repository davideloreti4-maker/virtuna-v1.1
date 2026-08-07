"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SESSION_EXPIRED_EVENT } from "@/lib/auth/session-expired";

/**
 * THE ONE LISTENER FOR A DEAD SESSION — mounted once in the (app) providers, beside the wall.
 *
 * Any fetch site that receives a 401 announces it (`reportSession401` → SESSION_EXPIRED_EVENT)
 * and this explains it. The shape is a deliberate copy of `CreditWallListener`, so the two
 * refusals are one pattern rather than two.
 *
 * ⚠️ IT DOES NOT NAVIGATE, AND THAT IS THE ENTIRE POINT.
 *
 * `AuthGuard` (components/app/auth-guard.tsx:42) is the declared single owner of the /login
 * redirect; WR-04 (Sidebar.tsx:757) records that two competing router calls made the landing
 * route non-deterministic. Adding a `router.replace` here would rebuild that bug.
 *
 * It is also what rescues the draft. Composer state is local `useState` with no persistence, so
 * it survives exactly as long as nothing unmounts it — and only a route change unmounts it. The
 * dialog is therefore DISMISSIBLE: a modal the user cannot close puts their unsent text behind
 * glass, visible and uncopyable. Closing it hands them back their own work.
 *
 * The way out is an ordinary anchor, not a client-side `<Link>`. A full document load is the
 * right thing for a dead session: it re-runs the proxy's auth check on the server and discards
 * the React Query cache that was populated while the session was still alive. A soft navigation
 * would carry that stale cache into the signed-out world.
 *
 * No accent. Accent dosage is locked to the live-presence dot, the lit constellation node and the
 * brand mark; a refusal is none of those. The words carry the severity.
 */
export function SessionExpiredListener() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onExpired = () => setOpen(true);
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, []);

  if (!open) return null;

  return (
    <Dialog open onOpenChange={(next) => setOpen(next)}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>You&rsquo;ve been signed out.</DialogTitle>
          {/* ⚠️ It does NOT promise the composer still holds what you typed. An earlier draft of
              this line ended "anything you've typed is still here", which the browser walk showed
              to be false after a send: the composer clears optimistically ~150ms in, before any
              response lands, and the words move into the thread. They are still on screen, which
              is the guarantee not-navigating actually buys — so the sentence claims that and no
              more. */}
          <DialogDescription>
            Your session ended before that run started, so nothing was charged. Sign in again to
            pick up where you left off.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="primary" asChild>
            <a href="/login">Sign in again</a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
