"use client";

import { useState, useTransition } from "react";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { removeCompetitor } from "@/app/actions/competitors/remove";

interface RemoveCompetitorButtonProps {
  competitorId: string;
  handle: string;
}

/**
 * Remove button with AlertDialog confirmation for removing a tracked competitor.
 *
 * Renders a small trash icon button. On click, opens an AlertDialog asking
 * for confirmation. Calls removeCompetitor server action on confirm.
 * The trigger button prevents event propagation so parent Link/onClick handlers
 * don't fire.
 */
export function RemoveCompetitorButton({
  competitorId,
  handle,
}: RemoveCompetitorButtonProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  function handleTriggerClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setOpen(true);
  }

  function handleRemove() {
    startTransition(async () => {
      const result = await removeCompetitor(competitorId);
      if (result.error) {
        toast({
          variant: "error",
          title: "Failed to remove competitor",
          description: result.error,
        });
      } else {
        toast({
          variant: "success",
          title: `Stopped tracking @${handle}`,
        });
        setOpen(false);
      }
    });
  }

  return (
    <AlertDialog.Root open={open} onOpenChange={setOpen}>
      <button
        type="button"
        onClick={handleTriggerClick}
        className="p-1.5 rounded-md text-foreground-muted hover:text-foreground hover:bg-white/[0.05] transition-colors"
        aria-label={`Remove @${handle}`}
      >
        <Trash2 size={14} />
      </button>

      <AlertDialog.Portal>
        <AlertDialog.Overlay
          className="fixed inset-0 z-[var(--z-modal-backdrop)] bg-black/60 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
          style={{
            backdropFilter: "blur(4px)",
            WebkitBackdropFilter: "blur(4px)",
          }}
        />
        <AlertDialog.Content
          className="fixed left-[50%] top-[50%] z-[var(--z-modal)] w-full max-w-md translate-x-[-50%] translate-y-[-50%] rounded-xl border border-white/[0.06] p-6 shadow-xl duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]"
          style={{
            backgroundColor: "rgba(17, 18, 20, 0.95)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            boxShadow:
              "0 20px 25px rgba(0,0,0,0.3), 0 10px 10px rgba(0,0,0,0.2), rgba(255,255,255,0.1) 0px 1px 0px 0px inset",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <AlertDialog.Title className="text-lg font-semibold text-foreground">
            Stop tracking @{handle}?
          </AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-sm text-foreground-secondary">
            This competitor will be removed from your tracked list. You can add
            them back later.
          </AlertDialog.Description>

          <div className="mt-6 flex justify-end gap-3">
            <AlertDialog.Cancel asChild>
              <Button variant="secondary">Cancel</Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <Button
                variant="destructive"
                onClick={handleRemove}
                loading={isPending}
              >
                Remove
              </Button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
