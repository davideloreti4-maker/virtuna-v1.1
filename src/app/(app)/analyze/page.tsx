import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Analyze | Maven',
  description: "Analyze your TikTok content with Maven's prediction engine.",
};

/**
 * /analyze — bare route has no reading id, so <Reading> (mounted by
 * analyze/layout.tsx for the /analyze/[id] transition) renders nothing and the
 * screen was fully blank. Nothing in-app links here without an id.
 *
 * It used to send the stray visitor to /start — but the launch cut hid /start too
 * (it now redirects to /home), so /analyze → /start → /home was a dead 2-hop. Go
 * straight to /home, where every Read now begins (P3, ambient-room-v2).
 */
export default function AnalyzePage() {
  redirect('/home');
}
