"use client";

/**
 * Save your setup (funnel spec §3.2, screen 5): the answers as chips, then the email code, on this page.
 *
 * - The code is the app's own (`src/lib/auth/otp.ts`, `shouldCreateUser: true`: one path for a new and a known
 *   address). No Google, no link: the visitor is inside TikTok's or Instagram's browser.
 * - The sixth digit checks the code at once (nothing to review before pressing).
 * - Signed in (the code checked, or an account that came here signed in): the answers go to the profile
 *   (`saveStart`), then the creator goes where the server says, the first build held for the building screen.
 *   A failed save keeps them here with the button to try again; the session stays open.
 * - The line over the button says what is sent anyway (the setup and trial emails: transactional). Consent to
 *   anything else is the checkbox alone, unticked by default (German rules need an active yes); its value is
 *   what `email_consent` stores.
 * - Events: `otp_start` per code sent, `otp_done` when it checks, `profile_saved` once the profile is written.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics/funnel-events";
import { OTP_LENGTH, RESEND_COOLDOWN_SECONDS, sendOtp, verifyOtp } from "@/lib/auth/otp";
import { clearStart, completeAnswersOf, type StartAnswers } from "@/lib/onboarding/answers";
import { browserStorage } from "@/lib/onboarding/browser-storage";
import { holdFirstBuild } from "@/lib/onboarding/first-build";
import { saveStart } from "@/lib/onboarding/save-start";
import { cn } from "@/lib/utils";

import { CodeBoxes } from "./code-boxes";
import { CHECKBOX, FIELD_BOX, FIELD_INPUT, FieldError, Push, StepTitle } from "./start-parts";
import { START_WORDS as W } from "./start-words";

export interface StartAccount {
  email: string | null;
}

type Busy = null | "sending" | "checking" | "saving";

const ERROR_ID = "start-account-error";

export function AccountStep({ answers, account }: { answers: StartAnswers; account: StartAccount | null }) {
  const router = useRouter();
  const complete = useMemo(() => completeAnswersOf(answers), [answers]);
  const [email, setEmail] = useState("");
  const [stage, setStage] = useState<"email" | "code">("email");
  const [code, setCode] = useState("");
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [emailConsent, setEmailConsent] = useState(false);
  // What `save` sends: the box as it stands now, not as it stood in the render that started the code check.
  const consentRef = useRef(false);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((c) => (c <= 1 ? 0 : c - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  // Into the code field when it appears, and back into it once a check is over (a wrong code): while the check
  // runs the field is disabled, and a disabled field cannot take the focus.
  useEffect(() => {
    if (stage === "code" && busy === null) codeRef.current?.focus();
  }, [stage, busy]);

  if (!complete) return null; // resolveStep never shows this step before every question is answered

  const signedIn = account !== null || verified;

  async function save() {
    if (!complete) return;
    const consent = consentRef.current;
    setBusy("saving");
    setError(null);
    const result = await saveStart(complete, consent);
    if (!result.ok) {
      setBusy(null);
      setError(W.saveFailed);
      return;
    }
    track("profile_saved", {
      next: result.next,
      emailConsent: consent,
      nicheSource: complete.nicheSource,
      goal: complete.goal,
      platforms: complete.platforms.join("+"),
      handle: Boolean(complete.tiktokHandle),
    });
    if (result.build) holdFirstBuild(browserStorage("session"), result.build);
    clearStart(browserStorage("local"));
    router.replace(result.next);
  }

  async function sendCode() {
    setBusy("sending");
    setError(null);
    const result = await sendOtp(email);
    setBusy(null);
    if (!result.ok) {
      setError(result.error ?? W.somethingWrong);
      return;
    }
    track("otp_start", { where: "start", resend: stage === "code" });
    setStage("code");
    setCode("");
    setCooldown(RESEND_COOLDOWN_SECONDS);
  }

  async function checkCode(digits: string) {
    setBusy("checking");
    setError(null);
    const result = await verifyOtp(email, digits);
    if (!result.ok) {
      setBusy(null);
      setError(result.error ?? W.somethingWrong);
      setCode("");
      return;
    }
    track("otp_done", { where: "start" });
    setVerified(true);
    await save();
  }

  function onCode(digits: string) {
    setCode(digits);
    setError(null);
    if (digits.length === OTP_LENGTH && busy === null) void checkCode(digits);
  }

  const primary = signedIn
    ? { label: busy === "saving" ? W.saving : W.continue, run: save, disabled: busy !== null }
    : stage === "email"
      ? { label: busy === "sending" ? W.sending : W.sendCode, run: sendCode, disabled: busy !== null || email.trim() === "" }
      : {
          label: busy === "checking" ? W.checking : busy === "saving" ? W.saving : W.continue,
          run: () => checkCode(code),
          disabled: busy !== null || code.length !== OTP_LENGTH,
        };

  const chips = [
    complete.nicheSource === "account" ? W.nicheFromVideos : (complete.niche ?? ""),
    ...complete.platforms.map((p) => W.platformChip(p, p === "tiktok" ? complete.tiktokHandle : complete.instagramHandle)),
    W.goal[complete.goal],
  ];

  // Above the code, not by the button: the sixth digit saves at once, so the box must be decided before it.
  const consentBox = (
    <label className="mt-4 flex cursor-pointer items-start gap-3 text-reading text-foreground">
      <span className="relative mt-px flex size-5 shrink-0">
        <input
          type="checkbox"
          name="email-consent"
          checked={emailConsent}
          disabled={busy !== null}
          onChange={(e) => {
            consentRef.current = e.target.checked;
            setEmailConsent(e.target.checked);
          }}
          className={CHECKBOX}
        />
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          className="pointer-events-none absolute inset-0 m-auto size-3.5 text-action-foreground opacity-0 peer-checked:opacity-100"
          fill="none"
          stroke="currentColor"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      </span>
      <span>{W.consentBox}</span>
    </label>
  );

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (!primary.disabled) void primary.run();
      }}
      className="flex flex-1 flex-col"
    >
      <StepTitle title={W.accountTitle} />
      <ul aria-label={W.yourSetup} className="mt-3.5 flex flex-wrap gap-1.5">
        {chips.map((chip) => (
          <li key={chip} className="flex h-[30px] items-center rounded-lg bg-surface-sunken px-3 text-meta font-[560] text-foreground">
            {chip}
          </li>
        ))}
      </ul>

      {signedIn ? (
        <>
          <p className="mt-6 text-ui text-foreground-secondary">
            {account?.email ? W.signedInAs(account.email) : verified ? W.signedInAs(email.trim()) : W.signedIn}
          </p>
          {consentBox}
        </>
      ) : (
        <>
          <label htmlFor="start-email" className="mt-6 text-ui font-[560] text-foreground">
            {W.emailLabel}
          </label>
          <div className={cn(FIELD_BOX, "mt-2")}>
            <input
              id="start-email"
              type="email"
              name="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              placeholder={W.emailPlaceholder}
              value={email}
              readOnly={stage === "code"}
              aria-describedby={error && stage === "email" ? ERROR_ID : undefined}
              onChange={(e) => {
                setEmail(e.target.value);
                setError(null);
              }}
              className={FIELD_INPUT}
            />
            {stage === "code" ? (
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => {
                  setStage("email");
                  setCode("");
                  setError(null);
                }}
                className="shrink-0 text-meta font-[560] text-foreground-secondary hover:text-foreground disabled:opacity-40"
              >
                {W.changeEmail}
              </button>
            ) : null}
          </div>
          {consentBox}
          {stage === "code" ? (
            <>
              <p className="mt-6 text-ui font-[560] text-foreground">{W.codeTitle}</p>
              <CodeBoxes
                value={code}
                onChange={onCode}
                disabled={busy === "checking" || busy === "saving"}
                inputRef={codeRef}
                invalid={error !== null}
                describedBy={error ? ERROR_ID : undefined}
              />
              <p className="mt-3 text-meta text-foreground-secondary">{W.codeLine}</p>
              <button
                type="button"
                onClick={() => void sendCode()}
                disabled={cooldown > 0 || busy !== null}
                className="mt-2 self-start text-meta font-[560] text-foreground-secondary hover:text-foreground disabled:opacity-40"
              >
                {cooldown > 0 ? W.resendIn(cooldown) : W.resend}
              </button>
            </>
          ) : null}
        </>
      )}

      {error ? <FieldError id={ERROR_ID}>{error}</FieldError> : null}
      <Push />
      <p className="mb-2.5 text-center text-label text-foreground-secondary">{W.consent}</p>
      <Button type="submit" variant="primary" size="xl" className="w-full" disabled={primary.disabled}>
        {primary.label}
      </Button>
    </form>
  );
}
