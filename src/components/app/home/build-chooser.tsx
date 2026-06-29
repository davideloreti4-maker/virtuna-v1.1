"use client";

/**
 * BuildChooser — the `+ Build an audience` chooser (UX-04 / D-03 / D-08).
 *
 * One entry, three paths, all converging on a saved named General SIM in the library:
 *  1. Description path → HOP to /audience/new?mode=general (D-08 — the deliberate one-time
 *     setup reuses the full calibration form; that page reads ?mode and presets the create
 *     POST to mode:'general' so the saved SIM lands in the General library).
 *  2. From evidence → stays in-composer; invokes `onEvidence` so the host opens the existing
 *     P5 profile-runner / evidence-drop (reuse, do NOT rebuild the profile flow).
 *  3. From a template → lists GENERAL_TEMPLATES (analyst / hiring) → clone-and-edit via
 *     `cloneTemplateAudience` (07-03) into an owned, editable General SIM, then selects it.
 *
 * Surface (UI-SPEC S3): a small centered Radix Dialog (radius 12, --charcoal-composer surface,
 * 6% border, --shadow-float). Matte only — no accent paint, no glass, no scrim blur class.
 * Built with the raw Radix primitives (not the Raycast-shine ui/dialog) for full matte control.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Article, Paperclip, Stack, CaretLeft } from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";
import type { Audience } from "@/lib/audience/audience-types";
import {
  GENERAL_TEMPLATES,
  cloneTemplateAudience,
} from "@/lib/audience/audience-repo";
import { resolveTier } from "@/lib/audience/resolve-tier";
import { cn } from "@/lib/utils";

interface BuildChooserProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Fired with the saved General SIM after a template clone (the description path navigates away). */
  onBuilt: (audience: Audience) => void;
  /** Optional — From evidence closes the chooser and asks the host to open the evidence-drop. */
  onEvidence?: () => void;
}

type View = "paths" | "templates" | "naming";

const NAME_CAP = 80;

const ROW_CLASS = cn(
  // 8px radius selectable row — matte, NO accent, hover-lift to #2f2e2b + 10% border.
  "flex w-full items-center gap-3 rounded-lg border border-white/[0.06] px-3 py-3 text-left",
  "text-foreground transition-colors hover:bg-[#2f2e2b] hover:border-white/[0.1]",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/10",
);

export function BuildChooser({
  open,
  onOpenChange,
  onBuilt,
  onEvidence,
}: BuildChooserProps) {
  const router = useRouter();
  const [view, setView] = useState<View>("paths");
  const [selected, setSelected] = useState<Audience | null>(null);
  const [name, setName] = useState("");
  const [cloning, setCloning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset to the paths view whenever the dialog is (re)opened — never resume mid-flow.
  useEffect(() => {
    if (open) {
      setView("paths");
      setSelected(null);
      setName("");
      setCloning(false);
      setError(null);
    }
  }, [open]);

  // ── Path 1 — description path (D-08): hop to the full create form, mode-preset ──
  function handleDescription() {
    onOpenChange(false);
    router.push("/audience/new?mode=general");
  }

  // ── Path 2 — From evidence: reuse the in-composer evidence-drop (do not rebuild) ──
  function handleEvidence() {
    onOpenChange(false);
    onEvidence?.();
  }

  // ── Path 3 — From a template: pick → name → clone-and-edit ────────────────────
  function handlePickTemplate(tpl: Audience) {
    setSelected(tpl);
    setName(tpl.name.slice(0, NAME_CAP));
    setError(null);
    setView("naming");
  }

  async function handleCloneTemplate() {
    if (!selected || !name.trim()) {
      setError("Name is required.");
      return;
    }
    setCloning(true);
    setError(null);
    try {
      // Session-scoped clone (CR-01): user_id is re-derived inside createAudience; the
      // sentinel id + virtual user_id are stripped by the helper (T-07-05-01).
      const saved = await cloneTemplateAudience(
        createClient(),
        selected.id,
        name.trim(),
      );
      onBuilt(saved);
      onOpenChange(false);
    } catch {
      setError("Could not build the audience. Please try again.");
    } finally {
      setCloning(false);
    }
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        {/* Matte scrim — no blur class (Lightning-CSS strips it; none needed here). */}
        <DialogPrimitive.Overlay className="fixed inset-0 z-[var(--z-modal-backdrop)] bg-black/60 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-[50%] top-[50%] z-[var(--z-modal)] w-full max-w-sm translate-x-[-50%] translate-y-[-50%]",
            // radius 12 + matte charcoal-composer surface + 6% border + float shadow
            "rounded-xl border border-white/[0.06] bg-[var(--color-charcoal-composer)] p-6 shadow-[var(--shadow-float)]",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          )}
        >
          {/* Title — 14/500/cream (UI-SPEC typography) */}
          <div className="flex items-center gap-2">
            {view !== "paths" && (
              <button
                type="button"
                onClick={() => setView(view === "naming" ? "templates" : "paths")}
                aria-label="Back"
                className="rounded-md p-1 text-foreground-muted transition-colors hover:bg-[#2f2e2b] hover:text-foreground"
              >
                <CaretLeft className="h-4 w-4" weight="regular" />
              </button>
            )}
            <DialogPrimitive.Title className="text-sm font-medium text-foreground">
              Build an audience
            </DialogPrimitive.Title>
          </div>

          {/* Paths view — three full-width rows, 16px gap, matte, NO accent */}
          {view === "paths" && (
            <div className="mt-5 flex flex-col gap-4">
              <button type="button" onClick={handleDescription} className={ROW_CLASS}>
                <Article className="h-5 w-5 shrink-0 text-foreground-muted" weight="regular" />
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm text-foreground">From a description</span>
                  <span className="text-[12px] text-foreground-muted">
                    Calibrate a General audience from a written brief.
                  </span>
                </span>
              </button>

              <button type="button" onClick={handleEvidence} className={ROW_CLASS}>
                <Paperclip className="h-5 w-5 shrink-0 text-foreground-muted" weight="regular" />
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm text-foreground">From evidence</span>
                  <span className="text-[12px] text-foreground-muted">
                    Drop a chat, screenshot, or clip — Profile bakes a SIM.
                  </span>
                </span>
              </button>

              <button type="button" onClick={() => setView("templates")} className={ROW_CLASS}>
                <Stack className="h-5 w-5 shrink-0 text-foreground-muted" weight="regular" />
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm text-foreground">From a template</span>
                  <span className="text-[12px] text-foreground-muted">
                    Clone a ready-made panel and edit it.
                  </span>
                </span>
              </button>
            </div>
          )}

          {/* Templates view — GENERAL_TEMPLATES + neutral Directional badge */}
          {view === "templates" && (
            <div className="mt-5 flex flex-col gap-3">
              {GENERAL_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => handlePickTemplate(tpl)}
                  className={ROW_CLASS}
                >
                  <Stack className="h-5 w-5 shrink-0 text-foreground-muted" weight="regular" />
                  <span className="flex-1 text-sm text-foreground">{tpl.name}</span>
                  <span className="text-[11px] font-medium text-foreground-muted">
                    {resolveTier(tpl)}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Naming view — auto-named, editable, cap 80 → clone-and-edit */}
          {view === "naming" && (
            <div className="mt-5 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="build-name" className="text-sm text-foreground-secondary">
                  Name your audience
                </label>
                <input
                  id="build-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={NAME_CAP}
                  placeholder="e.g. Analyst Panel"
                  className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/10"
                />
              </div>

              {error && (
                <p className="rounded-lg border border-error/20 bg-error/10 px-3 py-2 text-sm text-error">
                  {error}
                </p>
              )}

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setView("templates")}
                  disabled={cloning}
                  className="rounded-lg border border-white/[0.06] px-3 py-2 text-sm text-foreground-secondary transition-colors hover:bg-[#2f2e2b] hover:text-foreground disabled:opacity-50"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => void handleCloneTemplate()}
                  disabled={cloning || !name.trim()}
                  className="rounded-lg border border-white/[0.1] bg-[#2f2e2b] px-3 py-2 text-sm font-medium text-foreground transition-colors hover:border-white/[0.16] disabled:opacity-50"
                >
                  {cloning ? "Building…" : "Build audience"}
                </button>
              </div>
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
