"use client";

import { useState } from "react";
import { Input } from "@/components/ui";
import { useProfile, useChangePassword } from "@/hooks/queries/use-profile";

export function AccountSection() {
  const { data: profile } = useProfile();
  const changePassword = useChangePassword();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const handlePasswordChange = async () => {
    setPasswordError("");
    setPasswordSuccess(false);

    if (newPassword.length < 8) {
      setPasswordError("Password must be at least 8 characters");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match");
      return;
    }

    try {
      await changePassword.mutateAsync(newPassword);
      setNewPassword("");
      setConfirmPassword("");
      setPasswordSuccess(true);
      setTimeout(() => setPasswordSuccess(false), 3000);
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : "Failed to change password");
    }
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
            value={profile?.email || ""}
            disabled
            className="max-w-sm opacity-70"
          />
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
          {passwordError && (
            <p className="text-sm text-red-400">{passwordError}</p>
          )}
          {passwordSuccess && (
            <p className="text-sm text-emerald-400">Password updated successfully!</p>
          )}
          <button
            type="button"
            onClick={handlePasswordChange}
            disabled={changePassword.isPending}
            className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-200 disabled:opacity-50"
          >
            {changePassword.isPending ? "Updating..." : "Update password"}
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
          disabled
          className="mt-4 rounded-lg border border-red-700 bg-red-900/30 px-4 py-2 text-sm font-medium text-red-400 opacity-50 cursor-not-allowed"
        >
          Delete account
        </button>
        <p className="mt-2 text-xs text-zinc-500">
          Contact support to delete your account.
        </p>
      </div>
    </div>
  );
}
