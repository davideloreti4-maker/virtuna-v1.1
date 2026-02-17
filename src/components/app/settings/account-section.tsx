"use client";

import { useState } from "react";
import { Input } from "@/components/ui";
import { useSettingsStore } from "@/stores/settings-store";

export function AccountSection() {
  const profile = useSettingsStore((s) => s.profile);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handlePasswordChange = () => {
    // Mock - would call API in real app
    console.log("Password change requested");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  const handleDeleteAccount = () => {
    // Mock - would show confirmation modal
    console.log("Delete account requested");
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-medium text-white">Account</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Manage your account settings and security preferences.
        </p>
      </div>

      {/* Email section */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6">
        <h3 className="text-sm font-medium text-white">Email address</h3>
        <p className="mt-1 text-sm text-zinc-400">
          Your email is used for login and notifications.
        </p>
        <div className="mt-4 flex items-center gap-4">
          <Input
            type="email"
            value={profile.email}
            disabled
            className="max-w-sm opacity-70"
          />
          <button
            type="button"
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
          >
            Change email
          </button>
        </div>
      </div>

      {/* Password section */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6">
        <h3 className="text-sm font-medium text-white">Change password</h3>
        <p className="mt-1 text-sm text-zinc-400">
          Update your password to keep your account secure.
        </p>
        <div className="mt-4 space-y-4">
          <div className="max-w-sm">
            <label className="mb-2 block text-sm text-zinc-400">
              Current password
            </label>
            <Input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter current password"
            />
          </div>
          <div className="max-w-sm">
            <label className="mb-2 block text-sm text-zinc-400">
              New password
            </label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password"
            />
          </div>
          <div className="max-w-sm">
            <label className="mb-2 block text-sm text-zinc-400">
              Confirm new password
            </label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
            />
          </div>
          <button
            type="button"
            onClick={handlePasswordChange}
            className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-200"
          >
            Update password
          </button>
        </div>
      </div>

      {/* Danger zone */}
      <div className="rounded-lg border border-red-900/50 bg-red-950/20 p-6">
        <h3 className="text-sm font-medium text-red-400">Danger zone</h3>
        <p className="mt-1 text-sm text-zinc-400">
          Once you delete your account, there is no going back. Please be
          certain.
        </p>
        <button
          type="button"
          onClick={handleDeleteAccount}
          className="mt-4 rounded-lg border border-red-700 bg-red-900/30 px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-900/50"
        >
          Delete account
        </button>
      </div>
    </div>
  );
}
