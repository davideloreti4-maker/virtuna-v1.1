import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { NEW_LOOK_ENABLED } from '@/lib/flags/new-look';
import { resultHref } from '@/lib/result/href';

interface PageProps { params: Promise<{ id: string }>; }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  return { title: `Analysis ${id} | Maven`, description: 'View your TikTok content analysis results.' };
}

/**
 * /analyze/[id] — server shell. Board is rendered by analyze/layout.tsx.
 * The board client reads the analysis id from `useParams()` and the SSE hook
 * fetches the row. The IDOR-defended Supabase server fetch is reintroduced in
 * plan 2.4 once the board state machine consumes initialData.
 */
export default async function AnalyzeResultPage(props: PageProps) {
  // New look: a stored simulation opens on its result page (spec §8).
  if (NEW_LOOK_ENABLED) redirect(resultHref((await props.params).id));
  return null;
}
