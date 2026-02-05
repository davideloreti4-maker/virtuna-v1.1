'use client';

import { useState } from 'react';
import { useTestStore } from '@/stores/test-store';
import { Caption } from '@/components/ui/typography';
import { TestHistoryItem } from './test-history-item';
import { DeleteTestModal } from './delete-test-modal';

interface TestHistoryListProps {
  onSelectTest: (testId: string) => void;
}

export function TestHistoryList({ onSelectTest }: TestHistoryListProps) {
  const tests = useTestStore((s) => s.tests);
  const currentResult = useTestStore((s) => s.currentResult);
  const deleteTest = useTestStore((s) => s.deleteTest);
  const _isHydrated = useTestStore((s) => s._isHydrated);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [testToDelete, setTestToDelete] = useState<string | null>(null);

  // Guard for SSR hydration
  if (!_isHydrated) {
    return (
      <Caption className="block px-3 py-2">
        Loading history...
      </Caption>
    );
  }

  if (tests.length === 0) {
    return (
      <Caption className="block px-3 py-2">
        No tests yet. Create your first test to see it here.
      </Caption>
    );
  }

  const handleDeleteClick = (testId: string) => {
    setTestToDelete(testId);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = () => {
    if (testToDelete) {
      deleteTest(testToDelete);
      setTestToDelete(null);
      setDeleteModalOpen(false);
    }
  };

  return (
    <>
      {/* Section header matching v0 design */}
      <Caption className="mb-2 block px-2 uppercase tracking-wider">
        Recent Tests
      </Caption>

      <div className="flex flex-col gap-1">
        {tests.map((test) => (
          <TestHistoryItem
            key={test.id}
            test={test}
            isActive={currentResult?.id === test.id}
            onClick={() => onSelectTest(test.id)}
            onDelete={() => handleDeleteClick(test.id)}
          />
        ))}
      </div>

      {/* Delete modal as sibling (dialog sibling pattern) */}
      <DeleteTestModal
        open={deleteModalOpen}
        onOpenChange={setDeleteModalOpen}
        onConfirm={handleConfirmDelete}
      />
    </>
  );
}
