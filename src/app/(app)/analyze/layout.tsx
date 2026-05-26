import { Suspense } from 'react';
import { Board } from '@/components/board/Board';

/**
 * Shared layout for /analyze and /analyze/[id].
 * Keeps the same <Board> instance mounted across the URL transition so Konva
 * Stage transform survives submit → /analyze/[id] (RESEARCH Pitfall 2).
 */
export default function AnalyzeLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <Board />
      {/* `children` from page.tsx or [id]/page.tsx renders OVER the board.
          In Phase 2 the page bodies become server-only data fetchers;
          actual UI lives inside <Board>'s DOM overlays. We keep `children`
          here only to satisfy Next.js — page.tsx will return null in Task 7. */}
      <div className="sr-only">{children}</div>
    </Suspense>
  );
}
