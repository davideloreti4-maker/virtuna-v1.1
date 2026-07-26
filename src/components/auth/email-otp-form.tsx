"use client";

/**
 * EmailOtpForm — email in, six digits back, session open. No navigation.
 *
 * This is the identity step for webview traffic (§2a of the onboarding funnel
 * contract). Everything about it is shaped by one constraint: the visitor is
 * inside TikTok's or Instagram's embedded browser, and ANY step that sends them
 * out of it — a magic link, an OAuth bounce, a confirmation email — loses the
 * session, the referral cookie and the checkout intent in one move.
 *
 * So: two states on one surface, no route change, no app switch.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { InputField } from "@/components/ui/input";
import { Text } from "@/components/ui/typography";
import {
  sendOtp,
  verifyOtp,
  OTP_LENGTH,
  RESEND_COOLDOWN_SECONDS,
} from "@/lib/auth/otp";

export interface EmailOtpFormProps {
  /** Fired once the session is open. The host decides where to go next. */
  onAuthenticated: () => void;
  /** Verb for the submit button — "Continue", "Continue to checkout", … */
  submitLabel?: string;
  className?: string;
}

type Stage = "email" | "code";

export function EmailOtpForm({
  onAuthenticated,
  submitLabel = "Continue",
  className,
}: EmailOtpFormProps) {
  const [stage, setStage] = useState<Stage>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const codeInputRef = useRef<HTMLInputElement>(null);

  // Resend countdown. Cleared on unmount so a fast navigation can't leave an
  // interval writing into a dead component.
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((c) => (c <= 1 ? 0 : c - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  // Move the caret to the code field the moment it appears — one less tap on a
  // phone, at the step where attention is thinnest.
  useEffect(() => {
    if (stage === "code") codeInputRef.current?.focus();
  }, [stage]);

  const handleSendCode = useCallback(async () => {
    setPending(true);
    setError(null);
    const result = await sendOtp(email);
    setPending(false);

    if (!result.ok) {
      setError(result.error ?? "Something went wrong. Try again.");
      return;
    }
    setStage("code");
    setCooldown(RESEND_COOLDOWN_SECONDS);
  }, [email]);

  const handleVerify = useCallback(
    async (submittedCode: string) => {
      setPending(true);
      setError(null);
      const result = await verifyOtp(email, submittedCode);
      setPending(false);

      if (!result.ok) {
        setError(result.error ?? "Something went wrong. Try again.");
        setCode("");
        codeInputRef.current?.focus();
        return;
      }
      onAuthenticated();
    },
    [email, onAuthenticated]
  );

  /**
   * Auto-submit on the sixth digit. The code is not a decision — there is
   * nothing to review before pressing a button, so asking for the extra tap
   * only adds a place to stall.
   */
  const handleCodeChange = (raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, OTP_LENGTH);
    setCode(digits);
    setError(null);
    if (digits.length === OTP_LENGTH) void handleVerify(digits);
  };

  if (stage === "email") {
    return (
      <form
        className={className}
        onSubmit={(e) => {
          e.preventDefault();
          void handleSendCode();
        }}
      >
        <div className="space-y-4">
          <InputField
            label="Email"
            type="email"
            name="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@email.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError(null);
            }}
            error={error ?? undefined}
          />
          <Button
            type="submit"
            variant="primary"
            className="w-full"
            disabled={pending || !email.trim()}
          >
            {pending ? "Sending…" : submitLabel}
          </Button>
          <Text size="sm" muted className="block text-center">
            We&apos;ll email you a {OTP_LENGTH}-digit code. No password to remember.
          </Text>
        </div>
      </form>
    );
  }

  return (
    <form
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        void handleVerify(code);
      }}
    >
      <div className="space-y-4">
        <div className="text-center">
          <Text size="sm" muted>
            We sent a code to
          </Text>
          <Text size="sm" className="font-medium text-foreground">
            {email}
          </Text>
        </div>

        <InputField
          ref={codeInputRef}
          label={`${OTP_LENGTH}-digit code`}
          // `inputMode="numeric"` raises the number pad; `one-time-code` lets iOS
          // and Android offer the code straight from the notification, which on a
          // phone removes the app-switch entirely.
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="000000"
          maxLength={OTP_LENGTH}
          value={code}
          onChange={(e) => handleCodeChange(e.target.value)}
          error={error ?? undefined}
        />

        <Button
          type="submit"
          variant="primary"
          className="w-full"
          disabled={pending || code.length !== OTP_LENGTH}
        >
          {pending ? "Checking…" : submitLabel}
        </Button>

        <div className="flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={() => void handleSendCode()}
            disabled={cooldown > 0 || pending}
            className="text-sm text-foreground-secondary transition-colors hover:text-foreground disabled:opacity-40"
          >
            {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
          </button>
          <button
            type="button"
            onClick={() => {
              setStage("email");
              setCode("");
              setError(null);
            }}
            className="text-sm text-foreground-secondary transition-colors hover:text-foreground"
          >
            Change email
          </button>
        </div>
      </div>
    </form>
  );
}
