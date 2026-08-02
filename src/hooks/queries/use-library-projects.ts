"use client";

/**
 * use-library-projects — react-query hooks for Library projects (lane/library-rework).
 *
 * Mirrors use-saved-items.ts: a list query plus create/rename/delete mutations with optimistic
 * cache updates.
 *
 * NO COUNTS COME FROM HERE. The shelf already holds every saved row from `useSavedItems`, so
 * per-project counts and type breakdowns are derived from that single list — see
 * `projectCounts` below. Serving the same number twice is how two numbers that must agree
 * start disagreeing.
 */

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queries/query-keys";
import type { LibraryProject } from "@/lib/shelf/projects-repo";
import type { SavedItem, SavedItemType } from "@/lib/shelf/shelf-repo";

interface ProjectsResponse {
  projects: LibraryProject[];
}

/** QUERY: the caller's projects, most recently touched first. */
export function useLibraryProjects() {
  return useQuery({
    queryKey: queryKeys.libraryProjects.list(),
    queryFn: async () => {
      const res = await fetch("/api/projects");
      if (!res.ok) throw new Error("Failed to fetch projects");
      return res.json() as Promise<ProjectsResponse>;
    },
  });
}

/** MUTATION: create a project. Rejects a duplicate name with a 409 the caller can surface. */
export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        // 409 is a real, actionable answer ("that name is taken"), not a generic failure —
        // pass the server's own message through so the picker can say it.
        throw new Error(body?.error ?? "Failed to create project");
      }
      return (await res.json()) as { project: LibraryProject };
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.libraryProjects.all });
    },
  });
}

/** MUTATION: rename a project. */
export function useRenameProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const res = await fetch(`/api/projects/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Failed to rename project");
      }
      return (await res.json()) as { project: LibraryProject };
    },
    onMutate: async ({ id, name }) => {
      const key = queryKeys.libraryProjects.list();
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<ProjectsResponse>(key);
      queryClient.setQueryData<ProjectsResponse>(key, (old) => ({
        projects: (old?.projects ?? []).map((p) => (p.id === id ? { ...p, name } : p)),
      }));
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.libraryProjects.list(), context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.libraryProjects.all });
    },
  });
}

/**
 * MUTATION: delete a project.
 *
 * The folder only — `saved_items.project_id` is ON DELETE SET NULL, so its items are unfiled
 * and reappear under Unfiled. The saved-items list is invalidated for exactly that reason.
 */
export function useDeleteProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/projects/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete project");
      return { id };
    },
    onMutate: async (id) => {
      const key = queryKeys.libraryProjects.list();
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<ProjectsResponse>(key);
      queryClient.setQueryData<ProjectsResponse>(key, (old) => ({
        projects: (old?.projects ?? []).filter((p) => p.id !== id),
      }));
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.libraryProjects.list(), context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.libraryProjects.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.saved.all });
    },
  });
}

// ─── Derived counts (client-side, from the saved list the shelf already has) ──

/** Per-project rollup: total, per-type breakdown, distinct source threads, newest save. */
export interface ProjectRollup {
  total: number;
  byType: Partial<Record<SavedItemType, number>>;
  threadCount: number;
  newestSavedAt: string | null;
}

/** An empty rollup — so a project with no items still renders a shape rather than undefined. */
const EMPTY: ProjectRollup = { total: 0, byType: {}, threadCount: 0, newestSavedAt: null };

/**
 * Roll up saved items by project id. `null` is the Unfiled shelf and gets the key `"unfiled"`,
 * which cannot collide with a uuid.
 */
export function rollUpByProject(items: SavedItem[]): Record<string, ProjectRollup> {
  const out: Record<string, ProjectRollup & { threads?: Set<string> }> = {};

  for (const item of items) {
    const key = item.project_id ?? "unfiled";
    const bucket = (out[key] ??= { ...EMPTY, byType: {}, threads: new Set<string>() });
    bucket.total += 1;
    bucket.byType[item.item_type] = (bucket.byType[item.item_type] ?? 0) + 1;
    if (item.thread_id) bucket.threads!.add(item.thread_id);
    if (!bucket.newestSavedAt || item.created_at > bucket.newestSavedAt) {
      bucket.newestSavedAt = item.created_at;
    }
  }

  for (const bucket of Object.values(out)) {
    bucket.threadCount = bucket.threads?.size ?? 0;
    delete bucket.threads;
  }

  return out;
}

/** Hook form of {@link rollUpByProject}, memoised on the items array. */
export function useProjectRollups(items: SavedItem[]): Record<string, ProjectRollup> {
  return useMemo(() => rollUpByProject(items), [items]);
}

/** The rollup for one key, or an empty one — never undefined at a call site. */
export function rollupFor(
  rollups: Record<string, ProjectRollup>,
  key: string,
): ProjectRollup {
  return rollups[key] ?? EMPTY;
}
