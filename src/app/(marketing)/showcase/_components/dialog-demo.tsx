"use client";

import {
  Button,
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui";

const DIALOG_SIZES = [
  { size: "sm" as const, label: "Small (384px)" },
  { size: "md" as const, label: "Medium (448px)" },
  { size: "lg" as const, label: "Large (512px)" },
];

export function DialogDemo() {
  return (
    <div className="flex flex-wrap gap-3">
      {DIALOG_SIZES.map(({ size, label }) => (
        <Dialog key={size}>
          <DialogTrigger asChild>
            <Button variant="secondary" size="sm">
              Open {label}
            </Button>
          </DialogTrigger>
          <DialogContent size={size}>
            <DialogHeader>
              <DialogTitle>Dialog {label}</DialogTitle>
              <DialogDescription>
                This is a {size} dialog with glassmorphism styling, backdrop
                blur, and Radix-managed focus trap.
              </DialogDescription>
            </DialogHeader>
            <div className="px-6 py-4">
              <p className="text-sm text-foreground-secondary">
                Dialog content goes here. The overlay uses 4px blur while the
                content panel uses 20px blur for depth separation.
              </p>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="secondary" size="sm">
                  Cancel
                </Button>
              </DialogClose>
              <DialogClose asChild>
                <Button variant="primary" size="sm">
                  Confirm
                </Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ))}
    </div>
  );
}
