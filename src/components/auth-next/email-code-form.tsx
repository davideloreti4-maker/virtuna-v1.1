"use client";

import { useEffect } from "react";

import { OTP_LENGTH } from "@/lib/auth/otp";
import { useEmailOtp, type OtpStage } from "@/lib/auth/use-email-otp";

import { AuthError, Field, PrimaryButton, TextAction } from "./auth-parts";
import {
  CHANGE_EMAIL,
  CHECKING,
  CODE_HINT,
  CODE_LABEL,
  CODE_SENT_TO,
  CONTINUE,
  EMAIL,
  EMAIL_PLACEHOLDER,
  RESEND,
  SENDING,
  resendIn,
} from "./auth-words";

/**
 * The emailed code, drawn in the new look: email in, six digits back, session open, all on this card
 * (the legacy `EmailOtpForm`'s flow through the same `useEmailOtp`; see that file for why it never
 * leaves the page). The code submits itself on the sixth digit.
 */
export function EmailCodeForm({
  onAuthenticated,
  onStageChange,
}: {
  onAuthenticated: () => void;
  /** The host hides its other ways in while a code is out (the card holds the one step). */
  onStageChange?: (stage: OtpStage) => void;
}) {
  const otp = useEmailOtp(onAuthenticated);
  useEffect(() => onStageChange?.(otp.stage), [otp.stage, onStageChange]);

  if (otp.stage === "email") {
    return (
      <form
        noValidate
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (otp.email.trim()) void otp.sendCode();
        }}
      >
        <Field
          label={EMAIL}
          type="email"
          name="email"
          inputMode="email"
          autoComplete="email"
          placeholder={EMAIL_PLACEHOLDER}
          value={otp.email}
          invalid={!!otp.error}
          onChange={(e) => otp.setEmail(e.target.value)}
        />
        {otp.error && <AuthError>{otp.error}</AuthError>}
        <PrimaryButton type="submit" disabled={otp.pending || !otp.email.trim()}>
          {otp.pending ? SENDING : CONTINUE}
        </PrimaryButton>
        <p className="text-balance text-center text-meta text-foreground-muted">{CODE_HINT}</p>
      </form>
    );
  }

  return (
    <form
      noValidate
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        void otp.verify(otp.code);
      }}
    >
      <p className="text-center text-meta text-foreground-secondary">
        {CODE_SENT_TO} <span className="font-[560] text-foreground">{otp.email}</span>
      </p>
      <Field
        ref={otp.codeInputRef}
        label={CODE_LABEL}
        // The number pad, and iOS/Android offer the code from the notification.
        inputMode="numeric"
        autoComplete="one-time-code"
        placeholder="000000"
        maxLength={OTP_LENGTH}
        value={otp.code}
        invalid={!!otp.error}
        className="text-center font-[560] tabular-nums tracking-[0.3em]"
        onChange={(e) => otp.changeCode(e.target.value)}
      />
      {otp.error && <AuthError>{otp.error}</AuthError>}
      <PrimaryButton type="submit" disabled={otp.pending || otp.code.length !== OTP_LENGTH}>
        {otp.pending ? CHECKING : CONTINUE}
      </PrimaryButton>
      <div className="flex items-center justify-center gap-5 pt-1">
        <TextAction onClick={() => void otp.sendCode()} disabled={otp.cooldown > 0 || otp.pending}>
          {otp.cooldown > 0 ? resendIn(otp.cooldown) : RESEND}
        </TextAction>
        <TextAction onClick={otp.changeEmail}>{CHANGE_EMAIL}</TextAction>
      </div>
    </form>
  );
}
