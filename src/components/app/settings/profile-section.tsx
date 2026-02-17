"use client";

import { useState, useEffect, useRef } from "react";
import * as Avatar from "@radix-ui/react-avatar";
import { useProfile, useUpdateProfile, useUploadAvatar } from "@/hooks/queries/use-profile";
import { Input } from "@/components/ui";

export function ProfileSection() {
  const { data: profile, isLoading } = useProfile();
  const updateProfile = useUpdateProfile();
  const uploadAvatar = useUploadAvatar();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Local form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [saved, setSaved] = useState(false);

  // Sync local state when profile loads
  useEffect(() => {
    if (profile) {
      setName(profile.name);
      setEmail(profile.email);
      setCompany(profile.company || "");
      setRole(profile.role || "");
    }
  }, [profile]);

  const handleSave = async () => {
    await updateProfile.mutateAsync({ name, company, role });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadAvatar.mutateAsync(file);
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
      <div className="space-y-8 animate-pulse">
        <div>
          <div className="h-6 w-24 rounded bg-zinc-800" />
          <div className="mt-2 h-4 w-64 rounded bg-zinc-800" />
        </div>
        <div className="flex items-center gap-4">
          <div className="h-20 w-20 rounded-full bg-zinc-800" />
          <div className="h-9 w-32 rounded-lg bg-zinc-800" />
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i}>
              <div className="mb-2 h-4 w-20 rounded bg-zinc-800" />
              <div className="h-10 rounded-lg bg-zinc-800" />
            </div>
          ))}
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
            src={profile?.avatar || undefined}
            alt={name}
            className="h-full w-full object-cover"
          />
          <Avatar.Fallback className="flex h-full w-full items-center justify-center text-lg font-medium text-zinc-400">
            {initials}
          </Avatar.Fallback>
        </Avatar.Root>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            className="hidden"
            onChange={handleAvatarChange}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadAvatar.isPending}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50"
          >
            {uploadAvatar.isPending ? "Uploading..." : "Change avatar"}
          </button>
          <p className="mt-2 text-xs text-zinc-500">JPG, PNG or GIF. Max 2MB.</p>
        </div>
      </div>

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
          disabled={updateProfile.isPending}
          className="rounded-lg bg-white px-6 py-2.5 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-200 disabled:opacity-50"
        >
          {updateProfile.isPending ? "Saving..." : "Save changes"}
        </button>
        {saved && (
          <span className="text-sm text-emerald-400">Changes saved!</span>
        )}
        {updateProfile.isError && (
          <span className="text-sm text-red-400">
            {updateProfile.error.message}
          </span>
        )}
      </div>
    </div>
  );
}
