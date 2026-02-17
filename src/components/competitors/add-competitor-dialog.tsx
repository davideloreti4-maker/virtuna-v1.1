"use client";

import * as React from "react";
import { useTransition, useState } from "react";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { addCompetitor } from "@/app/actions/competitors/add";

interface AddCompetitorDialogProps {
  trigger: React.ReactNode;
}

/**
 * Dialog for adding a competitor by TikTok handle.
 *
 * Accepts a `trigger` prop (rendered as DialogTrigger) and opens a form dialog
 * where the user can paste a @handle or TikTok URL. Calls the addCompetitor
 * server action and shows toast feedback on success/error.
 */
export function AddCompetitorDialog({ trigger }: AddCompetitorDialogProps) {
  const [open, setOpen] = useState(false);
  const [handle, setHandle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      setHandle("");
      setError(null);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!handle.trim()) return;
    setError(null);

    startTransition(async () => {
      const result = await addCompetitor(handle.trim());
      if (result.error) {
        setError(result.error);
      } else {
        toast({
          variant: "success",
          title: `Now tracking @${result.data!.handle}`,
        });
        setHandle("");
        setOpen(false);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent size="sm">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add Competitor</DialogTitle>
            <DialogDescription>
              Enter a TikTok handle or profile URL to start tracking.
            </DialogDescription>
          </DialogHeader>

          <div className="p-6 pb-0">
            <Input
              id="add-competitor-handle"
              placeholder="@username or tiktok.com/@username"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              autoFocus
              disabled={isPending}
              error={error ?? undefined}
            />
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary" type="button">
                Cancel
              </Button>
            </DialogClose>
            <Button
              variant="primary"
              type="submit"
              loading={isPending}
              disabled={!handle.trim()}
            >
              Add
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
