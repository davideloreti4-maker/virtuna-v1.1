"use client";

/**
 * /audience/[id] — Audience profile view with edit affordance header.
 */

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import type { Audience } from "@/lib/audience/audience-types";
import { AudienceProfileView } from "@/components/audience/audience-profile-view";
import { AudienceForm } from "@/components/audience/audience-form";
import { AudienceStatusChip } from "@/components/audience/audience-status-chip";
import {
  getCalibrationStatus,
  getPlatformLabel,
  getTypeLabel,
} from "@/components/audience/audience-display";
import { ConstellationMark } from "@/components/brand/constellation-mark";
import { READING_CARD } from "@/components/reading/reading-section";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ArrowLeft } from "@phosphor-icons/react";

function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-white/[0.04] animate-pulse" />
        <div className="flex-1 space-y-2">
          <div className="h-6 w-48 rounded bg-white/[0.06] animate-pulse" />
          <div className="h-4 w-32 rounded bg-white/[0.04] animate-pulse" />
        </div>
      </div>
      <div className={cn(READING_CARD, "flex items-center justify-center py-16 animate-pulse")}>
        <ConstellationMark width={64} litNodeIndex={-1} className="opacity-40" />
      </div>
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    async function load() {
      try {
        const res = await fetch(`/api/audiences/${id}`);
        if (!res.ok) {
          setError("Audience not found.");
          return;
        }
        const data = (await res.json()) as { audience: Audience };
        setAudience(data.audience);
      } catch {
        setError("Couldn't load audience.");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6 sm:p-6">
        <DetailSkeleton />
      </div>
    );
  }

  if (error || !audience) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6 sm:p-6 space-y-6">
        <p className="text-sm text-error">{error ?? "Audience not found."}</p>
        <Button variant="secondary" onClick={() => router.push("/audience")}>
          Back to audiences
        </Button>
      </div>
    );
  }

  const status = getCalibrationStatus(audience);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 sm:p-6">
      <div className="flex items-center gap-3 mb-6">
        <button
          type="button"
          onClick={() => router.push("/audience")}
          aria-label="Back to audiences"
          className="flex items-center justify-center w-8 h-8 rounded-lg text-foreground-secondary hover:bg-white/[0.06] hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/10"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-[19px] font-semibold tracking-[-0.01em] text-foreground lg:text-[22px] truncate">{audience.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <p className="text-sm text-foreground-secondary">
              {getPlatformLabel(audience)} · {getTypeLabel(audience)}
            </p>
            <AudienceStatusChip status={status} />
          </div>
        </div>
        {!audience.is_general && !audience.is_preset && !isEdit && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => router.push(`/audience/${id}?edit=1`)}
          >
            Edit
          </Button>
        )}
      </div>

      {isEdit ? (
        <AudienceForm existing={audience} />
      ) : (
        <AudienceProfileView audience={audience} />
      )}
    </div>
  );
}
