"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queries/query-keys";

interface TeamMemberResponse {
  id: string;
  team_id: string;
  user_id: string | null;
  role: "owner" | "admin" | "member";
  invited_email: string | null;
  status: "invited" | "active";
  joined_at: string | null;
  created_at: string;
}

interface TeamResponse {
  team: {
    id: string;
    owner_id: string;
    name: string;
    created_at: string;
  };
  members: TeamMemberResponse[];
  currentUserId: string;
}

/**
 * QUERY: Fetch current user's team and members
 */
export function useTeam() {
  return useQuery({
    queryKey: queryKeys.team.current(),
    queryFn: async () => {
      const res = await fetch("/api/team");
      if (!res.ok) throw new Error("Failed to fetch team");
      return res.json() as Promise<TeamResponse>;
    },
  });
}

/**
 * MUTATION: Invite a team member by email
 */
export function useInviteTeamMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (email: string) => {
      const res = await fetch("/api/team/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to invite member");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.team.current() });
    },
  });
}

/**
 * MUTATION: Update a team member's role
 */
export function useUpdateMemberRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ memberId, role }: { memberId: string; role: "admin" | "member" }) => {
      const res = await fetch(`/api/team/members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update role");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.team.current() });
    },
  });
}

/**
 * MUTATION: Remove a team member
 */
export function useRemoveTeamMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (memberId: string) => {
      const res = await fetch(`/api/team/members/${memberId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to remove member");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.team.current() });
    },
  });
}
