"use client";

import { useState } from "react";
import { Input, Button } from "@/components/ui";
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
        <h2 className="text-lg font-medium text-foreground">Account</h2>
        <p className="mt-1 text-sm text-foreground-secondary">
          Manage your account settings and security preferences.
        </p>
      </div>

      {/* Email section */}
      <div
        className="rounded-lg border border-white/[0.06] p-6"
        style={{
          backgroundColor: "var(--color-charcoal-composer)",
          boxShadow: "rgba(255,255,255,0.05) 0 1px 0 0 inset",
        }}
      >
        <h3 className="text-sm font-medium text-foreground">Email address</h3>
        <p className="mt-1 text-sm text-foreground-secondary">
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
      <div
        className="rounded-lg border border-white/[0.06] p-6"
        style={{
          backgroundColor: "var(--color-charcoal-composer)",
          boxShadow: "rgba(255,255,255,0.05) 0 1px 0 0 inset",
        }}
      >
        <h3 className="text-sm font-medium text-foreground">Change password</h3>
        <p className="mt-1 text-sm text-foreground-secondary">
          Update your password to keep your account secure.
        </p>
        <div className="mt-4 space-y-4">
          <div className="max-w-sm">
            <label className="mb-2 block text-sm text-foreground-secondary">
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
            <label className="mb-2 block text-sm text-foreground-secondary">
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
            <p className="text-sm text-error">{passwordError}</p>
          )}
          {passwordSuccess && (
            <p className="text-sm text-success">Password updated successfully!</p>
          )}
          <Button
            type="button"
            variant="primary"
            onClick={handlePasswordChange}
            loading={changePassword.isPending}
          >
            {changePassword.isPending ? "Updating..." : "Update password"}
          </Button>
        </div>
      </div>

      {/* Danger zone */}
      <div className="rounded-lg border border-error/40 bg-error/[0.08] p-6">
        <h3 className="text-sm font-medium text-error">Danger zone</h3>
        <p className="mt-1 text-sm text-foreground-secondary">
          Once you delete your account, there is no going back. Please be
          certain.
        </p>
        <button
          type="button"
          disabled
          className="mt-4 cursor-not-allowed rounded-lg border border-error/40 bg-error/[0.12] px-4 py-2 text-sm font-medium text-error opacity-50"
        >
          Delete account
        </button>
        <p className="mt-2 text-xs text-foreground-muted">
          Contact support to delete your account.
        </p>
      </div>
    </div>
  );
}
