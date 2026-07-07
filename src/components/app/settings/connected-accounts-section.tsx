"use client";

/**
 * ConnectedAccountsSection — the /settings "Connected accounts" tab. Lists the creator's
 * first-class connected accounts (platform + handle), and lets them connect a new one,
 * pick which is primary (the default analytics view + what /start reads), and disconnect.
 *
 * Disconnecting cascades the account's analytics history but leaves any audiences calibrated
 * from it intact (source_account_id → NULL) — the copy says so. TikTok-only connect today.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { ConnectAccountDialog } from "@/components/connected-accounts/connect-account-dialog";
import type { ConnectedAccount } from "@/lib/connected-accounts/connected-accounts-repo";
import { Plus, Star } from "@phosphor-icons/react";

const PLATFORM_LABEL: Record<ConnectedAccount["platform"], string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  youtube: "YouTube",
};

function syncedLabel(iso: string | null): string {
  if (!iso) return "not synced yet";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "synced today";
  if (days === 1) return "synced yesterday";
  return `synced ${days} days ago`;
}

export function ConnectedAccountsSection({ accounts }: { accounts: ConnectedAccount[] }) {
  const router = useRouter();
  const [connectOpen, setConnectOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ConnectedAccount | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function makePrimary(id: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/connected-accounts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_primary: true }),
      });
      if (res.ok) router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function disconnect() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/connected-accounts/${deleteTarget.id}`, { method: "DELETE" });
      if (res.ok || res.status === 204) {
        setDeleteTarget(null);
        router.refresh();
      }
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-medium text-foreground">Connected accounts</h2>
          <p className="mt-1 text-sm text-foreground-secondary">
            The social accounts you own. Each one gives you real analytics and a room you can test
            content against. We only read public data.
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setConnectOpen(true)} className="shrink-0">
          <Plus weight="bold" className="mr-1.5 h-4 w-4" />
          Connect
        </Button>
      </div>

      {accounts.length === 0 ? (
        <div
          className="rounded-lg border border-white/[0.06] p-6 text-center"
          style={{
            backgroundColor: "var(--color-charcoal-composer)",
            boxShadow: "rgba(255,255,255,0.05) 0 1px 0 0 inset",
          }}
        >
          <p className="text-sm text-foreground-secondary">
            No accounts connected yet. Connect a TikTok account to see your real numbers and
            calibrate an audience from it.
          </p>
          <Button variant="secondary" size="sm" onClick={() => setConnectOpen(true)} className="mt-4">
            <Plus weight="bold" className="mr-1.5 h-4 w-4" />
            Connect a TikTok account
          </Button>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {accounts.map((a) => (
            <li
              key={a.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.06] p-4"
              style={{
                backgroundColor: "var(--color-charcoal-composer)",
                boxShadow: "rgba(255,255,255,0.05) 0 1px 0 0 inset",
              }}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium text-foreground">@{a.handle}</p>
                  {a.is_primary && (
                    <span className="inline-flex items-center gap-1 rounded border border-border-hover px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.06em] text-foreground-secondary">
                      <Star weight="fill" className="h-2.5 w-2.5" />
                      Primary
                    </span>
                  )}
                </div>
                <p className="mt-0.5 font-mono text-[11px] text-foreground-muted">
                  {PLATFORM_LABEL[a.platform]} · {syncedLabel(a.last_synced_at)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {!a.is_primary && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => void makePrimary(a.id)}
                    disabled={busyId === a.id}
                  >
                    {busyId === a.id ? <Spinner size="sm" /> : "Make primary"}
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(a)}>
                  Disconnect
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConnectAccountDialog open={connectOpen} onOpenChange={setConnectOpen} />

      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Disconnect account</DialogTitle>
            <DialogDescription>
              {`Disconnect @${deleteTarget?.handle}? This removes its analytics history. Audiences you calibrated from it stay — they just keep their frozen personas, unlinked. This can't be undone.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary" disabled={deleting}>Keep account</Button>
            </DialogClose>
            <Button variant="destructive" disabled={deleting} onClick={() => void disconnect()}>
              {deleting ? <Spinner size="sm" /> : "Disconnect"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
