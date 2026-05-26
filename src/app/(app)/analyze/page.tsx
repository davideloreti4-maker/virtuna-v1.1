import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Analyze | Virtuna',
  description: "Analyze your TikTok content with Virtuna's prediction engine.",
};

/**
 * /analyze — empty board landing. <Board> is mounted by analyze/layout.tsx
 * so it survives the transition to /analyze/[id]. This page intentionally
 * returns null; all UI is rendered by <Board>'s DOM overlays.
 */
export default function AnalyzePage() {
  return null;
}
