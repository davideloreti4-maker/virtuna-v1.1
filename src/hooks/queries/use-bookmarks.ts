"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queries/query-keys";

interface BookmarksResponse {
  video_ids: string[];
}

/**
 * QUERY: Fetch all bookmarked video IDs for the current user
 */
export function useBookmarks() {
  return useQuery({
    queryKey: queryKeys.bookmarks.list(),
    queryFn: async () => {
      const res = await fetch("/api/bookmarks");
      if (!res.ok) throw new Error("Failed to fetch bookmarks");
      return res.json() as Promise<BookmarksResponse>;
    },
  });
}

/**
 * MUTATION: Toggle bookmark (add or remove)
 */
export function useToggleBookmark() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      videoId,
      isCurrentlyBookmarked,
    }: {
      videoId: string;
      isCurrentlyBookmarked: boolean;
    }) => {
      if (isCurrentlyBookmarked) {
        const res = await fetch(
          `/api/bookmarks?video_id=${encodeURIComponent(videoId)}`,
          { method: "DELETE" }
        );
        if (!res.ok) throw new Error("Failed to remove bookmark");
      } else {
        const res = await fetch("/api/bookmarks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ video_id: videoId }),
        });
        if (!res.ok) throw new Error("Failed to add bookmark");
      }
      return { videoId, isCurrentlyBookmarked };
    },
    onMutate: async ({ videoId, isCurrentlyBookmarked }) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.bookmarks.list(),
      });

      const previous = queryClient.getQueryData<BookmarksResponse>(
        queryKeys.bookmarks.list()
      );

      queryClient.setQueryData<BookmarksResponse>(
        queryKeys.bookmarks.list(),
        (old) => {
          if (!old) return { video_ids: isCurrentlyBookmarked ? [] : [videoId] };
          const ids = isCurrentlyBookmarked
            ? old.video_ids.filter((id) => id !== videoId)
            : [...old.video_ids, videoId];
          return { video_ids: ids };
        }
      );

      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          queryKeys.bookmarks.list(),
          context.previous
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.bookmarks.list(),
      });
    },
  });
}
