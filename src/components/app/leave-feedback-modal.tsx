"use client";

import { useState, useCallback } from "react";
import { z } from "zod";
import { ArrowRight } from "lucide-react";
import { useSettingsStore } from "@/stores/settings-store";
import {
  Dialog,
  DialogContent,
  DialogClose,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const feedbackFormSchema = z.object({
  name: z.string().optional(),
  email: z
    .string()
    .email({ error: "Enter a valid email" })
    .optional()
    .or(z.literal("")),
  feedback: z.string().min(1, { error: "Required" }),
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LeaveFeedbackModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LeaveFeedbackModal({ open, onOpenChange }: LeaveFeedbackModalProps) {
  const profile = useSettingsStore((s) => s.profile);
  const _isHydrated = useSettingsStore((s) => s._isHydrated);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [feedback, setFeedback] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  // Pre-fill from profile when hydrated
  const displayName = name || (_isHydrated ? profile.name : "");
  const displayEmail = email || (_isHydrated ? profile.email : "");

  const resetForm = useCallback(() => {
    setName("");
    setEmail("");
    setFeedback("");
    setEmailError(null);
    setFeedbackError(null);
    setIsDirty(false);
    setShowDiscardConfirm(false);
    setSubmitted(false);
  }, []);

  const validateEmail = useCallback((value: string): string | null => {
    if (!value.trim()) return null; // Email is optional
    const result = feedbackFormSchema.shape.email.safeParse(value);
    if (!result.success) {
      const issue = result.error.issues[0];
      return issue?.message ?? "Invalid email";
    }
    return null;
  }, []);

  const validateFeedback = useCallback((value: string): string | null => {
    const result = feedbackFormSchema.shape.feedback.safeParse(value);
    if (!result.success) {
      const issue = result.error.issues[0];
      return issue?.message ?? "Required";
    }
    return null;
  }, []);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
    setIsDirty(true);
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEmail(value);
    setIsDirty(true);
    // Clear error on change if field becomes valid
    if (emailError) {
      const error = validateEmail(value);
      if (!error) setEmailError(null);
    }
  };

  const handleEmailBlur = () => {
    if (displayEmail.trim()) {
      setEmailError(validateEmail(displayEmail));
    }
  };

  const handleFeedbackChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setFeedback(value);
    setIsDirty(true);
    // Clear error on change if field becomes valid
    if (feedbackError) {
      const error = validateFeedback(value);
      if (!error) setFeedbackError(null);
    }
  };

  const handleFeedbackBlur = () => {
    if (feedback.trim()) {
      setFeedbackError(validateFeedback(feedback));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate all fields
    const eError = validateEmail(displayEmail);
    const fError = validateFeedback(feedback);

    if (eError || fError) {
      setEmailError(eError);
      setFeedbackError(fError);
      return;
    }

    setIsSubmitting(true);
    // Simulate API delay
    await new Promise((r) => setTimeout(r, 800));

    console.log("Feedback submitted:", {
      name: displayName,
      email: displayEmail,
      feedback,
    });

    setIsSubmitting(false);
    setSubmitted(true);

    // Reset and close after showing success
    setTimeout(() => {
      resetForm();
      onOpenChange(false);
    }, 1500);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    // Don't intercept while showing success
    if (submitted) {
      if (!nextOpen) {
        resetForm();
      }
      onOpenChange(nextOpen);
      return;
    }

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

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent size="md" className="p-6">
          {/* Header */}
          <div className="mb-6 flex items-center justify-between">
            <DialogHeader className="p-0 pb-0">
              <DialogTitle>Leave feedback</DialogTitle>
            </DialogHeader>
            <DialogClose asChild>
              <Button variant="ghost" size="sm" aria-label="Close">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </Button>
            </DialogClose>
          </div>

          {submitted ? (
            <div className="py-8 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-success/10">
                <svg className="h-6 w-6 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-lg font-medium text-foreground">Thank you!</p>
              <p className="mt-1 text-sm text-foreground-secondary">
                Your feedback has been sent to the team.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              {/* Your details section */}
              <div className="mb-6">
                <label className="mb-3 block text-[13px] text-foreground-secondary">
                  Your details
                </label>
                <div className="mb-3">
                  <Input
                    type="text"
                    value={displayName}
                    onChange={handleNameChange}
                    placeholder="Your name"
                    size="md"
                  />
                </div>
                <Input
                  type="email"
                  value={displayEmail}
                  onChange={handleEmailChange}
                  onBlur={handleEmailBlur}
                  placeholder="your@email.com"
                  size="md"
                  error={emailError ?? false}
                />
              </div>

              {/* Feedback section */}
              <div className="mb-5">
                <label className="mb-3 block text-[13px] text-foreground-secondary">
                  Your feedback
                </label>
                <Textarea
                  value={feedback}
                  onChange={handleFeedbackChange}
                  onBlur={handleFeedbackBlur}
                  placeholder="Tell us what you think! It goes directly to the founders"
                  autoResize
                  minRows={4}
                  error={!!feedbackError}
                />
                {feedbackError && (
                  <p className="mt-1.5 text-sm text-error" role="alert">
                    {feedbackError}
                  </p>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between">
                <p className="text-[13px] text-foreground-muted">
                  Email us at{" "}
                  <a
                    href="mailto:support@virtuna.ai"
                    className="text-foreground-secondary underline hover:text-foreground"
                  >
                    support@virtuna.ai
                  </a>
                </p>
                <Button
                  type="submit"
                  variant="primary"
                  loading={isSubmitting}
                  disabled={isSubmitting || !feedback.trim()}
                >
                  {isSubmitting ? "Sending..." : "Submit"}
                  {!isSubmitting && <ArrowRight className="h-4 w-4" />}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Discard confirmation dialog */}
      <Dialog open={showDiscardConfirm} onOpenChange={setShowDiscardConfirm}>
        <DialogContent size="sm" className="p-6">
          <DialogHeader className="p-0 pb-0">
            <DialogTitle>Discard changes?</DialogTitle>
            <p className="mt-2 text-sm text-foreground-secondary">
              You have unsaved changes. Are you sure you want to discard them?
            </p>
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
