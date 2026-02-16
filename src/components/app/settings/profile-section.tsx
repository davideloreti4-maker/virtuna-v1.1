"use client";

import { useState, useEffect, useCallback } from "react";
import * as Avatar from "@radix-ui/react-avatar";
import { useSettingsStore } from "@/stores/settings-store";
import { Input } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

export function ProfileSection() {
  const profile = useSettingsStore((s) => s.profile);
  const updateProfile = useSettingsStore((s) => s.updateProfile);

  // Local form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState(profile.company || "");
  const [role, setRole] = useState(profile.role || "");
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);

  // Fetch real user data from Supabase on mount
  const fetchProfile = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        setError("Failed to load user data");
        setIsLoading(false);
        return;
      }

      setUserId(user.id);
      setEmail(user.email || "");

      // Fetch creator_profiles data
      const { data: profileData } = await supabase
        .from("creator_profiles")
        .select("display_name, bio, avatar_url")
        .eq("user_id", user.id)
        .maybeSingle();

      // Name: creator_profiles.display_name > user_metadata.full_name > email prefix
      const displayName =
        profileData?.display_name ||
        user.user_metadata?.full_name ||
        (user.email ? user.email.split("@")[0] : "");
      setName(displayName);

      if (profileData?.avatar_url) {
        setAvatarUrl(profileData.avatar_url);
      }
    } catch {
      setError("Failed to load profile");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // Sync company/role from store when it hydrates
  useEffect(() => {
    setCompany(profile.company || "");
    setRole(profile.role || "");
  }, [profile.company, profile.role]);

  const handleSave = async () => {
    if (!userId) return;

    setIsSaving(true);
    setError(null);

    try {
      const supabase = createClient();

      // Save display_name to Supabase creator_profiles
      const { error: upsertError } = await supabase
        .from("creator_profiles")
        .upsert(
          {
            user_id: userId,
            display_name: name,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );

      if (upsertError) {
        setError("Failed to save profile: " + upsertError.message);
        setIsSaving(false);
        return;
      }

      // Save company/role to localStorage via Zustand store
      updateProfile({ name, company, role });

      setIsSaving(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError("Failed to save profile");
      setIsSaving(false);
    }
  };

  // Get initials for avatar fallback
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .join("")
    .toUpperCase()
    .slice(0, 2);

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div>
          <h2 className="text-lg font-medium text-white">Profile</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Manage your personal information and how others see you.
          </p>
        </div>
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="h-20 w-20 animate-pulse rounded-full bg-zinc-800" />
            <div className="space-y-2">
              <div className="h-9 w-32 animate-pulse rounded-lg bg-zinc-800" />
              <div className="h-4 w-40 animate-pulse rounded bg-zinc-800" />
            </div>
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i}>
                <div className="mb-2 h-4 w-20 animate-pulse rounded bg-zinc-800" />
                <div className="h-[42px] animate-pulse rounded-lg bg-zinc-800" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-medium text-white">Profile</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Manage your personal information and how others see you.
        </p>
      </div>

      {/* Avatar */}
      <div className="flex items-center gap-4">
        <Avatar.Root className="h-20 w-20 overflow-hidden rounded-full bg-zinc-800">
          <Avatar.Image
            src={avatarUrl || profile.avatar}
            alt={name}
            className="h-full w-full object-cover"
          />
          <Avatar.Fallback className="flex h-full w-full items-center justify-center text-lg font-medium text-zinc-400">
            {initials}
          </Avatar.Fallback>
        </Avatar.Root>
        <div>
          <button
            type="button"
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
            onClick={() => {
              // TODO: Implement avatar upload
              console.log("Avatar upload not yet implemented");
            }}
          >
            Change avatar
          </button>
          <p className="mt-2 text-xs text-zinc-500">JPG, PNG or GIF. Max 2MB.</p>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <p className="text-sm text-red-400">{error}</p>
      )}

      {/* Form fields */}
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-medium text-zinc-300">
            Full name
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-zinc-300">
            Email address
          </label>
          <Input
            type="email"
            value={email}
            disabled
            className="opacity-70"
            placeholder="you@example.com"
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-zinc-300">
            Company
          </label>
          <Input
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="Your company"
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-zinc-300">
            Role
          </label>
          <Input
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="Your role"
          />
        </div>
      </div>

      {/* Save button */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="rounded-lg bg-white px-6 py-2.5 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-200 disabled:opacity-50"
        >
          {isSaving ? "Saving..." : "Save changes"}
        </button>
        {saved && (
          <span className="text-sm text-emerald-400">Changes saved!</span>
        )}
      </div>
    </div>
  );
}
