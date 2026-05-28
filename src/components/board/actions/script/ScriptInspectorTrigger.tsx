'use client';
import { useRef, useState } from 'react';
import { FilmScript } from '@phosphor-icons/react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { logger } from '@/lib/logger';
import { TELEMETRY } from '../actions-constants';
import { SCRIPT_COPY } from './script-constants';
import { ScriptBody } from './ScriptBody';
import type { ScriptResult } from './script-types';
import { useIsMobile } from '@/hooks/useIsMobile';
import { cn } from '@/lib/utils';

interface Props {
  script: ScriptResult;
  analysisId: string;
}

export function ScriptInspectorTrigger({ script, analysisId }: Props) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const isMobile = useIsMobile();
  const side = isMobile ? 'bottom' : 'right';

  // Defensive: if empty state slipped through, render nothing — host should render ScriptEmptyState
  if (script.is_empty_state) return null;
  const preview = script.script.opening_line;

  function handleOpen() {
    setOpen(true);
    logger.info(TELEMETRY.SCRIPT_INSPECTOR_OPENED, {
      analysis_id: analysisId,
      trigger: 'compact_teaser_tap',
    });
  }

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        onClick={handleOpen}
        className="flex h-full w-full flex-col gap-1 p-2 text-left bg-transparent border border-white/[0.06] hover:bg-white/[0.02] rounded-xl focus:outline-2 focus:outline-offset-2 focus:outline-white/40"
        data-testid="actions-reshoot-teaser"
      >
        <div className="flex items-center gap-1">
          <FilmScript size={12} weight="regular" aria-hidden />
          <span className="text-xs font-medium text-white/85">{SCRIPT_COPY.TEASER_LABEL}</span>
        </div>
        <p className="text-xs text-white/55 line-clamp-2 flex-1">{preview}</p>
        <span className="text-[10px] text-white/55 self-end">{SCRIPT_COPY.TEASER_AFFORDANCE}</span>
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side={side}
          className={cn(
            'border-white/[0.06] bg-[#18191a]',
            side === 'right' && 'max-w-[400px]',
            side === 'bottom' && 'max-h-[85dvh]',
          )}
          onCloseAutoFocus={(e) => {
            if (triggerRef.current) {
              e.preventDefault();
              triggerRef.current.focus();
            }
          }}
        >
          <SheetHeader>
            <SheetTitle>{SCRIPT_COPY.TEASER_LABEL}</SheetTitle>
          </SheetHeader>
          <ScriptBody script={script} analysisId={analysisId} />
        </SheetContent>
      </Sheet>
    </>
  );
}
