"use client";

/**
 * ProjectPicker — "Save to" / "Move to project" destination popover (sketch rev 5, screen 05).
 *
 * One component for all three callers: the shelf's selection bar, a row's expansion, and the
 * in-thread save. They differ only in what they do with the chosen destination.
 *
 * THE DEFAULT IS INFERRED, NEVER REMEMBERED. When a thread already feeds a project, that project
 * is preselected and badged "this thread". "Last used" was the obvious alternative and is wrong:
 * it would quietly file a hook into a project you touched weeks ago, and the user would not find
 * out until they went looking for it. Inference is visible; memory is silent.
 */

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Plus } from "@phosphor-icons/react";
import { useLibraryProjects, useCreateProject } from "@/hooks/queries/use-library-projects";
import { useToast } from "@/components/ui/toast";
import type { SavedItem } from "@/lib/shelf/shelf-repo";
import { cn } from "@/lib/utils";

export interface ProjectPickerProps {
  /** Currently owning project (null = Unfiled), so the picker can show a check. */
  currentProjectId?: string | null;
  /**
   * The thread the item(s) came from. If that thread already feeds a project, it becomes the
   * badged default — the whole reason saves now carry a thread_id.
   */
  threadId?: string | null;
  /** Every saved row, used to infer which project this thread already feeds. */
  items: SavedItem[];
  /** Per-project item counts, so a destination can show its size. */
  countFor: (projectId: string) => number;
  onPick: (projectId: string | null) => void;
  onClose: () => void;
  /** Label for the "no project" row — "Library — unfiled" on save, "Remove from project" inside one. */
  unfiledLabel?: string;
}

/**
 * Which project does this thread already feed? The most-recently-saved item from this thread that
 * has a project wins — if a thread's output has been filed into two projects, the newest is the
 * live intent.
 */
export function inferProjectForThread(items: SavedItem[], threadId: string | null | undefined): string | null {
  if (!threadId) return null;
  const fromThread = items
    .filter((i) => i.thread_id === threadId && i.project_id)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  return fromThread[0]?.project_id ?? null;
}

/**
 * ProjectPickerPopover — the picker, PORTALED to document.body and anchored to a trigger.
 *
 * ⚠️ It must not render inside the page tree, and this was found by driving the real UI rather
 * than by reading it: the first build positioned the panel `absolute … z-30` next to its trigger,
 * and Playwright could not click "Create" — "a <span>5 days ago</span> from a <div class='rv-in'>
 * subtree intercepts pointer events".
 *
 * The cause is `.rv-in`, the surface's entrance animation: it animates a transform, which creates
 * a STACKING CONTEXT. The projects section and the shelf below it are both `.rv-in` siblings, so a
 * z-index inside the first can never beat the second — z-index only orders within a context. No
 * value of z-30/z-50/z-999 on the child would have fixed it. Portaling escapes the context
 * entirely, which is the only real fix.
 *
 * Also closes on outside-click and Escape, and repositions on scroll/resize — the things an
 * absolutely-positioned div silently did not do.
 */
export function ProjectPickerPopover({
  anchorEl,
  align = "left",
  ...props
}: ProjectPickerProps & { anchorEl: HTMLElement | null; align?: "left" | "right" }) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  // Measure before paint so the panel never renders at 0,0 and jumps.
  useLayoutEffect(() => {
    if (!anchorEl) return;
    const place = () => {
      const a = anchorEl.getBoundingClientRect();
      const width = panelRef.current?.offsetWidth ?? 300;
      const height = panelRef.current?.offsetHeight ?? 320;
      // Flip above the trigger when there is not room below — a 320px panel opened from a row
      // near the fold would otherwise run off screen with its Create button unreachable.
      const below = a.bottom + 8;
      const flip = below + height > window.innerHeight - 12;
      setPos({
        top: flip ? Math.max(12, a.top - height - 8) : below,
        left:
          align === "right"
            ? Math.max(12, Math.min(a.right - width, window.innerWidth - width - 12))
            : Math.max(12, Math.min(a.left, window.innerWidth - width - 12)),
      });
    };
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [anchorEl, align]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || anchorEl?.contains(t)) return;
      props.onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") props.onClose();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onClose identity churns per render
  }, [anchorEl]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={panelRef}
      style={{
        position: "fixed",
        top: pos?.top ?? -9999,
        left: pos?.left ?? -9999,
        zIndex: "var(--z-modal)",
      }}
    >
      <ProjectPicker {...props} />
    </div>,
    document.body,
  );
}

export function ProjectPicker({
  currentProjectId = null,
  threadId,
  items,
  countFor,
  onPick,
  onClose,
  unfiledLabel = "Library — unfiled",
}: ProjectPickerProps) {
  const { data } = useLibraryProjects();
  const create = useCreateProject();
  const { toast } = useToast();
  const [newName, setNewName] = useState("");

  const projects = useMemo(() => data?.projects ?? [], [data]);
  const inferredId = useMemo(() => inferProjectForThread(items, threadId), [items, threadId]);

  const handleCreate = () => {
    const name = newName.trim();
    if (!name || create.isPending) return;
    create.mutate(name, {
      onSuccess: ({ project }) => {
        setNewName("");
        onPick(project.id);
      },
      // The 409 message names the collision ("a project named X already exists"), which is more
      // useful than a generic failure — pass it through.
      onError: (err) => toast({ variant: "error", title: err.message }),
    });
  };

  return (
    <div
      className="w-[300px] rounded-[14px] border border-white/[0.10] p-2 shadow-[0_12px_32px_rgba(0,0,0,0.4)]"
      style={{ backgroundColor: "var(--color-charcoal-chip)" }}
      role="dialog"
      aria-label="Choose a project"
    >
      <p className="px-3 pb-2 pt-2.5 text-caption font-semibold uppercase tracking-[0.14em] text-foreground-muted">
        Save to
      </p>

      <div className="max-h-[260px] overflow-y-auto">
        {projects.map((project) => {
          const isCurrent = project.id === currentProjectId;
          const isInferred = project.id === inferredId;
          return (
            <button
              key={project.id}
              type="button"
              onClick={() => onPick(project.id)}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-[9px] px-3 py-2.5 text-left text-reading transition-colors",
                "hover:bg-white/[0.055] focus-visible:outline-none focus-visible:bg-white/[0.055]",
                (isCurrent || isInferred) && "bg-white/[0.055]",
              )}
            >
              <span className="min-w-0 flex-1 truncate text-foreground">{project.name}</span>
              {isInferred && !isCurrent && (
                <span className="shrink-0 rounded-[5px] border border-white/[0.06] px-1.5 py-0.5 text-caption text-foreground-muted">
                  this thread
                </span>
              )}
              {isCurrent ? (
                <Check size={13} weight="bold" className="shrink-0 text-accent" />
              ) : (
                <span className="shrink-0 text-body tabular-nums text-foreground-muted">
                  {countFor(project.id)}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mx-2.5 my-1.5 h-px bg-white/[0.06]" />

      <button
        type="button"
        onClick={() => onPick(null)}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-[9px] px-3 py-2.5 text-left text-reading transition-colors",
          "hover:bg-white/[0.055] focus-visible:outline-none focus-visible:bg-white/[0.055]",
          currentProjectId === null && "bg-white/[0.055]",
        )}
      >
        <span className="flex-1 text-foreground">{unfiledLabel}</span>
        {currentProjectId === null && (
          <Check size={13} weight="bold" className="shrink-0 text-accent" />
        )}
      </button>

      <div className="mx-2.5 my-1.5 h-px bg-white/[0.06]" />

      <div className="flex items-center gap-2 p-1.5">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleCreate();
            if (e.key === "Escape") onClose();
          }}
          placeholder="New project…"
          aria-label="New project name"
          maxLength={80}
          className="min-w-0 flex-1 rounded-[8px] border border-white/[0.06] bg-surface px-2.5 py-2 text-reading text-foreground placeholder:text-foreground-muted focus:border-white/[0.10] focus:outline-none"
        />
        <button
          type="button"
          onClick={handleCreate}
          disabled={!newName.trim() || create.isPending}
          className={cn(
            "flex shrink-0 items-center gap-1 rounded-[8px] border border-white/[0.10] bg-surface px-2.5 py-2 text-body text-foreground transition-opacity",
            "disabled:opacity-40",
          )}
        >
          <Plus size={12} weight="bold" aria-hidden="true" />
          {create.isPending ? "…" : "Create"}
        </button>
      </div>
    </div>
  );
}
