"use client";

import { useActionState, useState } from "react";

import { signup } from "@/app/(onboarding)/signup/actions";

import { AuthCard, AuthError, AuthHeading, Field, FootLink, GoogleButton, OrRule, PrimaryButton } from "./auth-parts";
import {
  CREATE_ACCOUNT,
  EMAIL,
  EMAIL_PLACEHOLDER,
  HAVE_ACCOUNT,
  PASSWORD,
  PASSWORDS_DIFFER,
  PASSWORD_AGAIN,
  SIGNUP_LINE,
  SIGNUP_PASSWORD_HINT,
  SIGNUP_TITLE,
  SIGN_IN,
} from "./auth-words";

/**
 * Sign up, new look: Google, or an email and a password (the same `signup` action as before, which
 * sends a new account to /welcome). The two passwords are compared here first; the server's own
 * refusals come back in `error` and are shown as written.
 */
export function SignupNext({ error, next }: { error?: string; next?: string }) {
  const [, formAction, isPending] = useActionState(signup, null);
  const [again, setAgain] = useState("");
  const [differ, setDiffer] = useState(false);

  const submit = (formData: FormData) => {
    if (formData.get("password") !== again) {
      setDiffer(true);
      return;
    }
    setDiffer(false);
    formAction(formData);
  };

  const shown = differ ? PASSWORDS_DIFFER : error;

  return (
    <>
      <AuthHeading title={SIGNUP_TITLE} line={SIGNUP_LINE} />
      <AuthCard>
        <GoogleButton next={next} />
        <OrRule />
        <form action={submit} className="space-y-3">
          <input type="hidden" name="next" value={next || ""} />
          <Field label={EMAIL} name="email" type="email" autoComplete="email" placeholder={EMAIL_PLACEHOLDER} required />
          <Field
            label={PASSWORD}
            name="password"
            type="password"
            autoComplete="new-password"
            hint={SIGNUP_PASSWORD_HINT}
            required
          />
          <Field
            label={PASSWORD_AGAIN}
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            value={again}
            invalid={differ}
            onChange={(e) => {
              setAgain(e.target.value);
              setDiffer(false);
            }}
            required
          />
          {shown && <AuthError>{shown}</AuthError>}
          <PrimaryButton type="submit" loading={isPending}>
            {CREATE_ACCOUNT}
          </PrimaryButton>
        </form>
      </AuthCard>
      <FootLink lead={HAVE_ACCOUNT} href="/login" label={SIGN_IN} />
    </>
  );
}
