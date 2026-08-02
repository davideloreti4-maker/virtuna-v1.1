"use client";

/**
 * ProjectDetail — inside one Library project (sketch rev 5, screen 04).
 *
 * §R5-7 GROUPED BY TYPE IN PIPELINE ORDER: outliers → ideas → remixes → hooks → scripts → reads.
 * What you found, what you thought of, what you adapted, what you wrote, what you built, what
 * judged it. Grouping replaces the filter row entirely — at project scale that is both fewer
 * controls and a truer picture.
 *
 * Rev 4 asserted "reads in working order" but drew only Hooks → Scripts → Read, omitted Ideas
 * altogether, and claimed 8 items while drawing 5. An empty group is omitted, never drawn empty.
 *
 * MANUAL ORDERING WAS CONSIDERED AND DROPPED. For a launch video, hook → script → read is a
 * sequence rather than a set, so drag-to-order was tempting; the pipeline already tells that story
 * without a `position` column, a drag library, or the reconciliation that reordering under
 * optimistic updates needs. Revisit only if the fixed order proves wrong in use.
 */

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CaretLeft, DotsThree, PencilSimple, Trash } from "@phosphor-icons/react";
import { useSavedItems, useDeleteSavedItem, useFileSavedItems } from "@/hooks/queries/use-saved-items";
import {
  useLibraryProjects,
  useRenameProject,
  useDeleteProject,
  useProjectRollups,
  rollupFor,
} from "@/hooks/queries/use-library-projects";
import { useThreadList } from "@/hooks/queries/use-threads";
import { useOpenThread } from "@/hooks/useOpenThread";
import { useToast } from "@/components/ui/toast";
import type { SavedItem } from "@/lib/shelf/shelf-repo";
import { cn } from "@/lib/utils";
import { SavedRow } from "./saved-row";
import { ShelfSkeleton } from "./saved-shelf";
import { FORWARD, PIPELINE_ORDER, TYPE_PLURAL, buildRowVM } from "./saved-item-vm";

export function ProjectDetail({ projectId }: { projectId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const openThread = useOpenThread();

  const { data, isLoading } = useSavedItems();
  const { data: projectData, isLoading: projectsLoading } = useLibraryProjects();
  const { data: threads } = useThreadList();
  const remove = useDeleteSavedItem();
  const file = useFileSavedItems();
  const rename = useRenameProject();
  const destroy = useDeleteProject();

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState("");

  const items = useMemo<SavedItem[]>(() => data?.items ?? [], [data]);
  const projects = useMemo(() => projectData?.projects ?? [], [projectData]);
  const project = projects.find((p) => p.id === projectId);
  const rollups = useProjectRollups(items);
  const roll = rollupFor(rollups, projectId);

  const mine = useMemo(
    () => items.filter((i) => i.project_id === projectId),
    [items, projectId],
  );

  const threadTitles = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of threads ?? []) if (t.title) map.set(t.id, t.title);
    return map;
  }, [threads]);

  const sourceLabelFor = useCallback(
    (item: SavedItem): string | undefined => {
      if (item.thread_id) return threadTitles.get(item.thread_id) ?? "A thread";
      if (item.item_type === "outlier") return "Discover";
      return undefined;
    },
    [threadTitles],
  );

  // Reserved ACROSS groups, not per group — otherwise the rail would align inside Hooks and inside
  // Scripts but at two different x positions, which reads worse than not aligning at all.
  const reserveThumb = useMemo(() => mine.some((i) => buildRowVM(i).coverUrl), [mine]);
  const reserveAction = useMemo(
    () => mine.some((i) => FORWARD[i.item_type] !== undefined),
    [mine],
  );

  /** Groups in pipeline order, empties omitted. */
  const groups = useMemo(
    () =>
      PIPELINE_ORDER.map((type) => ({
        type,
        label: TYPE_PLURAL[type],
        rows: mine
          .filter((i) => i.item_type === type)
          .sort((a, b) => (a.created_at < b.created_at ? 1 : -1)),
      })).filter((g) => g.rows.length > 0),
    [mine],
  );

  if (isLoading || projectsLoading) return <ShelfSkeleton />;

  // A deleted project, or an id belonging to someone else — the API 404s either way, and so does
  // this: never confirm that a project we cannot see exists.
  if (!project) {
    return (
      <div className="flex flex-col gap-4">
        <BackToLibrary onClick={() => router.push("/library")} />
        <p className="text-reading text-foreground-muted">
          That project doesn&rsquo;t exist, or it isn&rsquo;t yours.
        </p>
      </div>
    );
  }

  const handleRename = () => {
    const name = draftName.trim();
    setRenaming(false);
    if (!name || name === project.name) return;
    rename.mutate(
      { id: projectId, name },
      { onError: (err) => toast({ variant: "error", title: err.message }) },
    );
  };

  const handleDelete = () => {
    destroy.mutate(projectId, {
      onSuccess: () => {
        // The items survive — ON DELETE SET NULL unfiles them. Say so, or deleting a folder reads
        // like deleting the work inside it.
        toast({
          variant: "success",
          title:
            roll.total > 0
              ? `Project deleted — ${roll.total} item${roll.total === 1 ? "" : "s"} moved to Unfiled`
              : "Project deleted",
        });
        router.push("/library");
      },
      onError: () => toast({ variant: "error", title: "Couldn't delete this project." }),
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {/* ── header ─────────────────────────────────────────────────────────── */}
      <div className="rv-in flex items-start justify-between gap-6" style={{ animationDelay: "0.02s" }}>
        <div className="min-w-0">
          {/* §R5-8 the crumb carries the project's NAME. Rev 4 printed the literal word "Project". */}
          <nav className="mb-2.5 flex items-center gap-2.5 text-body text-foreground-muted">
            <button
              type="button"
              onClick={() => router.push("/library")}
              className="text-foreground-secondary hover:text-foreground focus-visible:outline-none"
            >
              Library
            </button>
            <span className="opacity-50" aria-hidden="true">
              ›
            </span>
            <span className="truncate">{project.name}</span>
          </nav>

          {renaming ? (
            <input
              autoFocus
              value={draftName}
              maxLength={80}
              onChange={(e) => setDraftName(e.target.value)}
              onBlur={handleRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRename();
                if (e.key === "Escape") setRenaming(false);
              }}
              aria-label="Project name"
              className="w-full rounded-[8px] border border-white/[0.10] bg-surface px-2.5 py-1 text-subhead font-semibold lg:text-heading text-foreground focus:outline-none"
            />
          ) : (
            <h1 className="truncate text-subhead font-semibold lg:text-heading text-foreground">
              {project.name}
            </h1>
          )}

          {/* The subtitle counts THREADS as well as items, because a project legitimately spans
              several and that is the fact a per-thread filter would hide. */}
          <p className="mt-[5px] text-reading text-foreground-muted">
            {roll.total} item{roll.total === 1 ? "" : "s"}
            {roll.threadCount > 0 &&
              ` from ${roll.threadCount} thread${roll.threadCount === 1 ? "" : "s"}`}
            {` · updated ${new Date(project.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
          </p>
        </div>

        <div className="relative pt-[22px]">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Project options"
            className="rounded-[6px] p-1 text-foreground-muted transition-colors hover:bg-white/[0.06] hover:text-foreground"
          >
            <DotsThree size={20} weight="bold" />
          </button>
          {menuOpen && (
            <div
              className="absolute right-0 top-[calc(100%+6px)] z-30 w-[196px] rounded-[12px] border border-white/[0.10] p-1.5 shadow-[0_12px_32px_rgba(0,0,0,0.4)]"
              style={{ backgroundColor: "var(--color-charcoal-chip)" }}
              role="menu"
            >
              <MenuItem
                onClick={() => {
                  setDraftName(project.name);
                  setRenaming(true);
                  setMenuOpen(false);
                }}
              >
                <PencilSimple size={14} aria-hidden="true" />
                Rename
              </MenuItem>
              <MenuItem
                danger
                onClick={() => {
                  setMenuOpen(false);
                  handleDelete();
                }}
              >
                <Trash size={14} aria-hidden="true" />
                Delete project
              </MenuItem>
              <p className="px-2.5 pb-1 pt-1.5 text-caption leading-snug text-foreground-muted">
                Deleting keeps every saved item — they move back to Unfiled.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── grouped rows ───────────────────────────────────────────────────── */}
      {groups.length === 0 ? (
        <div className="rv-in px-3 py-10" style={{ animationDelay: "0.06s" }}>
          <p className="text-reading text-foreground-muted">
            Nothing filed here yet. Select items on your Library shelf and move them in.
          </p>
        </div>
      ) : (
        groups.map((group, gi) => (
          <div key={group.type} className={cn("rv-in", gi > 0 && "mt-4")} style={{ animationDelay: `${0.06 + gi * 0.03}s` }}>
            <p className="mb-3.5 px-3 text-caption font-semibold uppercase tracking-[0.14em] text-foreground-muted">
              {group.label}
            </p>
            <div className="-mx-3 flex flex-col gap-0.5">
              {group.rows.map((item) => (
                <SavedRow
                  key={item.id}
                  item={item}
                  sourceLabel={sourceLabelFor(item)}
                  projectName={project.name}
                  expanded={expandedId === item.id}
                  onToggleExpand={() => setExpandedId((cur) => (cur === item.id ? null : item.id))}
                  // Selection lives on the shelf; inside a project the useful action is filing OUT.
                  selectMode={false}
                  selected={false}
                  onSelectToggle={() => {}}
                  onUnsave={() =>
                    remove.mutate(item.id, {
                      onSuccess: () =>
                        toast({ variant: "success", title: "Removed from your Library" }),
                      onError: () =>
                        toast({ variant: "error", title: "Couldn't remove this item." }),
                    })
                  }
                  onMoveToProject={() =>
                    file.mutate(
                      { ids: [item.id], projectId: null },
                      {
                        onSuccess: () =>
                          toast({ variant: "success", title: "Moved to Unfiled" }),
                        onError: () =>
                          toast({ variant: "error", title: "Couldn't move this item." }),
                      },
                    )
                  }
                  onOpenThread={item.thread_id ? () => openThread(item.thread_id!) : undefined}
                  reserveThumb={reserveThumb}
                  reserveAction={reserveAction}
                />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function BackToLibrary({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 self-start text-body text-foreground-secondary hover:text-foreground"
    >
      <CaretLeft size={13} aria-hidden="true" />
      Library
    </button>
  );
}

function MenuItem({
  children,
  onClick,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-left text-reading transition-colors hover:bg-white/[0.055]",
        danger ? "text-[color:var(--color-error)]" : "text-foreground",
      )}
    >
      {children}
    </button>
  );
}
