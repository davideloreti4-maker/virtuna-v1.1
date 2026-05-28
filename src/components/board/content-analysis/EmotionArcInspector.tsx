'use client';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/useIsMobile';
import { cn } from '@/lib/utils';

interface EmotionArcPoint {
  timestamp_ms: number;
  intensity_0_1: number;
  label?: 'low' | 'mid' | 'high';
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  points: ReadonlyArray<EmotionArcPoint> | null | undefined;
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function EmotionArcInspector({ open, onOpenChange, points }: Props) {
  const isMobile = useIsMobile();
  const side = isMobile ? 'bottom' : 'right';

  const peaksAndValleys = (points ?? []).filter(
    (p) => p.label === 'high' || p.label === 'low',
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={side}
        className={cn(
          'border-white/[0.06] bg-[#18191a]',
          side === 'right' && 'max-w-[360px]',
          side === 'bottom' && 'max-h-[85dvh]',
        )}
        data-testid="emotion-arc-inspector"
      >
        <SheetHeader>
          <SheetTitle className="text-sm font-semibold">Emotion arc</SheetTitle>
        </SheetHeader>

        <div className="mt-3 flex flex-col gap-3 text-xs">
          {!points || points.length === 0 ? (
            <p className="text-xs italic text-foreground-muted">Emotion arc unavailable.</p>
          ) : (
            <section>
              <h3
                className="text-[10px] font-semibold uppercase tracking-wide mb-1"
                style={{ color: 'rgba(249,249,249,0.4)' }}
              >
                Peaks &amp; valleys
              </h3>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[10px] uppercase text-foreground-muted">
                    <th className="text-left">Time</th>
                    <th className="text-left">Intensity</th>
                    <th className="text-left">Label</th>
                  </tr>
                </thead>
                <tbody>
                  {peaksAndValleys.map((p, i) => (
                    <tr key={`${p.timestamp_ms}-${i}`}>
                      <td className="tabular-nums">{formatTime(p.timestamp_ms)}</td>
                      <td className="tabular-nums">{Math.round(p.intensity_0_1 * 100)}%</td>
                      <td className={cn(p.label === 'high' && 'text-accent')}>
                        {p.label}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
