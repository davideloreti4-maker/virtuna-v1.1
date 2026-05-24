import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { ResultCard } from "./result-card";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `Analysis ${id} | Virtuna`,
    description: "View your TikTok content analysis results from Virtuna's prediction engine.",
  };
}

/**
 * /analyze/[id] — server component result page.
 *
 * Fetches the analysis_results row by id + user_id (IDOR defense via
 * explicit .eq("user_id", user.id) filter, mirroring Plan 03 stream endpoint).
 *
 * Row may be null on fresh navigation (placeholder INSERT race per Pitfall #6 Option A).
 * Passes null so ResultCard opens the stream instead of short-circuiting.
 *
 * Auth gating: layout.tsx redirects unauthenticated users; defensive null
 * return here in case server component renders before redirect completes.
 *
 * T-01-RC-IDOR: .eq("user_id", user.id) enforces ownership — wrong-owner ids
 * return null → ResultCard opens stream → stream GET returns 404 → error state.
 */
export default async function AnalyzeResultPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Defensive fallback — layout.tsx middleware already redirects unauthenticated
  if (!user) return null;

  // Fetch the analysis row scoped by user_id (IDOR mitigation — T-01-RC-IDOR)
  const { data: row } = await supabase
    .from("analysis_results")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .single();

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Analysis</h1>
        <p className="font-mono text-xs text-muted-foreground">{id}</p>
      </div>

      {/* ResultCard is a client component — receives initialData for SSR fast path.
          When row is null (fresh analysis or wrong-owner), stream opens in client. */}
      <ResultCard analysisId={id} initialData={row ?? null} />
    </div>
  );
}
