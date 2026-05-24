"use client";

import { ProfileSettingsForm } from "@/components/app/profile-settings-form";

/**
 * Thin wrapper around `ProfileSettingsForm` so the Settings tab content
 * mirrors the other section components (`ProfileSection`, `AccountSection`,
 * etc.) in shape and import surface.
 */
export function CreatorProfileSection(): React.JSX.Element {
  return <ProfileSettingsForm />;
}
