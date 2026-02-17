"use client";

import { useState, useCallback } from "react";
import { z } from "zod";
import { ArrowLeft } from "lucide-react";
import { useSocietyStore } from "@/stores/society-store";
import type { TargetSociety } from "@/types/society";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const createSocietySchema = z.object({
  description: z
    .string()
    .min(1, { error: "Required" })
    .min(10, { error: "At least 10 characters" }),
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CreateSocietyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CreateSocietyModal({ open, onOpenChange }: CreateSocietyModalProps) {
  const [description, setDescription] = useState("");
  const [descriptionError, setDescriptionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const addSociety = useSocietyStore((s) => s.addSociety);

  const resetForm = useCallback(() => {
    setDescription("");
    setDescriptionError(null);
    setIsDirty(false);
    setShowDiscardConfirm(false);
  }, []);

  const validateDescription = useCallback((value: string): string | null => {
    const result = createSocietySchema.safeParse({ description: value });
    if (!result.success) {
      const issue = result.error.issues[0];
      return issue?.message ?? "Invalid";
    }
    return null;
  }, []);

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setDescription(value);
    setIsDirty(true);
    // Clear error on change if field becomes valid
    if (descriptionError) {
      const error = validateDescription(value);
      if (!error) setDescriptionError(null);
    }
  };

  const handleDescriptionBlur = () => {
    if (description.trim()) {
      setDescriptionError(validateDescription(description));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const error = validateDescription(description);
    if (error) {
      setDescriptionError(error);
      return;
    }

    setIsSubmitting(true);

    // Simulate AI matching delay (1.5s)
    await new Promise((r) => setTimeout(r, 1500));

    // Extract society name from description (first few words)
    const name = extractSocietyName(description);

    const newSociety: TargetSociety = {
      id: crypto.randomUUID(),
      name,
      description: description.trim(),
      type: "target",
      societyType: "custom",
      icon: "briefcase",
      members: Math.floor(Math.random() * 500) + 50, // Mock member count
      createdAt: new Date().toISOString(),
    };

    addSociety(newSociety);
    resetForm();
    setIsSubmitting(false);
    onOpenChange(false);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && isDirty && !isSubmitting) {
      setShowDiscardConfirm(true);
      return;
    }
    if (!nextOpen) {
      resetForm();
    }
    onOpenChange(nextOpen);
  };

  const handleDiscard = () => {
    resetForm();
    onOpenChange(false);
  };

  const handleCancelDiscard = () => {
    setShowDiscardConfirm(false);
  };

  const handleBack = () => {
    if (!isSubmitting) {
      handleOpenChange(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent size="lg" className="overflow-hidden rounded-lg p-8">
          {/* Back button */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleBack}
            disabled={isSubmitting}
            className="absolute left-6 top-6"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>

          <div className="mx-auto max-w-[500px] pt-8 text-center">
            <DialogHeader className="p-0 pb-0">
              <DialogTitle className="mb-4 text-3xl font-semibold">
                Who do you want in your society?
              </DialogTitle>
              <DialogDescription className="mb-8 text-[15px] leading-relaxed">
                Describe the people you want in your society. We&apos;ll match your
                description with AI personas from our database. Every AI persona is
                based on a real person.
              </DialogDescription>
            </DialogHeader>

            {/* Form */}
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <Textarea
                  value={description}
                  onChange={handleDescriptionChange}
                  onBlur={handleDescriptionBlur}
                  placeholder="e.g. Founders in London..."
                  disabled={isSubmitting}
                  autoResize
                  minRows={3}
                  error={!!descriptionError}
                />
                {descriptionError && (
                  <p className="mt-1.5 text-left text-sm text-error" role="alert">
                    {descriptionError}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                loading={isSubmitting}
                disabled={!description.trim() || isSubmitting}
                className="w-full"
              >
                {isSubmitting ? "Matching AI personas..." : "Create your society"}
              </Button>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      {/* Discard confirmation dialog */}
      <Dialog open={showDiscardConfirm} onOpenChange={setShowDiscardConfirm}>
        <DialogContent size="sm" className="p-6">
          <DialogHeader className="p-0 pb-0">
            <DialogTitle>Discard changes?</DialogTitle>
            <DialogDescription className="mt-2">
              You have unsaved changes. Are you sure you want to discard them?
            </DialogDescription>
          </DialogHeader>
          <div className="mt-6 flex justify-end gap-3">
            <Button variant="secondary" onClick={handleCancelDiscard}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDiscard}>
              Discard
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Extract a society name from the description.
 * Takes the first 3-4 meaningful words.
 */
function extractSocietyName(description: string): string {
  const words = description.trim().split(/\s+/);
  // Remove common filler words
  const fillerWords = ["e.g.", "e.g", "eg", "like", "such", "as", "for", "example"];
  const cleanWords = words.filter(
    (w) => !fillerWords.includes(w.toLowerCase().replace(/[.,]/g, ""))
  );

  // Take first 3 words or up to 30 characters
  const name = cleanWords.slice(0, 3).join(" ");
  return name.length > 30 ? name.slice(0, 30).trim() + "..." : name;
}
