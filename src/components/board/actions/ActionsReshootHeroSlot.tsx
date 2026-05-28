'use client';
import { FilmScript } from '@phosphor-icons/react';
import { PlaceholderCard } from './PlaceholderCard';
import { useScript } from './script/use-script';
import { ScriptBody } from './script/ScriptBody';
import { ScriptInspectorTrigger } from './script/ScriptInspectorTrigger';
import { ScriptEmptyState } from './script/ScriptEmptyState';
import { SCRIPT_COPY } from './script/script-constants';

interface Props {
  className?: string;
  style?: React.CSSProperties;
  analysisId: string | null;
  phase: string;
  isAV: boolean;
}

export function ActionsReshootHeroSlot({ className, style, analysisId, phase, isAV }: Props) {
  // Pre-complete phase: keep Phase 5 placeholder (per D-18 — engine emits counterfactuals only at terminal).
  if (phase !== 'complete' || !analysisId) {
    return (
      <div className={className} style={style} data-testid="actions-reshoot-hero-slot">
        <PlaceholderCard
          label={SCRIPT_COPY.TEASER_LABEL}
          phase="6"
          icon={FilmScript}
          data-testid="actions-reshoot-placeholder"
        />
      </div>
    );
  }

  return (
    <div className={className} style={style} data-testid="actions-reshoot-hero-slot">
      <ReshootBody analysisId={analysisId} phase={phase} isAV={isAV} />
    </div>
  );
}

function ReshootBody({ analysisId, phase, isAV }: { analysisId: string; phase: string; isAV: boolean }) {
  const { data, isLoading, isError, refetch } = useScript(analysisId, phase);

  if (isLoading) {
    return (
      <PlaceholderCard
        label={SCRIPT_COPY.TEASER_LABEL}
        phase="6"
        icon={FilmScript}
        data-testid="actions-reshoot-placeholder"
      />
    );
  }
  if (isError) {
    return <ScriptEmptyState variant="error" analysisId={analysisId} onRetry={() => refetch()} />;
  }
  if (!data) return null;

  // D-22: empty state wins over AV (defensive — AV+empty theoretically impossible per business logic)
  if (data.is_empty_state) {
    return (
      <ScriptEmptyState
        variant="empty-state"
        analysisId={analysisId}
        openingVariants={data.opening_variants}
      />
    );
  }

  if (isAV) {
    return (
      <div className="flex h-full w-full flex-col" data-testid="actions-reshoot-av-chrome">
        <div className="px-4 pt-2 pb-1">
          <div className="text-xs font-medium text-white/85">{SCRIPT_COPY.AV_HEADLINE}</div>
          <div className="text-[10px] text-white/55">{SCRIPT_COPY.AV_SUBHEAD}</div>
        </div>
        <div className="flex-1 min-h-0">
          <ScriptBody script={data} analysisId={analysisId} />
        </div>
      </div>
    );
  }

  return <ScriptInspectorTrigger script={data} analysisId={analysisId} />;
}
