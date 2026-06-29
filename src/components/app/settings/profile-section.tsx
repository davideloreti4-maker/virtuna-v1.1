"use client";

import { useState, useEffect, useRef } from "react";
import * as Avatar from "@radix-ui/react-avatar";
import { useProfile, useUpdateProfile, useUploadAvatar } from "@/hooks/queries/use-profile";
import { Input, Button } from "@/components/ui";

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
          <div className="h-6 w-24 rounded bg-white/[0.05]" />
          <div className="mt-2 h-4 w-64 rounded bg-white/[0.05]" />
        </div>
        <div className="flex items-center gap-4">
          <div className="h-20 w-20 rounded-full bg-white/[0.05]" />
          <div className="h-9 w-32 rounded-lg bg-white/[0.05]" />
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i}>
              <div className="mb-2 h-4 w-20 rounded bg-white/[0.05]" />
              <div className="h-10 rounded-lg bg-white/[0.05]" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-medium text-foreground">Profile</h2>
        <p className="mt-1 text-sm text-foreground-secondary">
          Manage your personal information and how others see you.
        </p>
      </div>

      {/* Avatar */}
      <div className="flex items-center gap-4">
        <Avatar.Root
          className="h-20 w-20 overflow-hidden rounded-full"
          style={{ backgroundColor: "var(--color-charcoal-chip)" }}
        >
          <Avatar.Image
            src={profile?.avatar || undefined}
            alt={name}
            className="h-full w-full object-cover"
          />
          <Avatar.Fallback className="flex h-full w-full items-center justify-center text-lg font-medium text-foreground-muted">
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
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            loading={uploadAvatar.isPending}
          >
            {uploadAvatar.isPending ? "Uploading..." : "Change avatar"}
          </Button>
          <p className="mt-2 text-xs text-foreground-muted">JPG, PNG or GIF. Max 2MB.</p>
        </div>
      </div>

      {/* Form fields */}
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-medium text-foreground-secondary">
            Full name
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-foreground-secondary">
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
          <label className="mb-2 block text-sm font-medium text-foreground-secondary">
            Company
          </label>
          <Input
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="Your company"
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-foreground-secondary">
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
        <Button
          type="button"
          variant="primary"
          onClick={handleSave}
          loading={updateProfile.isPending}
        >
          {updateProfile.isPending ? "Saving..." : "Save changes"}
        </Button>
        {saved && (
          <span className="text-sm text-success">Changes saved!</span>
        )}
        {updateProfile.isError && (
          <span className="text-sm text-error">
            {updateProfile.error.message}
          </span>
        )}
      </div>
    </div>
  );
}
