"use client";

/**
 * Where do you post? (funnel spec §3.2, screen 2): TikTok and/or Instagram as two tiles, an optional handle for
 * each picked one, and "Skip the handle". The TikTok handle is what lets Maven read the account (the hint says
 * so); Instagram's is kept for later, the build does not read Instagram.
 */
import { useId, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cleanHandle, PLATFORMS, type Platform, type StartAnswers } from "@/lib/onboarding/answers";
import { cn } from "@/lib/utils";

import { FIELD_BOX, FIELD_INPUT, FieldError, PICKED, Push, REST, StepTitle } from "./start-parts";
import { START_WORDS as W } from "./start-words";

const STROKE = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;

const ICON: Record<Platform, ReactNode> = {
  tiktok: (
    <svg viewBox="0 0 24 24" {...STROKE}>
      <path d="M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5" />
      <path d="M14 3c.5 2.5 2.5 4.5 5 5" />
    </svg>
  ),
  instagram: (
    <svg viewBox="0 0 24 24" {...STROKE}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r=".8" fill="currentColor" />
    </svg>
  ),
};

function ClockIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="mt-0.5 size-[18px] shrink-0 text-foreground" {...STROKE}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 8v4l3 2" />
    </svg>
  );
}

export function PlatformStep({ answers, onDone }: { answers: StartAnswers; onDone: (patch: Partial<StartAnswers>) => void }) {
  const base = useId();
  const [platforms, setPlatforms] = useState<Platform[]>(answers.platforms);
  const [handles, setHandles] = useState<Record<Platform, string>>({
    tiktok: answers.tiktokHandle ?? "",
    instagram: answers.instagramHandle ?? "",
  });
  const [errors, setErrors] = useState<Partial<Record<Platform, string>>>({});

  const toggle = (platform: Platform) => {
    setPlatforms((current) => PLATFORMS.filter((p) => (p === platform ? !current.includes(p) : current.includes(p))));
    setErrors((e) => ({ ...e, [platform]: undefined }));
  };

  const finish = (withHandles: boolean) => {
    if (platforms.length === 0) return;
    if (!withHandles) {
      onDone({ platforms, tiktokHandle: undefined, instagramHandle: undefined });
      return;
    }
    const found: Partial<Record<Platform, string>> = {};
    const bad: Partial<Record<Platform, string>> = {};
    for (const p of platforms) {
      const raw = handles[p].trim();
      if (raw === "") continue;
      const handle = cleanHandle(p, raw);
      if (handle) found[p] = handle;
      else bad[p] = W.handleBad(p);
    }
    if (Object.keys(bad).length > 0) {
      setErrors(bad);
      return;
    }
    onDone({ platforms, tiktokHandle: found.tiktok, instagramHandle: found.instagram });
  };

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        finish(true);
      }}
      className="flex flex-1 flex-col"
    >
      <StepTitle title={W.platformTitle} line={W.platformLine} />
      <div className="mt-6 grid grid-cols-2 gap-2.5">
        {PLATFORMS.map((p) => {
          const on = platforms.includes(p);
          return (
            <button
              key={p}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(p)}
              className={cn(
                "flex h-24 flex-col justify-between rounded-3xl bg-surface p-4 text-left text-foreground motion-safe:transition-shadow",
                on ? PICKED : REST,
              )}
            >
              <span aria-hidden className="[&_svg]:size-[22px]">
                {ICON[p]}
              </span>
              <span className={cn("text-title", on ? "font-[640]" : "font-[560]")}>{W.platformName(p)}</span>
            </button>
          );
        })}
      </div>

      {platforms.map((p) => {
        const id = `${base}-${p}`;
        const errorId = `${id}-error`;
        return (
          <div key={p} className="mt-6 flex flex-col">
            <label htmlFor={id} className="text-ui font-[560] text-foreground">
              {W.handleLabel(p)} <span className="font-[430] text-foreground-secondary">{W.optional}</span>
            </label>
            <div className={cn(FIELD_BOX, "mt-2")}>
              <span aria-hidden className="text-[17px] text-foreground-muted">
                @
              </span>
              <input
                id={id}
                value={handles[p]}
                onChange={(e) => {
                  const value = e.target.value;
                  setHandles((h) => ({ ...h, [p]: value }));
                  setErrors((er) => ({ ...er, [p]: undefined }));
                }}
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="off"
                spellCheck={false}
                enterKeyHint="next"
                aria-invalid={errors[p] ? true : undefined}
                aria-describedby={errors[p] ? errorId : undefined}
                className={FIELD_INPUT}
              />
            </div>
            {errors[p] ? <FieldError id={errorId}>{errors[p]}</FieldError> : null}
          </div>
        );
      })}

      {platforms.includes("tiktok") ? (
        <p className="mt-3 flex items-start gap-2.5 text-reading text-foreground-secondary">
          <ClockIcon />
          <span>{W.handleHint}</span>
        </p>
      ) : null}

      <Push />
      <Button type="submit" variant="primary" size="xl" className="w-full" disabled={platforms.length === 0}>
        {W.continue}
      </Button>
      {platforms.length > 0 ? (
        <Button type="button" variant="quiet" size="md" className="mt-1.5 w-full" onClick={() => finish(false)}>
          {W.skipHandle}
        </Button>
      ) : null}
    </form>
  );
}
