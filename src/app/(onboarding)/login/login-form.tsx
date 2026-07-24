"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Clock, Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import { InputField } from "@/components/ui/input";
import { Heading, Text } from "@/components/ui/typography";
import { createClient } from "@/lib/supabase/client";
import { EmailOtpForm } from "@/components/auth/email-otp-form";
import { isInAppBrowserClient } from "@/lib/auth/in-app-browser";
import { login } from "./actions";

interface LoginFormProps {
  error?: string;
  expired?: boolean;
  next?: string;
  message?: string;
}

export function LoginForm({ error, expired, next, message }: LoginFormProps) {
  const [_state, formAction, isPending] = useActionState(login, null);
  const router = useRouter();

  /**
   * Password sign-in stays available, but it is no longer the front door: the
   * product's traffic arrives inside social webviews where the emailed CODE is
   * the only path that survives (see `in-app-browser.ts`). Password is folded
   * behind a disclosure so returning users can still reach it.
   */
  const [showPassword, setShowPassword] = useState(false);

  /**
   * Resolved after mount — `navigator` does not exist during SSR, and rendering
   * the Google button on the server and then removing it would flash a control
   * that Google is going to refuse anyway.
   */
  const [inAppBrowser, setInAppBrowser] = useState(false);
  useEffect(() => setInAppBrowser(isInAppBrowserClient()), []);

  const handleGoogleOAuth = async () => {
    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next || "/home")}`;
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
      },
    });
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
          Welcome back
        </Heading>
        <Text size="sm" muted>
          Sign in to your account
        </Text>
      </div>

      {message && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
          <Info size={14} className="mt-0.5 shrink-0 text-foreground-secondary" />
          <Text size="sm" className="text-foreground-secondary">
            {message}
          </Text>
        </div>
      )}

      {expired && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
          <Clock size={14} className="mt-0.5 shrink-0 text-foreground-secondary" />
          <Text size="sm" className="text-foreground-secondary">
            Your session has expired. Please sign in again.
          </Text>
        </div>
      )}

      {/* The front door: email → six digits → session, without leaving the page. */}
      <EmailOtpForm
        submitLabel="Continue"
        onAuthenticated={() => {
          router.replace(next || "/home");
          router.refresh();
        }}
      />

      {error && (
        <p className="mt-4 text-sm text-error" role="alert">
          {error}
        </p>
      )}

      {/* Google is offered ONLY where Google accepts it. Inside a TikTok/Instagram
          webview it answers `disallowed_useragent`, so showing the button would
          send the visitor to an error page instead of into the product. */}
      {!inAppBrowser && (
        <>
          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-white/[0.06]" />
            <Text as="span" size="sm" muted>
              or
            </Text>
            <div className="h-px flex-1 bg-white/[0.06]" />
          </div>

          <Button
            type="button"
            variant="secondary"
            className="w-full"
            onClick={handleGoogleOAuth}
          >
            <GoogleIcon />
            Continue with Google
          </Button>
        </>
      )}

      {/* Password stays reachable for accounts that already have one — folded away
          so it does not compete with the path that works everywhere. */}
      {!showPassword ? (
        <button
          type="button"
          onClick={() => setShowPassword(true)}
          className="mt-6 block w-full text-center text-sm text-foreground-secondary transition-colors hover:text-foreground"
        >
          Sign in with a password instead
        </button>
      ) : (
        <form action={formAction} className="mt-6 space-y-4">
          <input type="hidden" name="next" value={next || "/home"} />
          <InputField
            label="Email"
            name="email"
            type="email"
            placeholder="you@example.com"
            required
          />
          <InputField
            label="Password"
            name="password"
            type="password"
            placeholder="Enter your password"
            required
          />
          <div className="-mt-2 text-right">
            <Link
              href="/forgot-password"
              className="text-sm text-foreground-secondary hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <Button
            type="submit"
            variant="primary"
            className="w-full"
            loading={isPending}
          >
            Sign in
          </Button>
        </form>
      )}

      <Text size="sm" muted className="mt-8 text-center">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="text-foreground-secondary hover:underline">
          Sign up
        </Link>
      </Text>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"
        fill="#34A853"
      />
      <path
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z"
        fill="#EA4335"
      />
    </svg>
  );
}
