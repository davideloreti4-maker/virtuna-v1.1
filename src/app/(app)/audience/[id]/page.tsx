"use client";

/**
 * /audience/[id] — Audience profile view (read-only, D-03) with edit affordance header.
 * Fetches the audience by id and renders either the form (edit mode via ?edit=1)
 * or the read-only AudienceProfileView.
 *
 * Renders inside (app)/layout.tsx → AppShell. In-shell content <div> (no nested <main>).
 */

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import type { Audience } from "@/lib/audience/audience-types";
import { AudienceProfileView } from "@/components/audience/audience-profile-view";
import { AudienceForm } from "@/components/audience/audience-form";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { ArrowLeft } from "@phosphor-icons/react";

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
        const data = await res.json() as { audience: Audience };
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
      <div className="max-w-2xl mx-auto px-4 py-6 sm:p-6 flex justify-center">
        <Spinner size="md" />
      </div>
    );
  }

  if (error || !audience) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6 sm:p-6 space-y-6">
        <p className="text-sm text-error">{error ?? "Audience not found."}</p>
        <Button variant="secondary" onClick={() => router.push("/audience")}>
          Back to audiences
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 sm:p-6">
      {/* Header */}
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
          <h1 className="text-2xl font-medium text-foreground truncate">{audience.name}</h1>
          <p className="text-sm text-foreground-secondary">
            {audience.platform.charAt(0).toUpperCase() + audience.platform.slice(1)} ·{" "}
            {audience.type === "personal" ? "Personal" : "Target"}
          </p>
        </div>
        {/* Edit only for user-owned audiences (D-03 — no edit on general/preset) */}
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
