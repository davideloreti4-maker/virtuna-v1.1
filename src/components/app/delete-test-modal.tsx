'use client';

import * as AlertDialog from '@radix-ui/react-alert-dialog';

interface DeleteTestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

/**
 * Confirmation modal for deleting a test from history.
 * Uses AlertDialog for proper accessibility with destructive actions.
 */
export function DeleteTestModal({
  open,
  onOpenChange,
  onConfirm,
}: DeleteTestModalProps) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <AlertDialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]">
          <AlertDialog.Title className="text-lg font-semibold text-white">
            Delete this test?
          </AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-sm text-zinc-400">
            This action cannot be undone. The test and its results will be permanently removed.
          </AlertDialog.Description>

          <div className="mt-6 flex justify-end gap-3">
            <AlertDialog.Cancel asChild>
              <button className="rounded-lg border border-zinc-700 bg-transparent px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500">
                Cancel
              </button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <button
                onClick={onConfirm}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
              >
                Delete
              </button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
