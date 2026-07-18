/**
 * /audience/[id] — the audience detail page (rebuild P2, sketch §3).
 *
 * Server component: assembles everything the page states as fact — the audience,
 * the connected account behind it, the SOURCE proof-of-scrape data (posts,
 * figures, pillars), the pinned-thread count, and the user-level default — and
 * hands it to the client `AudienceDetail`.
 *
 * The id can also be a CONNECTED ACCOUNT id (the list's analytics-only rows and
 * the retired ?tab=account deep-links land here). An account that manifests as an
 * audience redirects to the canonical audience URL; one without an audience
 * renders the account variant (SOURCE + Sync/Danger, no room).
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { createClient } from "@/lib/supabase/server";
import type { Audience } from "@/lib/audience/audience-types";
import { getAudience, listAudiences } from "@/lib/audience/audience-repo";
import { resolveUserAudience } from "@/lib/audience/resolve-user-audience";
import {
  listConnectedAccounts,
  type ConnectedAccount,
} from "@/lib/connected-accounts/connected-accounts-repo";
import { getAccountSnapshots } from "@/lib/account-metrics/account-metrics-repo";
import { listAllPosts } from "@/lib/account-metrics/account-posts-repo";
import { buildRangeMetrics } from "@/lib/account-metrics/account-metrics";
import { buildContentPillars } from "@/lib/content-pillars/build-pillars";
import {
  accountForAudience,
  audienceForAccount,
} from "@/components/audience/audience-display";
import {
  AudienceDetail,
  type AccountView,
  type SourceData,
} from "@/components/audience/audience-detail";
import { AudienceForm } from "@/components/audience/audience-form";

export const metadata = {
  title: "Audience | Maven",
};

function toView(a: ConnectedAccount): AccountView {
  return {
    id: a.id,
    handle: a.handle,
    platform: a.platform,
    is_primary: a.is_primary,
    last_synced_at: a.last_synced_at,
  };
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-full text-foreground">
      <div className="mx-auto w-full max-w-[1120px] px-4 pb-24 pt-6 sm:px-6">
        <div className="rv-in mb-6 flex items-center gap-3">
          <Link
            href="/audience"
            aria-label="Back to audiences"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground-secondary transition-colors hover:bg-white/[0.06] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/10"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <p className="text-[13px] text-foreground-muted">Audiences</p>
        </div>
        <div className="rv-in" style={{ animationDelay: "0.06s" }}>
          {children}
        </div>
      </div>
    </div>
  );
}

export default async function AudienceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const { id } = await params;
  const { edit } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let audience: Audience | null = null;
  let account: AccountView | null = null;

  if (user) {
    try {
      audience = await getAudience(supabase, id);
    } catch {
      audience = null;
    }

    // redirect() throws NEXT_REDIRECT — keep it OUTSIDE the try so the catch
    // can't swallow the navigation.
    let canonicalId: string | null = null;
    try {
      const accounts = (await listConnectedAccounts(supabase, user.id)).map(toView);
      if (audience && !audience.is_general && !audience.is_preset) {
        const audiences = await listAudiences(supabase);
        account = accountForAudience(audience, accounts, audiences) ?? null;
      } else if (!audience) {
        const byId = accounts.find((a) => a.id === id) ?? null;
        if (byId) {
          const audiences = await listAudiences(supabase);
          // Canonical URL is the audience's — account deep-links land there.
          canonicalId = audienceForAccount(byId, audiences)?.id ?? null;
          account = byId;
        }
      }
    } catch {
      account = null;
    }
    if (canonicalId) redirect(`/audience/${canonicalId}`);
  }

  if (!audience && !account) {
    return (
      <Shell>
        <p className="text-sm text-error">Audience not found.</p>
      </Shell>
    );
  }

  // ── Edit details (?edit=1) — the form owns name/goal/notes ────────────────
  if (edit === "1" && audience && !audience.is_general && !audience.is_preset) {
    return (
      <Shell>
        <AudienceForm existing={audience} />
      </Shell>
    );
  }

  // ── The user-level default that seeds new threads ─────────────────────────
  let defaultAudienceId: string | null = null;
  if (user) {
    try {
      const lastUsed = await resolveUserAudience(supabase, user.id);
      defaultAudienceId = lastUsed.is_general ? null : lastUsed.id;
    } catch {
      defaultAudienceId = null;
    }
  }

  // ── Pinned threads (facts for the Usage card) ─────────────────────────────
  let pinnedThreads = 0;
  if (user && audience && !audience.is_general && !audience.is_preset) {
    const { count } = await supabase
      .from("threads")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("active_audience_id", audience.id);
    pinnedThreads = count ?? 0;
  }

  // ── SOURCE zone — only what we actually hold for the account ──────────────
  let source: SourceData | null = null;
  if (user && account) {
    try {
      const [snapshots, posts, pillars] = await Promise.all([
        getAccountSnapshots(supabase, account.id, 100),
        listAllPosts(supabase, account.id, 12),
        buildContentPillars(supabase, user.id, account.id),
      ]);
      const metrics = buildRangeMetrics(snapshots, 90, account.platform);
      source = {
        figures: (metrics ?? [])
          .filter((m) => m.value !== "—")
          .map((m) => ({ label: m.label, value: m.value })),
        posts: posts.map((p) => ({ id: p.post_id, caption: p.caption, views: p.views })),
        pillars: pillars.map((p) => ({ name: p.name, share: p.share })),
      };
    } catch {
      source = null;
    }
  }

  return (
    <Shell>
      <AudienceDetail
        audience={audience}
        account={account}
        defaultAudienceId={defaultAudienceId}
        pinnedThreads={pinnedThreads}
        source={source}
      />
    </Shell>
  );
}
