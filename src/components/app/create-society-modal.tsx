"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ArrowLeft, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSocietyStore, selectAddSociety } from "@/stores/society-store";
import type { TargetSociety } from "@/types/society";

interface CreateSocietyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateSocietyModal({ open, onOpenChange }: CreateSocietyModalProps) {
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const addSociety = useSocietyStore(selectAddSociety);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;

    setIsSubmitting(true);

    // Simulate AI matching delay (1.5s)
    await new Promise((r) => setTimeout(r, 1500));

    // Extract society name from description (first few words)
    const name = extractSocietyName(description);

    const newSociety: TargetSociety = {
      id: crypto.randomUUID(),
      name,
      description: description.trim(),
      type: 'target',
      societyType: 'custom',
      icon: 'briefcase',
      members: Math.floor(Math.random() * 500) + 50, // Mock member count
      createdAt: new Date().toISOString(),
    };

    addSociety(newSociety);
    setDescription("");
    setIsSubmitting(false);
    onOpenChange(false);
  };

  const handleBack = () => {
    if (!isSubmitting) {
      onOpenChange(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-[700px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-3xl border border-zinc-800 p-8 shadow-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
          style={{
            background: `linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92, 246, 0.1) 50%, rgba(59, 130, 246, 0.05) 100%), #18181B`,
          }}
        >
          {/* Back button */}
          <button
            type="button"
            onClick={handleBack}
            disabled={isSubmitting}
            className="absolute left-6 top-6 text-white transition-colors hover:text-zinc-400 disabled:opacity-50"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          <div className="mx-auto max-w-[500px] pt-8 text-center">
            {/* Heading */}
            <Dialog.Title className="mb-4 text-3xl font-semibold text-white">
              Who do you want in your society?
            </Dialog.Title>

            {/* Description */}
            <Dialog.Description className="mb-8 text-[15px] leading-relaxed text-zinc-400">
              Describe the people you want in your society. We&apos;ll match your description with AI personas from our database. Every AI persona is based on a real person.
            </Dialog.Description>

            {/* Form */}
            <form onSubmit={handleSubmit}>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Founders in London..."
                disabled={isSubmitting}
                className="mb-4 min-h-[80px] w-full resize-none rounded-xl border border-zinc-800 bg-[#18181B] px-5 py-4 text-[15px] text-white placeholder:text-zinc-600 focus:border-zinc-700 focus:outline-none disabled:opacity-50"
              />

              <button
                type="submit"
                disabled={!description.trim() || isSubmitting}
                className={cn(
                  "flex w-full items-center justify-center gap-2 rounded-xl bg-white px-8 py-4 text-[15px] font-medium text-zinc-900 transition-colors hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
                )}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Matching AI personas...
                  </>
                ) : (
                  "Create your society"
                )}
              </button>
            </form>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/**
 * Extract a society name from the description.
 * Takes the first 3-4 meaningful words.
 */
function extractSocietyName(description: string): string {
  const words = description.trim().split(/\s+/);
  // Remove common filler words
  const fillerWords = ['e.g.', 'e.g', 'eg', 'like', 'such', 'as', 'for', 'example'];
  const cleanWords = words.filter(w =>
    !fillerWords.includes(w.toLowerCase().replace(/[.,]/g, ''))
  );

  // Take first 3 words or up to 30 characters
  const name = cleanWords.slice(0, 3).join(' ');
  return name.length > 30 ? name.slice(0, 30).trim() + '...' : name;
}
