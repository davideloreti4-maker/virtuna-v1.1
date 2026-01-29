'use client';

import { useState } from 'react';
import { useTestStore } from '@/stores/test-store';
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
      <div className="px-3 py-2 text-xs text-zinc-600">
        Loading history...
      </div>
    );
  }

  if (tests.length === 0) {
    return (
      <div className="px-3 py-2 text-xs text-zinc-600">
        No tests yet. Create your first test to see it here.
      </div>
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
