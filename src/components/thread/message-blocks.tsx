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
};

export interface MessageBlocksProps {
  /** Raw JSON array stored in messages.body (D-13). */
  body: unknown[];
}

export function MessageBlocks({ body }: MessageBlocksProps) {
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

        return <Component key={index} block={block} />;
      })}
    </div>
  );
}
