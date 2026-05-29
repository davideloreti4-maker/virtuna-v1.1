'use client';
import { useEffect, useRef } from 'react';
import { FilmScript } from '@phosphor-icons/react';
import { PlaceholderCard } from './PlaceholderCard';
import { useScript } from './script/use-script';
import { ScriptBody } from './script/ScriptBody';
import { ScriptEmptyState } from './script/ScriptEmptyState';
import { SCRIPT_COPY } from './script/script-constants';
import { TELEMETRY } from './actions-constants';
import { logger } from '@/lib/logger';

interface Props {
  className?: string;
  style?: React.CSSProperties;
  analysisId: string | null;
  phase: string;
  /** True once the analysis row is available (data-presence gate, not stream phase). */
  ready: boolean;
  isAV: boolean;
}

export function ActionsReshootHeroSlot({ className, style, analysisId, phase, ready, isAV }: Props) {
  // Show the placeholder until the row is loaded AND we have an id to fetch the
  // script with. Gating on `ready` (data presence) instead of stream phase fixes
  // the case where a sibling node holds the result but its phase lags at 'idle'.
  if (!ready || !analysisId) {
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

  // Full reshoot script — rendered INLINE in every state (no drawer). AV uses the
  // "Try this instead / what dropped" framing; the normal complete state uses a
  // neutral "Reshoot script" header. Both share the same inline ScriptBody.
  return (
    <InlineScriptCard
      script={data}
      analysisId={analysisId}
      headline={isAV ? SCRIPT_COPY.AV_HEADLINE : SCRIPT_COPY.TEASER_LABEL}
      subhead={isAV ? SCRIPT_COPY.AV_SUBHEAD : SCRIPT_COPY.INLINE_SUBHEAD}
      isAV={isAV}
    />
  );
}

function InlineScriptCard({
  script,
  analysisId,
  headline,
  subhead,
  isAV,
}: {
  script: Extract<ReturnType<typeof useScript>['data'], { is_empty_state: false }>;
  analysisId: string;
  headline: string;
  subhead: string;
  isAV: boolean;
}) {
  // Telemetry: fire once when the script first becomes visible inline (replaces
  // the old drawer-open event — there is no open action anymore).
  const firedRef = useRef(false);
  useEffect(() => {
    if (!firedRef.current) {
      firedRef.current = true;
      logger.info(TELEMETRY.SCRIPT_INLINE_VISIBLE, { analysis_id: analysisId, is_av: isAV });
    }
  }, [analysisId, isAV]);

  return (
    <div
      className="flex h-full w-full flex-col overflow-hidden rounded-[8px] border border-white/[0.06]"
      data-testid="actions-reshoot-script-card"
    >
      <div className="px-4 pt-2 pb-1">
        <div className="text-xs font-medium text-white/85">{headline}</div>
        <div className="text-[10px] text-white/55">{subhead}</div>
      </div>
      <div className="flex-1 min-h-0">
        <ScriptBody script={script} analysisId={analysisId} />
      </div>
    </div>
  );
}
