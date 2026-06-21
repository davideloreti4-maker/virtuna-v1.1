'use client';

/**
 * MarkdownBlock — renders the markdown block type via react-markdown + rehype-sanitize.
 *
 * Mirrors the rendering pattern already in use in reading-chat.tsx.
 * The `text` prop comes from a validated MarkdownBlock (validated by validateBlock
 * before this component is mounted — D-14).
 */

import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import type { MarkdownBlock } from '@/lib/tools/blocks';

export interface MarkdownBlockProps {
  block: MarkdownBlock;
}

export function MarkdownBlockRenderer({ block }: MarkdownBlockProps) {
  return (
    <div className="prose prose-invert prose-sm max-w-none">
      <ReactMarkdown rehypePlugins={[rehypeSanitize]}>
        {block.props.text}
      </ReactMarkdown>
    </div>
  );
}
