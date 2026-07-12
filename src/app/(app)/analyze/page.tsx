import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Analyze | Maven',
  description: "Analyze your TikTok content with Maven's prediction engine.",
};

/**
 * /analyze — bare route has no reading id, so <Reading> (mounted by
 * analyze/layout.tsx for the /analyze/[id] transition) renders nothing and the
 * screen was fully blank. Nothing in-app links here without an id; send the
 * stray visitor to /start where every Read begins.
 */
export default function AnalyzePage() {
  redirect('/start');
}
