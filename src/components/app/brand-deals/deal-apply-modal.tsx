"use client";

import { useState } from "react";
import { Check } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InputField } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { useApplyToDeal } from "@/hooks/queries";
import type { BrandDeal } from "@/types/brand-deals";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface DealApplyModalProps {
  /** The deal being applied to, or null when modal is closed */
  deal: BrandDeal | null;
  /** Controlled open state */
  open: boolean;
  /** Callback to change open state */
  onOpenChange: (open: boolean) => void;
}

// ---------------------------------------------------------------------------
// DealApplyModal
// ---------------------------------------------------------------------------

/**
 * DealApplyModal -- Dialog with name, email, and pitch fields.
 *
 * Submit flow: loading spinner -> success checkmark -> auto-close.
 * Form resets on close. Uses design system Dialog/InputField/Button.
 *
 * @example
 * ```tsx
 * <DealApplyModal
 *   deal={selectedDeal}
 *   open={!!selectedDeal}
 *   onOpenChange={(open) => { if (!open) setSelectedDeal(null); }}
 * />
 * ```
 */
export function DealApplyModal({
  deal,
  open,
  onOpenChange,
}: DealApplyModalProps): React.JSX.Element | null {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pitch, setPitch] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const { toast } = useToast();
  const applyMutation = useApplyToDeal();

  if (!deal) return null;

  function resetForm(): void {
    setName("");
    setEmail("");
    setPitch("");
  }

  function handleOpenChange(nextOpen: boolean): void {
    if (!nextOpen && !submitted) {
      resetForm();
    }
    onOpenChange(nextOpen);
  }

  function handleSubmit(e: React.FormEvent): void {
    e.preventDefault();
    if (!deal) return;

    applyMutation.mutate(
      {
        dealId: deal.id,
        applicationNote: pitch,
      },
      {
        onSuccess: () => {
          setSubmitted(true);
          // Auto-close after success animation
          setTimeout(() => {
            resetForm();
            setSubmitted(false);
            onOpenChange(false);
          }, 1500);
        },
        onError: (error) => {
          toast({
            variant: "error",
            title: "Failed to apply",
            description: error.message,
          });
        },
      }
    );
  }

  const isValid = name.trim() && email.trim() && pitch.trim();

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent size="md">
        {submitted ? (
          /* ---- Success state ---- */
          <div className="flex flex-col items-center justify-center gap-3 py-12">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10">
              <Check
                className="text-green-400"
                weight="bold"
                size={24}
              />
            </div>
            <h3 className="text-lg font-semibold text-foreground">
              Application submitted!
            </h3>
            <p className="text-sm text-foreground-muted">
              You&apos;ll hear back from {deal.brandName} soon.
            </p>
          </div>
        ) : (
          /* ---- Form state ---- */
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>Apply to {deal.brandName}</DialogTitle>
              <DialogDescription>
                Fill in your details to apply for this deal.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 px-6 py-4">
              <InputField
                label="Your name"
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />

              <InputField
                label="Contact email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-foreground">
                  Short pitch
                </label>
                <textarea
                  placeholder="Why are you a good fit for this deal?"
                  rows={4}
                  value={pitch}
                  onChange={(e) => setPitch(e.target.value)}
                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-colors"
                />
              </div>
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
                loading={applyMutation.isPending}
                disabled={!isValid}
              >
                Apply
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
