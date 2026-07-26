"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { beginGoogleLink, linkEmailPassword } from "@/lib/onboarding/claim-account";

/**
 * ClaimAccountDialog — the post-payment step of the funnel's wall (§0b② last line).
 *
 * The visitor has paid; what stands between them and the verdict is `is_anonymous` on
 * their session, and the ONLY thing that flips it is linking an identity onto the SAME
 * user. This dialog is that step — it never creates a new account, which is the whole
 * point: the thread, the paid subscription and the sealed verdict all hang off the anon
 * user's id, and a fresh signup would strand every one of them.
 *
 * Google is the primary path because it opens the room in one round-trip. The email path
 * is honest about its extra step: Supabase confirms the address before the identity lands,
 * so the verdict opens on confirmation, not on submit.
 */
export function ClaimAccountDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<"google" | "email" | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The email path's terminal state — the identity is pending the inbox confirmation.
  const [emailSent, setEmailSent] = useState(false);

  const handleGoogle = async () => {
    setBusy("google");
    setError(null);
    const result = await beginGoogleLink(window.location.origin);
    // Success NAVIGATES away — only a failure ever lands here.
    if (!result.ok) {
      setError(result.error);
      setBusy(null);
    }
  };

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setBusy("email");
    setError(null);
    const result = await linkEmailPassword(email.trim(), password);
    if (!result.ok) {
      setError(result.error);
      setBusy(null);
      return;
    }
    setEmailSent(true);
    setBusy(null);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>One step left — make this room yours</DialogTitle>
          <DialogDescription>
            Link an account onto this session and the verdict opens — same thread, same
            credits, nothing starts over.
          </DialogDescription>
        </DialogHeader>

        {emailSent ? (
          <div className="pt-2 text-sm text-foreground/80">
            <p className="font-medium text-foreground">Check your inbox.</p>
            <p className="mt-1.5 leading-relaxed">
              Confirm your email to finish linking — your verdict opens the moment it&apos;s
              confirmed. This tab keeps your room in the meantime.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4 pt-2">
            <Button
              variant="primary"
              className="w-full"
              loading={busy === "google"}
              disabled={busy !== null}
              onClick={handleGoogle}
            >
              Continue with Google
            </Button>

            <div className="flex items-center gap-3">
              <span className="h-px flex-1 bg-white/[0.06]" />
              <span className="text-xs text-foreground/40">or with email</span>
              <span className="h-px flex-1 bg-white/[0.06]" />
            </div>

            <form onSubmit={handleEmail} className="flex flex-col gap-3">
              <Input
                type="email"
                required
                placeholder="you@example.com"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={busy !== null}
              />
              <Input
                type="password"
                required
                placeholder="Password (8+ characters)"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={busy !== null}
              />
              <Button
                type="submit"
                variant="secondary"
                className="w-full"
                loading={busy === "email"}
                disabled={busy !== null}
              >
                Link with email
              </Button>
            </form>

            {error ? <p className="text-sm text-error">{error}</p> : null}

            <p className="text-xs leading-relaxed text-foreground/40">
              Linking never creates a new account — it attaches to the session that ran
              your video.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
