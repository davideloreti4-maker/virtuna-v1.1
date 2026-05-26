'use client';
import { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ContentForm, type ContentFormData } from '@/components/app/content-form';
import { useBoardStore } from '@/stores/board-store';
import { useSidebarRecent } from '@/components/sidebar/use-sidebar-queries';
import { useAnalysisStream } from '@/hooks/queries/use-analysis-stream';

function useIsDesktop(): boolean {
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    setDesktop(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setDesktop(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return desktop;
}

export function InputDrawer() {
  const boardState = useBoardStore((s) => s.boardState);
  const openInputDrawer = useBoardStore((s) => s.openInputDrawer);
  const closeInputDrawer = useBoardStore((s) => s.closeInputDrawer);
  const isDesktop = useIsDesktop();
  const recent = useSidebarRecent();
  const stream = useAnalysisStream();

  const open = boardState === 'edit-input';
  const recentItems = (recent.data?.pages?.[0] ?? []).slice(0, 3);

  // Local prefill caption for Recent picker — ContentForm does not accept initialValues.
  // When user taps a Recent entry, we update this; ContentForm re-mounts via key.
  const [prefillCaption, setPrefillCaption] = useState<string>('');
  const [prefillKey, setPrefillKey] = useState(0);

  const handleSubmit = (data: ContentFormData) => {
    // Close drawer immediately; board state transitions via stream.phase → board-state
    // wiring in Board.tsx (plan 2.6).
    closeInputDrawer();
    stream.start({
      input_mode: data.input_mode,
      content_type: data.input_mode === 'tiktok_url' ? 'tiktok_url' : 'text',
      ...(data.input_mode === 'text' && { content_text: data.caption }),
      ...(data.input_mode === 'tiktok_url' && { tiktok_url: data.tiktok_url }),
      ...(data.input_mode === 'video_upload' && { content_text: data.video_caption }),
      ...(data.niche && { niche: data.niche }),
    }).catch(() => { /* error surfaced via stream.phase → board-state error transition */ });
  };

  const handleRecentPick = (title: string | null) => {
    // Prefill caption only. Full file re-hydration deferred to Workspace milestone.
    setPrefillCaption(title ?? '');
    // Re-mount ContentForm to pick up the prefill (force key change)
    setPrefillKey((k) => k + 1);
  };

  // Reset prefill when drawer closes
  useEffect(() => {
    if (!open) {
      setPrefillCaption('');
      setPrefillKey((k) => k + 1);
    }
  }, [open]);

  // Suppress unused var warning — openInputDrawer reserved for future
  // "re-open after submit" pattern (plan 2.13 extension).
  void openInputDrawer;

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) closeInputDrawer(); }}>
      <SheetContent
        side={isDesktop ? 'left' : 'bottom'}
        className="w-full max-w-[420px] p-4"
      >
        <SheetHeader>
          <SheetTitle>Edit input</SheetTitle>
        </SheetHeader>

        {/* Recent inputs picker (D-16) — top 3 only */}
        <section className="mt-4">
          <h3 className="mb-2 text-sm font-semibold text-foreground">
            Recent inputs
          </h3>
          {recentItems.length === 0 ? (
            <p className="text-sm text-foreground-muted">No recent inputs yet</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {recentItems.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => handleRecentPick(r.title)}
                    className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-white/[0.02]"
                  >
                    {r.title ?? 'Untitled'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ContentForm — key forces re-mount when prefill changes */}
        <section className="mt-4">
          <ContentForm
            key={`${prefillKey}-${prefillCaption}`}
            onSubmit={handleSubmit}
          />
        </section>
      </SheetContent>
    </Sheet>
  );
}
