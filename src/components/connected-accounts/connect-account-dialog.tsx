"use client";

/**
 * ConnectAccountDialog — the shared "connect an account" flow. One control reused by the
 * /audience "Your account" switcher ("+ Connect"), that tab's empty state, and /settings.
 *
 * A creator enters a public @handle → POST /api/connected-accounts/connect scrapes the
 * profile, creates the first-class connected account, and seeds its first analytics
 * snapshot. On success we show a compact "it's real" reveal (real handle + follower count)
 * and the wedge CTA — calibrate a testable audience from this account — deep-linking the
 * audience-creation flow with the account preselected. TikTok-only today.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { ConstellationMark } from "@/components/brand/constellation-mark";
import type { ConnectedAccount } from "@/lib/connected-accounts/connected-accounts-repo";
import { CheckCircle, ArrowRight } from "@phosphor-icons/react";

interface ConnectReveal {
  handle: string;
  displayName: string;
  followerCount: number;
  heartCount: number;
  videoCount: number;
}

type Phase = "idle" | "loading" | "done" | "error";

const nf = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

export function ConnectAccountDialog({
  open,
  onOpenChange,
  onConnected,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Fired after a successful connect (before the reveal). Callers can refresh their list. */
  onConnected?: (account: ConnectedAccount) => void;
}) {
  const router = useRouter();
  const [handle, setHandle] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [account, setAccount] = useState<ConnectedAccount | null>(null);
  const [reveal, setReveal] = useState<ConnectReveal | null>(null);

  function reset() {
    setHandle("");
    setPhase("idle");
    setErrorMsg("");
    setAccount(null);
    setReveal(null);
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  async function connect() {
    const clean = handle.replace(/^@/, "").trim();
    if (!clean) return;
    setPhase("loading");
    setErrorMsg("");
    try {
      const res = await fetch("/api/connected-accounts/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: "tiktok", handle: clean }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        account?: ConnectedAccount;
        reveal?: { profile?: ConnectReveal };
        error?: string;
      };
      if (!res.ok || !data.account) {
        setPhase("error");
        setErrorMsg(data.error ?? "We couldn't read that account. Check the handle and try again.");
        return;
      }
      setAccount(data.account);
      setReveal(data.reveal?.profile ?? null);
      setPhase("done");
      onConnected?.(data.account);
    } catch {
      setPhase("error");
      setErrorMsg("Couldn't connect. Check your connection and try again.");
    }
  }

  function goCalibrate() {
    if (!account) return;
    handleOpenChange(false);
    router.push(
      `/audience/new?source=account&accountId=${account.id}&platform=${account.platform}&handle=${encodeURIComponent(account.handle)}`,
    );
  }

  function finish() {
    handleOpenChange(false);
    // The switcher / settings list read server-side — refresh so the new account appears.
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent size="sm">
        {phase !== "done" ? (
          <>
            <DialogHeader>
              <DialogTitle>Connect an account</DialogTitle>
              <DialogDescription>
                Read a public TikTok @handle → your real numbers land in analytics, and it becomes
                a room you can test content against. We only read public data.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-4 flex flex-col gap-2">
              <label className="text-sm text-foreground-secondary" htmlFor="connect-handle">
                TikTok @handle
              </label>
              <Input
                id="connect-handle"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && phase !== "loading") void connect();
                }}
                placeholder="@yourhandle"
                disabled={phase === "loading"}
                autoFocus
              />
              {phase === "error" && (
                <p className="text-sm text-error" role="alert">
                  {errorMsg}
                </p>
              )}
            </div>

            <div className="mt-5 flex justify-end gap-3">
              <Button variant="secondary" onClick={() => handleOpenChange(false)} disabled={phase === "loading"}>
                Cancel
              </Button>
              <Button variant="primary" onClick={() => void connect()} disabled={phase === "loading" || !handle.trim()}>
                {phase === "loading" ? (
                  <>
                    <Spinner size="sm" className="mr-2" />
                    Reading @{handle.replace(/^@/, "").trim() || "…"}…
                  </>
                ) : (
                  "Connect"
                )}
              </Button>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <CheckCircle weight="fill" className="h-5 w-5 text-[color:var(--color-positive)]" />
                <DialogTitle>Connected</DialogTitle>
              </div>
              <DialogDescription>Your real numbers are in — tracked daily from here.</DialogDescription>
            </DialogHeader>

            <div className="mt-4 flex items-center gap-3 rounded-xl border border-border bg-surface-elevated px-4 py-3">
              <ConstellationMark width={44} className="shrink-0 opacity-80" />
              <div className="min-w-0">
                <p className="truncate text-[14px] font-semibold text-foreground">
                  @{reveal?.handle ?? account?.handle}
                </p>
                {reveal && (
                  <p className="font-mono text-[11px] text-foreground-muted">
                    {nf.format(reveal.followerCount)} followers · {nf.format(reveal.heartCount)} likes
                  </p>
                )}
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-2">
              <Button variant="primary" onClick={goCalibrate} className="w-full">
                Calibrate an audience from this account
                <ArrowRight weight="bold" className="ml-1.5 h-4 w-4" />
              </Button>
              <Button variant="secondary" onClick={finish} className="w-full">
                Done
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
