"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { MailCheck } from "lucide-react";

import { requestPasswordReset } from "@/app/(onboarding)/forgot-password/actions";
import { createClient } from "@/lib/supabase/client";

import { AuthCard, AuthError, AuthHeading, Field, FootLink, Notice, PrimaryButton } from "./auth-parts";
import {
  EMAIL,
  EMAIL_PLACEHOLDER,
  FORGOT_LINE,
  FORGOT_SENT,
  FORGOT_SENT_LINE,
  FORGOT_TITLE,
  NEW_PASSWORD,
  PASSWORDS_DIFFER,
  PASSWORD_AGAIN,
  REMEMBERED,
  RESET_LINE,
  RESET_PASSWORD_HINT,
  RESET_TITLE,
  SAVE_PASSWORD,
  SEND_LINK,
  SIGN_IN,
} from "./auth-words";

/**
 * Forgot password, new look: ask for the email, then say a link is on its way "if an account
 * exists", never which emails are customers (the same `requestPasswordReset` action as before).
 */
export function ForgotPasswordNext() {
  const [state, formAction, isPending] = useActionState(requestPasswordReset, null);

  return (
    <>
      <AuthHeading title={FORGOT_TITLE} line={state?.sent ? FORGOT_SENT_LINE : FORGOT_LINE} />
      <AuthCard>
        {state?.sent ? (
          <Notice icon={<MailCheck aria-hidden="true" />}>{FORGOT_SENT}</Notice>
        ) : (
          <form action={formAction} className="space-y-3">
            <Field label={EMAIL} name="email" type="email" autoComplete="email" placeholder={EMAIL_PLACEHOLDER} required />
            <PrimaryButton type="submit" loading={isPending}>
              {SEND_LINK}
            </PrimaryButton>
          </form>
        )}
      </AuthCard>
      <FootLink lead={REMEMBERED} href="/login" label={SIGN_IN} />
    </>
  );
}

/**
 * Set a new password, new look. Reached signed in on the recovery session (the page sends anyone
 * without one back to /login). Saved, straight into the app.
 */
export function ResetPasswordNext() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    const password = form.get("password") as string;
    if (password !== form.get("confirm")) {
      setError(PASSWORDS_DIFFER);
      return;
    }

    setPending(true);
    const { error: updateError } = await createClient().auth.updateUser({ password });
    if (updateError) {
      const msg = updateError.message.toLowerCase();
      setError(
        msg.includes("different from the old")
          ? "That's your current password. Pick a new one."
          : msg.includes("least")
            ? "That password is too short."
            : "Couldn't set that password. Try again.",
      );
      setPending(false);
      return;
    }
    router.replace("/home");
    router.refresh();
  };

  return (
    <>
      <AuthHeading title={RESET_TITLE} line={RESET_LINE} />
      <AuthCard>
        <form onSubmit={onSubmit} className="space-y-3">
          <Field
            label={NEW_PASSWORD}
            name="password"
            type="password"
            autoComplete="new-password"
            hint={RESET_PASSWORD_HINT}
            required
            minLength={8}
          />
          <Field label={PASSWORD_AGAIN} name="confirm" type="password" autoComplete="new-password" required minLength={8} />
          {error && <AuthError>{error}</AuthError>}
          <PrimaryButton type="submit" loading={pending}>
            {SAVE_PASSWORD}
          </PrimaryButton>
        </form>
      </AuthCard>
    </>
  );
}
