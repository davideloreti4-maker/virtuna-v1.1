"use client";

/**
 * useEmailOtp — the state behind "email in, six digits back, session open", without its drawing.
 * Shared by the legacy `EmailOtpForm` and the new look's `EmailCodeForm` (auth-next), so both send
 * and verify the same way; see `email-otp-form.tsx` for why the flow never leaves the page.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { OTP_LENGTH, RESEND_COOLDOWN_SECONDS, sendOtp, verifyOtp } from "@/lib/auth/otp";

export type OtpStage = "email" | "code";

export function useEmailOtp(onAuthenticated: () => void) {
  const [stage, setStage] = useState<OtpStage>("email");
  const [email, setEmailRaw] = useState("");
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

  const sendCode = useCallback(async () => {
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

  const verify = useCallback(
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
    [email, onAuthenticated],
  );

  /**
   * Auto-submit on the sixth digit. The code is not a decision — there is
   * nothing to review before pressing a button, so asking for the extra tap
   * only adds a place to stall.
   */
  const changeCode = (raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, OTP_LENGTH);
    setCode(digits);
    setError(null);
    if (digits.length === OTP_LENGTH) void verify(digits);
  };

  const setEmail = (value: string) => {
    setEmailRaw(value);
    setError(null);
  };

  const changeEmail = () => {
    setStage("email");
    setCode("");
    setError(null);
  };

  return { stage, email, setEmail, code, changeCode, error, pending, cooldown, codeInputRef, sendCode, verify, changeEmail };
}
