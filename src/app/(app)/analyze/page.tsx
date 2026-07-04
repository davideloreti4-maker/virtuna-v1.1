import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Analyze | Maven',
  description: "Analyze your TikTok content with Numen's prediction engine.",
};

/**
 * /analyze — empty landing. <Reading> is mounted by analyze/layout.tsx so it
 * survives the transition to /analyze/[id]. This page intentionally returns
 * null; all UI is rendered by <Reading> (the retired Board is no longer mounted).
 */
export default function AnalyzePage() {
  return null;
}
