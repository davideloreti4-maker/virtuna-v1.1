import type { Metadata } from 'next';

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
export default async function AnalyzeResultPage(_props: PageProps) {
  return null;
}
