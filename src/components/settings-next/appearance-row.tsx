"use client";

import * as React from "react";
import { useId, useLayoutEffect, useRef } from "react";
import { Desktop, Moon, Sun, type Icon } from "@phosphor-icons/react";

import { Chip } from "@/components/ui/chip";
import { RowButton, cancelOnEscape } from "@/components/you-next/row-parts";
import { THEME_CHOICES, type ThemeChoice } from "@/lib/theme/theme";

import { arrowTarget } from "./radio-keys";
import { APPEARANCE, THEME_LABEL } from "./settings-words";

/**
 * Appearance (spec 2026-11-26-settings-design 2.2; drawing frames 1 and 5): closed, a row saying the
 * choice; open, in place, three chips as one radio group (Light, Dark, Match system, each with its
 * icon). A choice applies at once and closes the row; the chip already chosen, or Escape, closes it
 * and changes nothing. The closed button unmounts while the row is open, so the PARENT returns the
 * focus to it (`buttonRef`) when the row closes, as You's rows do.
 *
 * - The chosen chip takes the focus on open and is the group's one Tab stop; the arrows move between
 *   the chips without choosing (a choice closes the row, so it waits for Space or Enter).
 * - The chosen chip has the chip's filled look and `aria-checked`; a radio has no pressed state.
 */
export interface AppearanceRowProps {
  theme: ThemeChoice;
  open: boolean;
  onOpen(): void;
  /** A choice other than the one already made. */
  onPick(choice: ThemeChoice): void;
  onCancel(): void;
  buttonRef?: React.Ref<HTMLButtonElement>;
}

const ICONS: Record<ThemeChoice, Icon> = { light: Sun, dark: Moon, system: Desktop };

export function AppearanceRow(props: AppearanceRowProps): React.JSX.Element {
  if (!props.open) return <RowButton label={APPEARANCE} value={THEME_LABEL[props.theme]} onOpen={props.onOpen} buttonRef={props.buttonRef} />;
  return <ThemePicker {...props} />;
}

function ThemePicker({ theme, onPick, onCancel }: AppearanceRowProps) {
  const id = useId();
  const radios = useRef<(HTMLButtonElement | null)[]>([]);
  const groupRef = useRef<HTMLDivElement>(null);
  // Opened: the chosen chip takes the focus.
  useLayoutEffect(() => {
    groupRef.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus();
  }, []);
  return (
    <div className="pb-4 pt-3.5" onKeyDown={cancelOnEscape(false, onCancel)}>
      <p id={`${id}-label`} className="text-title font-[640] text-foreground">
        {APPEARANCE}
      </p>
      <div ref={groupRef} role="radiogroup" aria-labelledby={`${id}-label`} className="mt-2.5 flex flex-wrap gap-2">
        {THEME_CHOICES.map((choice, index) => {
          const on = choice === theme;
          const Mark = ICONS[choice];
          return (
            <Chip
              key={choice}
              ref={(el) => {
                radios.current[index] = el;
              }}
              role="radio"
              aria-checked={on}
              // The chip's own `aria-pressed` is a toggle's; a radio says it with `aria-checked` alone.
              aria-pressed={undefined}
              selected={on}
              tabIndex={on ? 0 : -1}
              onClick={() => {
                if (on) onCancel();
                else onPick(choice);
              }}
              onKeyDown={(e) => {
                const next = arrowTarget(e.key, index, THEME_CHOICES.length);
                if (next === null) return;
                e.preventDefault();
                radios.current[next]?.focus();
              }}
            >
              <Mark size={16} aria-hidden />
              {THEME_LABEL[choice]}
            </Chip>
          );
        })}
      </div>
    </div>
  );
}
