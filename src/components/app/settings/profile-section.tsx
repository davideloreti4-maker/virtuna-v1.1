"use client";

import { useState, useEffect } from "react";
import * as Avatar from "@radix-ui/react-avatar";
import { useSettingsStore } from "@/stores/settings-store";
import { Input } from "@/components/ui";

export function ProfileSection() {
  const profile = useSettingsStore((s) => s.profile);
  const updateProfile = useSettingsStore((s) => s.updateProfile);

  // Local form state
  const [name, setName] = useState(profile.name);
  const [email, setEmail] = useState(profile.email);
  const [company, setCompany] = useState(profile.company || "");
  const [role, setRole] = useState(profile.role || "");
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Sync local state when profile changes
  useEffect(() => {
    setName(profile.name);
    setEmail(profile.email);
    setCompany(profile.company || "");
    setRole(profile.role || "");
  }, [profile]);

  const handleSave = async () => {
    setIsSaving(true);
    // Simulate API delay
    await new Promise((r) => setTimeout(r, 500));
    updateProfile({ name, email, company, role });
    setIsSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  // Get initials for avatar fallback
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .join("")
    .toUpperCase()
    .slice(0, 2);

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
            src={profile.avatar}
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
          >
            Change avatar
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
            onChange={(e) => setEmail(e.target.value)}
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
