import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { PageShell } from "@/components/surfaces/surface-header";
import { ProjectDetail } from "@/components/saved/project-detail";

export const metadata: Metadata = {
  title: "Project | Maven",
  description: "A Library project — the hooks, scripts and Reads you filed together.",
};

/**
 * /library/[projectId] — inside one Library project (lane/library-rework).
 *
 * Mirrors /library exactly: inside the (app) route group so it inherits AppShell + auth +
 * sidebar, auth-gated as defense-in-depth alongside the layout guard, and rendering into the
 * canonical 880px PageShell column so its header's left edge lines up with /library, /audience
 * and /settings. AppShell owns the <main> — this page renders a plain content <div> and must NOT
 * nest a second one (STATE 07-05).
 *
 * The project is resolved CLIENT-side from the projects list the shelf already fetches, rather
 * than server-fetched here: the same list drives the picker and the shelf's project rows, so one
 * fetch serves all three and a rename cannot leave this page showing a stale name.
 */
export default async function LibraryProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { projectId } = await params;

  return (
    <div className="relative min-h-full text-foreground">
      <PageShell>
        <ProjectDetail projectId={projectId} />
      </PageShell>
    </div>
  );
}
