"use client";

/**
 * The code as six boxes (sketch screen 5), over ONE real input: `one-time-code` lets iOS and Android offer the
 * code from the notification, and a paste fills all six. The input lies over the boxes, invisible; the box the
 * next digit goes into carries the ink ring while the input has the focus. No maxLength: a pasted "419 207"
 * would be cut before its digits are read.
 */
import { useState, type Ref } from "react";

import { OTP_LENGTH } from "@/lib/auth/otp";
import { cn } from "@/lib/utils";

import { PICKED } from "./start-parts";
import { START_WORDS as W } from "./start-words";

export function CodeBoxes({
  value,
  onChange,
  disabled,
  inputRef,
  invalid,
  describedBy,
}: {
  value: string;
  onChange: (digits: string) => void;
  disabled: boolean;
  inputRef: Ref<HTMLInputElement>;
  invalid: boolean;
  describedBy?: string;
}) {
  const [focused, setFocused] = useState(false);
  const at = Math.min(value.length, OTP_LENGTH - 1);
  return (
    <div className="relative mt-2.5">
      <div aria-hidden className="grid grid-cols-6 gap-2">
        {Array.from({ length: OTP_LENGTH }, (_, i) => (
          <span
            key={i}
            data-box={i}
            className={cn(
              "flex h-14 items-center justify-center rounded-2xl bg-surface text-2xl font-bold tabular-nums text-foreground shadow-[var(--shadow-control)]",
              focused && i === at && PICKED,
            )}
          >
            {value[i] ?? ""}
          </span>
        ))}
      </div>
      <input
        ref={inputRef}
        aria-label={W.codeLabel}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        inputMode="numeric"
        autoComplete="one-time-code"
        value={value}
        disabled={disabled}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, OTP_LENGTH))}
        className="absolute inset-0 h-full w-full cursor-text bg-transparent text-transparent caret-transparent opacity-0"
      />
    </div>
  );
}
