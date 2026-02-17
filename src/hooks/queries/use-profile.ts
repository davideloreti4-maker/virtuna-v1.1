"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queries/query-keys";
import type { UserProfile, NotificationPrefs } from "@/types/settings";

interface ProfileResponse {
  name: string;
  email: string;
  company: string;
  role: string;
  avatar: string | null;
  notifications: NotificationPrefs;
}

/**
 * QUERY: Fetch current user's profile and notification settings
 */
export function useProfile() {
  return useQuery({
    queryKey: queryKeys.profile.current(),
    queryFn: async () => {
      const res = await fetch("/api/profile");
      if (!res.ok) throw new Error("Failed to fetch profile");
      return res.json() as Promise<ProfileResponse>;
    },
  });
}

/**
 * MUTATION: Update profile fields (display_name, company, role)
 */
export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: Partial<Pick<UserProfile, "name" | "company" | "role">>) => {
      const body: Record<string, string> = {};
      if (updates.name !== undefined) body.display_name = updates.name;
      if (updates.company !== undefined) body.company = updates.company;
      if (updates.role !== undefined) body.role = updates.role;

      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update profile");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.profile.current() });
    },
  });
}

/**
 * MUTATION: Upload avatar
 */
export function useUploadAvatar() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/profile/avatar", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to upload avatar");
      }
      return res.json() as Promise<{ url: string }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.profile.current() });
    },
  });
}

/**
 * MUTATION: Update notification preferences
 */
export function useUpdateNotifications() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: Partial<NotificationPrefs>) => {
      const res = await fetch("/api/settings/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update notifications");
      }
      return res.json();
    },
    onMutate: async (updates) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.profile.current() });
      const previous = queryClient.getQueryData<ProfileResponse>(queryKeys.profile.current());

      queryClient.setQueryData<ProfileResponse>(queryKeys.profile.current(), (old) => {
        if (!old) return old;
        return {
          ...old,
          notifications: { ...old.notifications, ...updates },
        };
      });

      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.profile.current(), context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.profile.current() });
    },
  });
}

/**
 * MUTATION: Change password
 */
export function useChangePassword() {
  return useMutation({
    mutationFn: async (newPassword: string) => {
      const res = await fetch("/api/settings/account/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to change password");
      }
      return res.json();
    },
  });
}
