"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

import { CREDIT_WALL_EVENT } from "@/lib/billing/credit-wall";
import type { CreditQuotaExceeded } from "@/lib/billing/quota-error";
import { useSubscription } from "@/hooks/use-subscription";

// Split like the composer's mount (#268): the dialog chain reaches the Whop checkout embed
// (~330KB), which must not ride into every (app) page for a wall almost nobody hits.
const ReadingLimitDialog = dynamic(
  () => import("@/components/app/reading-limit-dialog").then((m) => m.ReadingLimitDialog),
  { ssr: false }
);

/**
 * The ONE listener behind every paid surface — mounted once in the (app) providers.
 *
 * Any fetch site that receives the credit 402 announces it (reportCredit402 →
 * CREDIT_WALL_EVENT) and this renders the paywall dialog with the server's copy. The
 * composer's /api/analyze stream keeps its own mount (it owns richer stream state);
 * everything else goes through here, so a new skill surface gets the wall for one line.
 */
export function CreditWallListener() {
  const [quota, setQuota] = useState<CreditQuotaExceeded | null>(null);
  const { usage } = useSubscription();

  useEffect(() => {
    const onWall = (e: Event) => {
      const detail = (e as CustomEvent<CreditQuotaExceeded>).detail;
      if (detail) setQuota(detail);
    };
    window.addEventListener(CREDIT_WALL_EVENT, onWall);
    return () => window.removeEventListener(CREDIT_WALL_EVENT, onWall);
  }, []);

  if (!quota) return null;

  return (
    <ReadingLimitDialog
      open
      quota={quota}
      renewsAt={usage?.renewsAt ?? null}
      onClose={() => setQuota(null)}
    />
  );
}
