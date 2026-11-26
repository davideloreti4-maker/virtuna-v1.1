"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Clock, Info } from "lucide-react";

import { login } from "@/app/(onboarding)/login/actions";
import { isInAppBrowserClient } from "@/lib/auth/in-app-browser";

import { AuthCard, AuthError, AuthHeading, Field, FootLink, GoogleButton, Notice, OrRule, PrimaryButton, TextAction } from "./auth-parts";
import {
  DELETED,
  EMAIL,
  EMAIL_PLACEHOLDER,
  EXPIRED,
  FORGOT_LINK,
  LOGIN_LINE,
  LOGIN_TITLE,
  NO_ACCOUNT,
  PASSWORD,
  PASSWORD_INSTEAD,
  SIGN_IN,
  SIGN_UP,
} from "./auth-words";
import { EmailCodeForm } from "./email-code-form";

export interface LoginNextProps {
  error?: string;
  expired?: boolean;
  next?: string;
  message?: string;
  deleted?: boolean;
}

/**
 * Sign in, new look. Google first where Google accepts it, as every sign-in page a visitor knows puts
 * it; inside a TikTok/Instagram webview Google refuses (`disallowed_useragent`), so there the button
 * is not drawn and the emailed code is the only door, as before. The password stays one tap away for
 * accounts that have one.
 */
export function LoginNext({ error, expired, next, message, deleted }: LoginNextProps) {
  const router = useRouter();
  const [, formAction, isPending] = useActionState(login, null);
  const [showPassword, setShowPassword] = useState(false);
  // While a code is out the card holds that one step: Google and the password step aside.
  const [codeOut, setCodeOut] = useState(false);

  // Resolved after mount: `navigator` does not exist on the server, and drawing Google there and
  // removing it would flash a control Google will refuse.
  const [inAppBrowser, setInAppBrowser] = useState<boolean | null>(null);
  useEffect(() => setInAppBrowser(isInAppBrowserClient()), []);

  return (
    <>
      <AuthHeading title={LOGIN_TITLE} line={LOGIN_LINE} />
      <AuthCard>
        {deleted && <Notice>{DELETED}</Notice>}
        {message && <Notice icon={<Info aria-hidden="true" />}>{message}</Notice>}
        {expired && <Notice icon={<Clock aria-hidden="true" />}>{EXPIRED}</Notice>}

        {inAppBrowser === false && !codeOut && (
          <>
            <GoogleButton next={next} />
            <OrRule />
          </>
        )}

        <EmailCodeForm
          onStageChange={(stage) => setCodeOut(stage === "code")}
          onAuthenticated={() => {
            router.replace(next || "/home");
            router.refresh();
          }}
        />

        {error && (
          <div className="mt-3">
            <AuthError>{error}</AuthError>
          </div>
        )}

        {!codeOut && !showPassword && (
          <div className="mt-4 text-center">
            <TextAction onClick={() => setShowPassword(true)}>{PASSWORD_INSTEAD}</TextAction>
          </div>
        )}
        {!codeOut && showPassword && (
          <form action={formAction} className="mt-5 space-y-3 border-t border-border pt-5">
            <input type="hidden" name="next" value={next || "/home"} />
            <Field label={EMAIL} name="email" type="email" autoComplete="email" placeholder={EMAIL_PLACEHOLDER} required />
            <Field label={PASSWORD} name="password" type="password" autoComplete="current-password" required />
            <div className="text-right">
              <Link href="/forgot-password" className="rounded-md text-meta font-[560] text-foreground-secondary hover:text-foreground">
                {FORGOT_LINK}
              </Link>
            </div>
            <PrimaryButton type="submit" loading={isPending}>
              {SIGN_IN}
            </PrimaryButton>
          </form>
        )}
      </AuthCard>
      <FootLink lead={NO_ACCOUNT} href="/signup" label={SIGN_UP} />
    </>
  );
}
