'use client';

/**
 * block-registry.tsx — client companion to block-registry.ts.
 *
 * Attaches React components to each registry key.  This file is client-only
 * (it pulls in 'use client' renderer components); the schema/validation half
 * remains in block-registry.ts (server-importable, zero client-component imports).
 *
 * Consumers that need both schema + component in a client context can import
 * BLOCK_COMPONENT_REGISTRY from this file directly (import with '.tsx' extension
 * or via the full path when allowImportingTsExtensions is not set).
 *
 * Re-exports validateBlock + BlockType so that message-blocks.tsx can import from
 * a single '@/lib/tools/block-registry' path and Turbopack resolves consistently
 * regardless of which file (.ts vs .tsx) wins the module graph walk.
 */

export { validateBlock, type BlockType } from './block-registry';
import type { BlockType } from './block-registry';
import { MarkdownBlockRenderer } from '@/components/thread/markdown-block';
import { BandBlockRenderer } from '@/components/thread/band-block';
import { PersonasBlockRenderer } from '@/components/thread/personas-block';
import { IdeaCardRenderer } from '@/components/thread/idea-card-block';
import type { MarkdownBlock, BandBlock, PersonasBlock, IdeaCardBlock } from './blocks';

// Each entry pairs a component with the block type it renders.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const BLOCK_COMPONENT_REGISTRY: Record<BlockType, React.ComponentType<{ block: any }>> = {
  markdown: MarkdownBlockRenderer as React.ComponentType<{ block: MarkdownBlock }>,
  band: BandBlockRenderer as React.ComponentType<{ block: BandBlock }>,
  personas: PersonasBlockRenderer as React.ComponentType<{ block: PersonasBlock }>,
  "idea-card": IdeaCardRenderer as React.ComponentType<{ block: IdeaCardBlock }>,
};
