'use client';
import { useRef, useEffect } from 'react';
import { GlassPill } from '@/components/primitives';
import { logger } from '@/lib/logger';
import { TELEMETRY } from '../actions-constants';
import { SCRIPT_COPY } from './script-constants';
import { CopyButton } from './CopyButton';
import type { ScriptResult, ScriptResultBody } from './script-types';

interface Props {
  script: ScriptResult;
  analysisId: string;
}

type SectionKey = 'opening' | 'scenes' | 'voiceover' | 'captions';

function assembleCopyAll(
  analysisId: string,
  body: ScriptResultBody,
): string {
  const lines: string[] = [];
  lines.push(`REWRITE SCRIPT (analysis ${analysisId})`);
  lines.push('');
  lines.push(SCRIPT_COPY.MD_HEADER_OPENING);
  lines.push(body.opening_line);
  lines.push('');
  lines.push(SCRIPT_COPY.MD_HEADER_SCENES);
  for (const scene of body.scene_order) lines.push(`- ${scene}`);
  lines.push('');
  lines.push(SCRIPT_COPY.MD_HEADER_VOICEOVER);
  lines.push(body.voiceover);
  lines.push('');
  lines.push(SCRIPT_COPY.MD_HEADER_CAPTIONS);
  for (const caption of body.captions) lines.push(`- ${caption}`);
  return lines.join('\n');
}

export function ScriptBody({ script, analysisId }: Props) {
  // D-15: defensive guard. Host should branch to ScriptEmptyState instead.
  if (script.is_empty_state) return null;
  const body = script.script;

  // aria-live announcement once per mount — sr-only span handles this
  const announceRef = useRef(false);
  useEffect(() => {
    if (!announceRef.current) {
      announceRef.current = true;
    }
  }, []);

  const copyAllPayload = assembleCopyAll(analysisId, body);

  function fireSection(section: SectionKey, text: string) {
    logger.info(TELEMETRY.SCRIPT_SECTION_COPIED, {
      analysis_id: analysisId,
      section,
      char_count: text.length,
    });
  }

  function fireCopyAll() {
    logger.info(TELEMETRY.SCRIPT_COPY_ALL, {
      analysis_id: analysisId,
      total_chars: copyAllPayload.length,
      has_empty_state: false,
    });
  }

  return (
    <div
      data-testid="actions-reshoot-body"
      className="relative flex flex-col gap-0 overflow-y-auto px-4 py-3 h-full"
    >
      {/* Sticky Copy-all pill. CRITICAL: NO onClick on GlassPill — when GlassPill
          receives onClick it renders a <button>. Wrapping the inner <CopyButton>
          (also a <button>) inside another <button> produces nested-button hydration
          warnings and invalid HTML. The inner CopyButton handles the click; the
          outer GlassPill is purely visual chrome. */}
      <div className="absolute right-3 top-2 z-10">
        <GlassPill size="sm" className="px-0 py-0">
          <CopyButton
            text={copyAllPayload}
            ariaLabel={SCRIPT_COPY.COPY_ALL_ARIA}
            label={SCRIPT_COPY.COPY_ALL_LABEL}
            onCopy={fireCopyAll}
          />
        </GlassPill>
      </div>

      {/* Hidden announcement for SR */}
      <span className="sr-only">{SCRIPT_COPY.ARIA_SCRIPT_READY}</span>

      {/* Section: New Opening */}
      <Section
        label={SCRIPT_COPY.SECTION_NEW_OPENING}
        content={body.opening_line}
        sectionKey="opening"
        copyAria={`Copy ${SCRIPT_COPY.SECTION_NEW_OPENING} section`}
        onCopy={fireSection}
      />

      {/* Section: Scene Order — list rendering */}
      <SectionList
        label={SCRIPT_COPY.SECTION_SCENE_ORDER}
        items={body.scene_order}
        sectionKey="scenes"
        copyAria={`Copy ${SCRIPT_COPY.SECTION_SCENE_ORDER} section`}
        onCopy={fireSection}
      />

      {/* Section: Voiceover */}
      <Section
        label={SCRIPT_COPY.SECTION_VOICEOVER}
        content={body.voiceover}
        sectionKey="voiceover"
        copyAria={`Copy ${SCRIPT_COPY.SECTION_VOICEOVER} section`}
        onCopy={fireSection}
        lineClamp={3}
      />

      {/* Section: Captions — list rendering */}
      <SectionList
        label={SCRIPT_COPY.SECTION_CAPTIONS}
        items={body.captions}
        sectionKey="captions"
        copyAria={`Copy ${SCRIPT_COPY.SECTION_CAPTIONS} section`}
        onCopy={fireSection}
      />
    </div>
  );
}

function Section({
  label,
  content,
  sectionKey,
  copyAria,
  onCopy,
  lineClamp,
}: {
  label: string;
  content: string;
  sectionKey: SectionKey;
  copyAria: string;
  onCopy: (k: SectionKey, text: string) => void;
  lineClamp?: number;
}) {
  return (
    <div className="border-b border-dashed border-white/[0.06] py-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-medium uppercase tracking-wide text-white/55">
          {label}
        </span>
        <CopyButton
          text={content}
          ariaLabel={copyAria}
          onCopy={() => onCopy(sectionKey, content)}
        />
      </div>
      <p className={`text-xs text-white/85 ${lineClamp ? `line-clamp-${lineClamp}` : ''}`}>
        {content}
      </p>
    </div>
  );
}

function SectionList({
  label,
  items,
  sectionKey,
  copyAria,
  onCopy,
}: {
  label: string;
  items: string[];
  sectionKey: SectionKey;
  copyAria: string;
  onCopy: (k: SectionKey, text: string) => void;
}) {
  const joined = items.map((i) => `- ${i}`).join('\n');
  return (
    <div className="border-b border-dashed border-white/[0.06] py-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-medium uppercase tracking-wide text-white/55">
          {label}
        </span>
        <CopyButton
          text={joined}
          ariaLabel={copyAria}
          onCopy={() => onCopy(sectionKey, joined)}
        />
      </div>
      <ul className="space-y-0.5">
        {items.map((item, i) => (
          <li key={`${sectionKey}-${i}`} className="text-xs text-white/85">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
