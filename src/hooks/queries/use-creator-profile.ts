"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";

import { queryKeys } from "@/lib/queries/query-keys";

/**
 * Shape of GET /api/profile/creator-profile — the 14 9-card columns plus
 * `profile_interview_seen_at`. Matches the route's GET_COLUMNS whitelist 1:1.
 */
export interface CreatorProfileResponse {
  profile_interview_seen_at: string | null;
  target_platforms: string[] | null;
  niche_primary: string | null;
  niche_sub: string | null;
  target_audience: {
    age_range: string | null;
    gender_skew: string | null;
    geo: string | null;
    language: string | null;
  } | null;
  primary_goal: string | null;
  creator_stage: string | null;
  content_style: string | null;
  cuts_per_second: string | null;
  reference_creators: Array<{ handle_or_url: string }> | null;
  past_wins: Array<{ url: string }> | null;
  past_flops: Array<{ url: string }> | null;
  posting_frequency: string | null;
  time_of_day_aware: boolean | null;
  pain_points: string | null;
  storage_retention_opted_in?: boolean | null;
}

/**
 * QUERY: Fetch the current user's 9-card creator-profile row.
 *
 * Used by the settings form (PROFILE-15), the modal gate hook
 * (PROFILE-14, Plan 02-04, `usePendingProfileGate`), and any other consumer
 * that needs to read the 9-card columns. One query key — single cache
 * namespace — so a settings save instantly refreshes the gate (CR-01).
 *
 * `refetchOnWindowFocus: false` because this is settings data, not real-time
 * — refetching on focus would clobber in-flight edits in the settings form
 * (CR-04). `staleTime` of 5 minutes keeps the surface snappy without losing
 * cross-tab freshness via explicit invalidations from the mutation hook.
 */
export function useCreatorProfile(): UseQueryResult<
  CreatorProfileResponse,
  Error
> {
  return useQuery({
    queryKey: queryKeys.profile.creatorProfile(),
    queryFn: async () => {
      const res = await fetch("/api/profile/creator-profile");
      if (!res.ok) throw new Error("Failed to fetch creator profile");
      return res.json() as Promise<CreatorProfileResponse>;
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

/**
 * MUTATION: PATCH a partial creator-profile update. Invalidates the shared
 * profile/creator-profile cache so the settings form and the modal gate
 * hook both observe the new row on the next render.
 */
export function useUpdateCreatorProfile(): UseMutationResult<
  { success: true },
  Error,
  Partial<CreatorProfileResponse>
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: Partial<CreatorProfileResponse>) => {
      const res = await fetch("/api/profile/creator-profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update creator profile");
      }
      return res.json() as Promise<{ success: true }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.profile.creatorProfile(),
      });
    },
  });
}
