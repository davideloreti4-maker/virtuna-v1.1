import { Suspense } from 'react';
import { Reading } from '@/components/reading';

/**
 * Shared layout for /analyze and /analyze/[id].
 *
 * LANDMINE 0 (02-05) — the mount is INVERTED. This layout used to render the
 * Konva canvas; the Reading thread now replaces it. The same persistence
 * rationale holds: a single <Reading> instance stays mounted across the
 * submit → /analyze/[id] URL transition, so the Reading reads the id from
 * `useParams()` (via usePermalinkAnalysis) and renders the same thread the
 * composer just streamed — no remount flash.
 *
 * The Konva canvas (camera / pan-zoom / 8-frame stage) is retired here, but the
 * legacy visual components live on as Phase-3 drill-down sources (NOT deleted),
 * and the /analyze route files stay reachable (dormant, not removed) per the
 * milestone constraint.
 *
 * With no route id (/analyze), the Reading is inert — it renders nothing and the
 * Phase-1 AppShell composer-centered shell (from (app)/layout.tsx) owns the
 * screen. With an id, the Reading composes its vertical thread inside the
 * AppShell 760px column.
 */
export default function AnalyzeLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <Reading />
      {/* `children` from page.tsx / [id]/page.tsx are metadata-only server shells
          (both return null). Kept here only to satisfy Next.js's layout/page
          contract; all UI lives in <Reading>. */}
      <div className="sr-only">{children}</div>
    </Suspense>
  );
}
