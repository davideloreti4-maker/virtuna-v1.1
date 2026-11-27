"use client";

/**
 * What are your videos about? (funnel spec §3.2, screen 3): one field in their own words, 2 to 60 characters;
 * no list (ruling 7). With a TikTok handle also "Let Maven work it out": the niche is then worded from the
 * audience build when it returns (part 2). Enter goes on; Shift+Enter is not needed in a 60-character field.
 */
import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { cleanNiche, NICHE_MAX, type StartAnswers } from "@/lib/onboarding/answers";
import { cn } from "@/lib/utils";

import { FieldError, NICHE_FIELD, Push, REST, StepTitle } from "./start-parts";
import { START_WORDS as W } from "./start-words";

const STROKE = { fill: "none", stroke: "currentColor", strokeLinecap: "round", strokeLinejoin: "round" } as const;

export function NicheStep({ answers, onDone }: { answers: StartAnswers; onDone: (patch: Partial<StartAnswers>) => void }) {
  const id = useId();
  const errorId = `${id}-error`;
  const [text, setText] = useState(answers.niche ?? "");
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const niche = cleanNiche(text);
    if (!niche) {
      setError(W.nicheShort);
      return;
    }
    onDone({ niche, nicheSource: "typed" });
  };

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="flex flex-1 flex-col"
    >
      <StepTitle title={W.nicheTitle} line={W.nicheLine} />
      <label htmlFor={id} className="sr-only">
        {W.nicheLabel}
      </label>
      <textarea
        id={id}
        rows={2}
        maxLength={NICHE_MAX}
        value={text}
        placeholder={W.nichePlaceholder}
        enterKeyHint="next"
        onChange={(e) => {
          setText(e.target.value);
          setError(null);
        }}
        onKeyDown={(e) => {
          // An input method's Enter confirms the word being composed; it must not submit.
          if (e.key === "Enter" && !e.nativeEvent.isComposing) {
            e.preventDefault();
            submit();
          }
        }}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={cn(NICHE_FIELD, "mt-6")}
      />
      {error ? <FieldError id={errorId}>{error}</FieldError> : null}
      <p className="mt-2.5 px-0.5 text-meta text-foreground-secondary">{W.nicheExamples}</p>

      {answers.tiktokHandle ? (
        <>
          <div aria-hidden className="mt-6 flex items-center gap-3 text-meta text-foreground-secondary">
            <span className="h-px flex-1 bg-border" />
            {W.or}
            <span className="h-px flex-1 bg-border" />
          </div>
          <button
            type="button"
            onClick={() => onDone({ nicheSource: "account", niche: undefined })}
            className={cn("mt-4 flex min-h-[60px] items-center gap-3 rounded-3xl bg-surface px-4 py-2 text-left", REST)}
          >
            <span aria-hidden className="flex size-[34px] shrink-0 items-center justify-center rounded-lg bg-surface-sunken text-foreground">
              <svg viewBox="0 0 24 24" className="size-[17px]" strokeWidth={2} {...STROKE}>
                <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
              </svg>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-ui font-[640] text-foreground">{W.workItOut}</span>
              <span className="block text-meta text-foreground-secondary">{W.workItOutLine(answers.tiktokHandle)}</span>
            </span>
            <svg aria-hidden viewBox="0 0 24 24" className="size-4 shrink-0 text-foreground" strokeWidth={2.4} {...STROKE}>
              <path d="M9 6l6 6-6 6" />
            </svg>
          </button>
        </>
      ) : null}

      <Push />
      <Button type="submit" variant="primary" size="xl" className="w-full" disabled={text.trim() === ""}>
        {W.continue}
      </Button>
    </form>
  );
}
