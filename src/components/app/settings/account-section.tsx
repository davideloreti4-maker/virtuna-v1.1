"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui";
import { useSettingsStore } from "@/stores/settings-store";
import { createClient } from "@/lib/supabase/client";

export function AccountSection() {
  const profile = useSettingsStore((s) => s.profile);
  const router = useRouter();

  // Real email from Supabase
  const [email, setEmail] = useState(profile.email);

  // Fetch real email from Supabase auth
  useEffect(() => {
    async function fetchEmail() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user?.email) {
        setEmail(user.email);
      }
    }
    fetchEmail();
  }, []);

  // Password change state
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Delete account state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const handlePasswordChange = async () => {
    setPasswordError(null);
    setPasswordSuccess(null);

    // Validation
    if (newPassword.length < 8) {
      setPasswordError("Password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match");
      return;
    }

    setIsChangingPassword(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        setPasswordError(error.message);
        setIsChangingPassword(false);
        return;
      }

      setNewPassword("");
      setConfirmPassword("");
      setPasswordSuccess("Password updated!");
      setTimeout(() => setPasswordSuccess(null), 2000);
    } catch {
      setPasswordError("Failed to update password");
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);

    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      // TODO: Implement server-side account deletion API route
      router.push("/login");
    } catch {
      setIsDeleting(false);
    }
  };

  const deleteConfirmMatch = deleteInput.toLowerCase() === "delete my account";

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
            value={email}
            disabled
            className="max-w-sm opacity-70"
          />
          <button
            type="button"
            disabled
            title="Coming soon"
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Change email <span className="text-xs text-zinc-500">(coming soon)</span>
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
              New password
            </label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value);
                setPasswordError(null);
              }}
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
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                setPasswordError(null);
              }}
              placeholder="Confirm new password"
            />
          </div>
          {passwordError && (
            <p className="text-sm text-red-400">{passwordError}</p>
          )}
          {passwordSuccess && (
            <p className="text-sm text-emerald-400">{passwordSuccess}</p>
          )}
          <button
            type="button"
            onClick={handlePasswordChange}
            disabled={isChangingPassword || !newPassword || !confirmPassword}
            className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-200 disabled:opacity-50"
          >
            {isChangingPassword ? "Updating..." : "Update password"}
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
        {!showDeleteConfirm ? (
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="mt-4 rounded-lg border border-red-700 bg-red-900/30 px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-900/50"
          >
            Delete account
          </button>
        ) : (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-zinc-300">
              Type <span className="font-mono text-red-400">delete my account</span> to confirm:
            </p>
            <Input
              value={deleteInput}
              onChange={(e) => setDeleteInput(e.target.value)}
              placeholder="delete my account"
              className="max-w-sm"
            />
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={!deleteConfirmMatch || isDeleting}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeleting ? "Deleting..." : "Permanently delete"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteInput("");
                }}
                className="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-700"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
