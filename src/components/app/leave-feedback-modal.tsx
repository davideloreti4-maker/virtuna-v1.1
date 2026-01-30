"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSettingsStore } from "@/stores/settings-store";

interface LeaveFeedbackModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LeaveFeedbackModal({ open, onOpenChange }: LeaveFeedbackModalProps) {
  const profile = useSettingsStore((s) => s.profile);
  const _isHydrated = useSettingsStore((s) => s._isHydrated);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [feedback, setFeedback] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Pre-fill from profile when hydrated
  const displayName = name || (_isHydrated ? profile.name : "");
  const displayEmail = email || (_isHydrated ? profile.email : "");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedback.trim()) return;

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
      setFeedback("");
      setSubmitted(false);
      onOpenChange(false);
    }, 1500);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 w-full max-w-[480px] -translate-x-1/2 -translate-y-1/2",
            "rounded-2xl border border-zinc-800 bg-[#18181B] p-6 shadow-xl",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <Dialog.Title className="text-lg font-semibold text-white">
              Leave feedback
            </Dialog.Title>
            <Dialog.Close className="rounded-lg p-1 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-400">
              <X className="h-5 w-5" />
            </Dialog.Close>
          </div>

          {submitted ? (
            <div className="py-8 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10">
                <svg className="h-6 w-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-lg font-medium text-white">Thank you!</p>
              <p className="mt-1 text-sm text-zinc-400">
                Your feedback has been sent to the team.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              {/* Your details section */}
              <div className="mb-6">
                <label className="mb-3 block text-[13px] text-zinc-400">
                  Your details
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="mb-3 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-white placeholder-zinc-500 outline-none focus:border-zinc-600"
                />
                <input
                  type="email"
                  value={displayEmail}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-white placeholder-zinc-500 outline-none focus:border-zinc-600"
                />
              </div>

              {/* Feedback section */}
              <div className="mb-5">
                <label className="mb-3 block text-[13px] text-zinc-400">
                  Your feedback
                </label>
                <textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Tell us what you think! It goes directly to the founders"
                  rows={4}
                  className="w-full resize-none rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-white placeholder-zinc-500 outline-none focus:border-zinc-600"
                />
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between">
                <p className="text-[13px] text-zinc-500">
                  Email us at{" "}
                  <a
                    href="mailto:support@societies.io"
                    className="text-zinc-400 underline hover:text-zinc-300"
                  >
                    support@societies.io
                  </a>
                </p>
                <button
                  type="submit"
                  disabled={isSubmitting || !feedback.trim()}
                  className="flex items-center gap-2 rounded-lg bg-orange-500 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-orange-600 disabled:opacity-50"
                >
                  {isSubmitting ? "Sending..." : "Submit"}
                  {!isSubmitting && <ArrowRight className="h-4 w-4" />}
                </button>
              </div>
            </form>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
