'use client';
import { Skeleton } from '@/components/ui/skeleton';
import { DataTable, KeyframeImage, type DataColumn } from '../_kit';
import type { CohortDropFrame, SegmentGroup, SlotKey } from './audience-derive';

export interface SegmentTableProps {
  groups: SegmentGroup[];
  /** Key of the single group rendered with coral "bad" treatment (or null). */
  badKey: SlotKey | null;
  /**
   * Per-cohort drop frame (real keyframe + timecode), keyed by slot. Only present
   * when a real video exists — empty/absent in text/url modes, where the rows
   * render exactly as before (no thumb column, no layout shift).
   */
  cohortFrames?: Partial<Record<SlotKey, CohortDropFrame>>;
  isLoading: boolean;
}

/**
 * "Who leaves" — the audience cohort drill-down, rendered through the shared
 * kit DataTable. Four slot groups (rows with 0 personas hidden); each row shows
 * the cohort, its watch-through %, and a plain-language drop characterization.
 * At most ONE row reads coral (the worst group below ~40%, via `badKey`).
 *
 * When real video frames are available (`cohortFrames`), each row gets a small
 * square keyframe thumb of where that cohort drops, with its drop timecode.
 */
export function SegmentTable({ groups, badKey, cohortFrames, isLoading }: SegmentTableProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-3" data-testid="segment-table">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[20px] w-full rounded-[4px]" />
        ))}
      </div>
    );
  }

  const visible = groups.filter((g) => g.count > 0);

  const columns: DataColumn<SegmentGroup>[] = [
    {
      key: 'label',
      label: 'Who leaves',
      align: 'left',
      render: (g) => {
        const bad = g.key === badKey;
        const frame = cohortFrames?.[g.key];
        return (
          <div className="flex min-w-0 items-center gap-2.5">
            {frame && (
              <KeyframeImage
                src={frame.url}
                ratio="square"
                alt={`${g.label} drop at ${frame.timecode}`}
                timecode={frame.timecode}
                marked={bad}
                energy={bad ? 0.8 : 0.5}
                className="w-9 shrink-0"
              />
            )}
            <div className="min-w-0">
              <div className={bad ? 'truncate text-foreground-secondary' : 'truncate text-foreground'}>
                {g.label}
              </div>
              <div className="truncate text-[11px] text-foreground-muted">{g.desc}</div>
            </div>
          </div>
        );
      },
    },
    {
      key: 'pct',
      label: 'Watch-through',
      align: 'right',
      render: (g) => {
        const bad = g.key === badKey;
        return (
          <span className={bad ? 'tabular-nums text-foreground-secondary' : 'tabular-nums text-foreground'}>
            {Math.round(g.pct)}%
          </span>
        );
      },
    },
  ];

  return (
    <div data-testid="segment-table">
      <DataTable columns={columns} rows={visible} rowKey={(g) => g.key} />
    </div>
  );
}
