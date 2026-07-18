'use client';

/**
 * MessageBlocks — maps a message body (array of raw blocks) to renderer components.
 *
 * D-14: re-validates EACH block via validateBlock() on render (not just at write time).
 * Unknown or invalid blocks → <UnsupportedBlock> (static placeholder, never executes props).
 * This is the structural enforcement of THREAD-04 "no model-generated UI":
 * the model can only produce block types already in the registry.
 */

import { validateBlock } from '@/lib/tools/block-registry';
import type { BlockType } from '@/lib/tools/block-registry';
import { MarkdownBlockRenderer } from '@/components/thread/markdown-block';
import { BandBlockRenderer } from '@/components/thread/band-block';
import { PersonasBlockRenderer } from '@/components/thread/personas-block';
import { IdeaCardRenderer } from '@/components/thread/idea-card-block';
import { HookCardRenderer } from '@/components/thread/hook-card-block';
import { ScriptCardRenderer } from '@/components/thread/script-card-block';
import { RemixCardRenderer } from '@/components/thread/remix-card-block';
import { OutlierGridBlockRenderer } from '@/components/thread/outlier-grid-block';
import { MultiAudienceReadBlockRenderer } from '@/components/thread/multi-audience-read-block';
import { PersonaChatTurnBlockRenderer } from '@/components/thread/persona-chat-turn-block';
import { AccountReadBlockRenderer } from '@/components/thread/account-read-block';
import { InputRequestBlockRenderer } from '@/components/thread/input-request-block';
import { ProfileReadBlockRenderer } from '@/components/thread/profile-read-block';
import { ReactionDistributionBlockRenderer } from '@/components/thread/reaction-distribution-block';
import { PredictionGaugeBlockRenderer } from '@/components/thread/prediction-gauge-block';
import { UnsupportedBlock } from './unsupported-block';

// Component map: same keys as BLOCK_REGISTRY (TypeScript enforces completeness).
// Inline here to avoid the .ts/.tsx module resolution ambiguity with block-registry.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const BLOCK_COMPONENTS: Record<BlockType, React.ComponentType<{ block: any }>> = {
  markdown: MarkdownBlockRenderer,
  band: BandBlockRenderer,
  personas: PersonasBlockRenderer,
  "idea-card": IdeaCardRenderer,
  "hook-card": HookCardRenderer,
  "script-card": ScriptCardRenderer,
  "remix-card": RemixCardRenderer,
  "outlier-grid": OutlierGridBlockRenderer,
  "multi-audience-read": MultiAudienceReadBlockRenderer,
  "persona-chat-turn": PersonaChatTurnBlockRenderer,
  "account-read": AccountReadBlockRenderer,
  "input-request": InputRequestBlockRenderer,
  "profile-read": ProfileReadBlockRenderer,
  "reaction-distribution": ReactionDistributionBlockRenderer,
  "prediction-gauge": PredictionGaugeBlockRenderer,
};

export interface MessageBlocksProps {
  /** Raw JSON array stored in messages.body (D-13). */
  body: unknown[];
  /**
   * The concept text this message's audience reacted to (LIVE-03 / LIVE-06). When present
   * it is threaded into the `personas` block so the text-Read surface mounts the reusable
   * AudienceLens with a concept to ground the "Ask them why →" chat. Additive/optional:
   * when absent the renderer falls back to the in-band concept (a co-located `markdown`
   * block in the SAME body — the concept the personas reacted to in that turn). Every other
   * block renderer is invoked byte-identically (`<Component block={block} />`) regardless.
   */
  conceptText?: string;
}

/**
 * In-band concept fallback: the concept text a `personas` block reacted to is, by the
 * test-turn shape, carried as a `markdown` block in the SAME message body. We pick the
 * FIRST validated markdown block's text. Honest — never fabricated; returns undefined
 * when no markdown block is present (the Lens then gates chat off, by design).
 */
function inBandConceptText(body: unknown[]): string | undefined {
  for (const rawBlock of body) {
    const result = validateBlock(rawBlock);
    // `props` is typed `unknown` on the validated block (block-registry); read `text`
    // defensively rather than relying on a type-discriminant narrow.
    if (result.ok && result.block.type === 'markdown') {
      const props = result.block.props as { text?: unknown };
      const text = props.text;
      if (typeof text === 'string' && text.trim().length > 0) return text;
    }
  }
  return undefined;
}

export function MessageBlocks({ body, conceptText }: MessageBlocksProps) {
  // Prefer the explicit concept (threaded by the test/Read view); else derive the
  // in-band concept from a co-located markdown block (LIVE-06 text-Read surface).
  const personaConcept = conceptText ?? inBandConceptText(body);

  return (
    <div className="flex flex-col gap-3">
      {body.map((rawBlock, index) => {
        const result = validateBlock(rawBlock);

        if (!result.ok) {
          return <UnsupportedBlock key={index} />;
        }

        const { block } = result;
        const Component = BLOCK_COMPONENTS[block.type];

        if (!Component) {
          // Fallback for a registered type with no component (should not happen but be safe).
          return <UnsupportedBlock key={index} />;
        }

        // The `personas` (text-Read) renderer additively accepts a `conceptText` so the
        // shared AudienceLens mounts with a concept to ground chat (LIVE-03 (b) / LIVE-06).
        // All other renderers are invoked byte-identically — no behavior change for them.
        if (block.type === 'personas' && personaConcept) {
          // block is the validated personas block; props is typed `unknown` on the registry
          // result, so cast to the renderer's expected shape (already schema-validated above).
          return (
            <PersonasBlockRenderer
              key={index}
              block={block as Parameters<typeof PersonasBlockRenderer>[0]['block']}
              conceptText={personaConcept}
            />
          );
        }

        return <Component key={index} block={block} />;
      })}
    </div>
  );
}
