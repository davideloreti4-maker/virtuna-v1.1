'use client';

import { useAnalysisHistory } from '@/hooks/queries';
import { Caption } from '@/components/ui/typography';
import { TestHistoryItem } from './test-history-item';

interface TestHistoryListProps {
  onSelectTest: (testId: string) => void;
}

export function TestHistoryList({ onSelectTest }: TestHistoryListProps) {
  const { data: historyData, isLoading } = useAnalysisHistory();

  if (isLoading) {
    return (
      <Caption className="block px-3 py-2">
        Loading history...
      </Caption>
    );
  }

  const tests = historyData ?? [];

  if (tests.length === 0) {
    return (
      <Caption className="block px-3 py-2">
        No tests yet. Create your first test to see it here.
      </Caption>
    );
  }

  return (
    <>
      {/* Section header matching v0 design */}
      <Caption className="mb-2 block px-2 uppercase tracking-wider">
        Recent Tests
      </Caption>

      <div className="flex flex-col gap-1">
        {tests.map((test: Record<string, unknown>) => (
          <TestHistoryItem
            key={test.id as string}
            test={{
              id: test.id as string,
              testType: (test.content_type as string ?? 'article') as never,
              content: test.content_text as string ?? '',
              impactScore: (test.overall_score as number) ?? 0,
              impactLabel: ((test.overall_score as number) ?? 0) >= 70 ? 'Good' : ((test.overall_score as number) ?? 0) >= 40 ? 'Average' : 'Poor',
              attention: { full: 40, partial: 35, ignore: 25 },
              variants: [],
              insights: [],
              conversationThemes: [],
              createdAt: (test.created_at as string) ?? new Date().toISOString(),
              societyId: (test.society_id as string) ?? '',
            }}
            inputMode={(test.input_mode as string) ?? 'text'}
            isActive={false}
            onClick={() => onSelectTest(test.id as string)}
            onDelete={() => {
              // TODO: Implement delete via API route
              console.warn('Delete not yet implemented via API');
            }}
          />
        ))}
      </div>
    </>
  );
}
