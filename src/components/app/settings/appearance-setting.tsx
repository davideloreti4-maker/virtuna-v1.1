"use client";

import type { Icon as PhosphorIcon } from "@phosphor-icons/react";
import { Monitor, Moon, Sun } from "@phosphor-icons/react";
import { Chip } from "@/components/ui/chip";
import type { ThemeChoice } from "@/lib/theme/theme";
import { useThemeChoice } from "@/lib/theme/use-theme";

const OPTIONS: readonly { value: ThemeChoice; label: string; icon: PhosphorIcon }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "Match system", icon: Monitor },
];

/**
 * Appearance (new look, spec §5): Light (default), Dark, or Match system. Kept in this
 * browser (localStorage "maven-theme"); it is not synced to the account yet. The choice
 * applies at once, with no save button.
 */
export function AppearanceSetting() {
  const [choice, setChoice] = useThemeChoice();

  return (
    <section className="rounded-3xl bg-surface p-4 shadow-[var(--shadow-rest)]">
      <h3 id="appearance-heading" className="text-title font-[640] text-foreground">
        Appearance
      </h3>
      <div role="group" aria-labelledby="appearance-heading" className="mt-3 flex flex-wrap gap-2">
        {OPTIONS.map(({ value, label, icon: Glyph }) => {
          const selected = choice === value;
          return (
            <Chip
              key={value}
              surface="card"
              selected={selected}
              onClick={() => setChoice(value)}
            >
              {/* The reference chip mutes its icon; on the ink fill it takes the label's colour. */}
              <Glyph size={16} aria-hidden className={selected ? undefined : "text-foreground-secondary"} />
              {label}
            </Chip>
          );
        })}
      </div>
    </section>
  );
}
