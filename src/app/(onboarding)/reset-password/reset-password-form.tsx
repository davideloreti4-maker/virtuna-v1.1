"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { InputField } from "@/components/ui/input";
import { Heading, Text } from "@/components/ui/typography";
import { createClient } from "@/lib/supabase/client";

/** Set the new password on the recovery session, then land in the app signed in. */
export function ResetPasswordForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const form = new FormData(e.currentTarget);
    const password = form.get("password") as string;
    const confirm = form.get("confirm") as string;

    if (password !== confirm) {
      setError("Those passwords don't match.");
      return;
    }

    setPending(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      const msg = updateError.message.toLowerCase();
      setError(
        msg.includes("different from the old")
          ? "That's your current password — pick a new one."
          : msg.includes("least")
            ? "Password is too short."
            : "Couldn't set that password. Please try again."
      );
      setPending(false);
      return;
    }

    // Signed in on the fresh credential — straight into the app.
    router.replace("/home");
    router.refresh();
  };

  return (
    <div
      className="w-full max-w-[400px] rounded-[12px] border border-white/[0.06] px-8 py-10"
      style={{
        backgroundColor: "var(--color-charcoal-chip)",
        boxShadow: "rgba(255,255,255,0.05) 0 1px 0 0 inset",
      }}
    >
      <div className="mb-8 text-center">
        <Heading level={3} className="mb-2">
          Set a new password
        </Heading>
        <Text size="sm" muted>
          You&apos;re signed in — choose the new password for your account.
        </Text>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <InputField
          label="New password"
          name="password"
          type="password"
          placeholder="At least 8 characters"
          required
          minLength={8}
        />
        <InputField
          label="Confirm password"
          name="confirm"
          type="password"
          placeholder="Same again"
          required
          minLength={8}
        />

        {error && (
          <p className="text-sm text-error" role="alert">
            {error}
          </p>
        )}

        <Button type="submit" variant="primary" className="w-full" loading={pending}>
          Save new password
        </Button>
      </form>
    </div>
  );
}
