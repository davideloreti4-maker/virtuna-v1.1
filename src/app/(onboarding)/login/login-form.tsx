"use client";

import { useState } from "react";
import { useActionState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { InputField } from "@/components/ui/input";
import { Heading, Text } from "@/components/ui/typography";
import { createClient } from "@/lib/supabase/client";
import { login, type LoginState } from "./actions";

interface LoginFormProps {
  error?: string;
  expired?: boolean;
  next?: string;
  message?: string;
}

export function LoginForm({ error, expired, next, message }: LoginFormProps) {
  const [state, formAction, isPending] = useActionState<LoginState | null, FormData>(login, null);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [oauthError, setOauthError] = useState<string | null>(null);

  const handleGoogleOAuth = async () => {
    setOauthError(null);
    setOauthLoading(true);
    try {
      const supabase = createClient();
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next || "/dashboard")}`;
      const { error: oauthErr } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
        },
      });
      if (oauthErr) {
        setOauthError(oauthErr.message);
        setOauthLoading(false);
      }
    } catch {
      setOauthError("Failed to connect to Google. Please try again.");
      setOauthLoading(false);
    }
  };

  return (
    <div
      className="w-full max-w-sm rounded-xl border border-white/[0.06] p-8"
      style={{
        backgroundImage:
          "linear-gradient(137deg, rgba(17, 18, 20, 0.75) 4.87%, rgba(12, 13, 15, 0.9) 75.88%)",
        backdropFilter: "blur(5px)",
        WebkitBackdropFilter: "blur(5px)",
        boxShadow: "rgba(255,255,255,0.15) 0px 1px 1px 0px inset",
      }}
    >
      <div className="mb-6 text-center">
        <Heading level={3} className="mb-2">
          Welcome back
        </Heading>
        <Text size="sm" muted>
          Sign in to your account
        </Text>
      </div>

      {message && (
        <div className="mb-4 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
          <Text size="sm" className="text-center text-foreground-secondary">
            {message}
          </Text>
        </div>
      )}

      {expired && (
        <div className="mb-4 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
          <Text size="sm" className="text-center text-foreground-secondary">
            Your session has expired. Please sign in again.
          </Text>
        </div>
      )}

      <form action={formAction} className="space-y-4">
        <input type="hidden" name="next" value={next || "/dashboard"} />
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

        {(error || state?.error) && (
          <p className="text-sm text-error" role="alert">
            {state?.error || error}
          </p>
        )}

        <Button
          type="submit"
          variant="primary"
          className="w-full"
          loading={isPending}
        >
          Sign in
        </Button>
      </form>

      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-white/[0.06]" />
        <Text as="span" size="sm" muted>
          or
        </Text>
        <div className="h-px flex-1 bg-white/[0.06]" />
      </div>

      <div className="space-y-3">
        {oauthError && (
          <p className="text-sm text-error" role="alert">
            {oauthError}
          </p>
        )}
        <Button
          type="button"
          variant="secondary"
          className="w-full"
          onClick={handleGoogleOAuth}
          loading={oauthLoading}
        >
          <GoogleIcon />
          Continue with Google
        </Button>
      </div>

      <Text size="sm" muted className="mt-6 text-center">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="text-accent hover:underline">
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
