"use client";

/**
 * /audience/[id] — the workspace (SPEC-2026-07-13 §5).
 *
 * The old page led with a 250px decorative "Audience map" and four mismatched stat
 * tiles; the audience's real controls (the weight mix, the persona `repaint` sentences)
 * were unreachable. `AudienceWorkspace` replaces that surface — this page now only
 * fetches, handles the details form, and owns the back affordance.
 */

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import type { Audience } from "@/lib/audience/audience-types";
import { AudienceWorkspace } from "@/components/audience/audience-workspace";
import { AudienceForm } from "@/components/audience/audience-form";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "@phosphor-icons/react";

/** Matte surface shell — the radial top-glow was retired in the premium-elevation pass. */
function ProfileShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-full text-foreground">
      <div className="mx-auto w-full max-w-[1120px] px-4 pb-24 pt-6 sm:px-6">{children}</div>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-6">
      <div className="space-y-2 border-b border-white/[0.06] pb-5">
        <div className="h-6 w-48 rounded bg-white/[0.06]" />
        <div className="h-4 w-72 rounded bg-white/[0.04]" />
      </div>
      <div className="h-40 rounded-xl border border-white/[0.06] bg-white/[0.02]" />
      <div className="h-64 rounded-xl border border-white/[0.06] bg-white/[0.02]" />
    </div>
  );
}

export default function AudienceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = typeof params?.id === "string" ? params.id : "";
  const isEdit = searchParams?.get("edit") === "1";

  const [audience, setAudience] = useState<Audience | null>(null);
  const [defaultAudienceId, setDefaultAudienceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    async function load() {
      try {
        // The list route carries `lastAudienceId` (the user-level default that seeds new
        // threads) — the workspace shows whether THIS audience is it, and can claim it.
        const [detail, list] = await Promise.all([
          fetch(`/api/audiences/${id}`),
          fetch("/api/audiences"),
        ]);
        if (!detail.ok) {
          setError("Audience not found.");
          return;
        }
        const data = (await detail.json()) as { audience: Audience };
        setAudience(data.audience);
        if (list.ok) {
          const listData = (await list.json()) as { lastAudienceId: string | null };
          setDefaultAudienceId(listData.lastAudienceId ?? null);
        }
      } catch {
        setError("Couldn't load audience.");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [id]);

  const handleSetDefault = useCallback(async () => {
    if (!audience || audience.is_preset) return;
    const next = audience.is_general ? null : audience.id;
    const previous = defaultAudienceId;
    setDefaultAudienceId(next);
    try {
      const res = await fetch("/api/settings/last-audience", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audienceId: next }),
      });
      if (!res.ok) throw new Error("pin failed");
    } catch {
      setDefaultAudienceId(previous);
    }
  }, [audience, defaultAudienceId]);

  if (loading) {
    return (
      <ProfileShell>
        <DetailSkeleton />
      </ProfileShell>
    );
  }

  if (error || !audience) {
    return (
      <ProfileShell>
        <div className="space-y-6">
          <p className="text-sm text-error">{error ?? "Audience not found."}</p>
          <Button variant="secondary" onClick={() => router.push("/audience")}>
            Back to audiences
          </Button>
        </div>
      </ProfileShell>
    );
  }

  return (
    <ProfileShell>
      <div className="rv-in mb-5 flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.push("/audience")}
          aria-label="Back to audiences"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground-secondary transition-colors hover:bg-white/[0.06] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/10"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <p className="text-[13px] text-foreground-muted">Audiences</p>
      </div>

      <div className="rv-in" style={{ animationDelay: "0.06s" }}>
        {isEdit ? (
          <AudienceForm existing={audience} />
        ) : (
          <AudienceWorkspace
            audience={audience}
            defaultAudienceId={defaultAudienceId}
            onSetDefault={() => void handleSetDefault()}
            onEditDetails={() => router.push(`/audience/${id}?edit=1`)}
          />
        )}
      </div>
    </ProfileShell>
  );
}
