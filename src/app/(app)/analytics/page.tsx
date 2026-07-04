import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getAccountSnapshots } from "@/lib/account-metrics/account-metrics-repo";
import type { AccountSnapshot } from "@/lib/account-metrics/account-metrics";
import { getMockCalendar } from "@/lib/room-contract/mock-room";
import { AnalyticsView } from "@/components/analytics/analytics-view";

export const metadata: Metadata = {
  title: "Analytics | Maven",
  description: "Your account over 7 / 30 / 90 days — real numbers, and what to do next.",
};

/**
 * /analytics — the account analytics page (Stanley analytics parity). Auth-gated, inside
 * (app) so it inherits AppShell + ToastProvider. Metrics are REAL (the same
 * account_snapshots time-series behind the /start stat-row, read over 7/30/90d windows);
 * no snapshots → an honest connect state, never fabricated analytics. Recommendations are
 * Directional/real-tagged advisory grounded in the creator's pillars (mock v1 room data).
 */
export default async function AnalyticsRoute() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  let snapshots: AccountSnapshot[] = [];
  try {
    snapshots = await getAccountSnapshots(supabase, user.id, 100);
  } catch {
    snapshots = [];
  }

  const pillars = getMockCalendar().pillars;

  return <AnalyticsView snapshots={snapshots} pillars={pillars} />;
}
