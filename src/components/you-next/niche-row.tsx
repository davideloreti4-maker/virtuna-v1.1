"use client";

import * as React from "react";
import { useId, useLayoutEffect, useRef } from "react";

import { cn } from "@/lib/utils";

import { CancelButton, ErrorLine, RowButton, cancelOnEscape } from "./row-parts";
import { NO_NICHE, SAVE_FAILED, SEARCH_NICHES, nicheOptions } from "./you-words";

/**
 * Niche (spec §3.1): a pick from the existing list (`src/lib/niches/taxonomy.ts`). Open, a search
 * field over every niche; with no search each primary is followed by its subs, indented; a tap
 * saves at once (the screen closes the row when the save went through).
 */
export interface NicheRowProps {
  value: string | null;
  saved: { primary: string | null; sub: string | null };
  open: boolean;
  query: string;
  busy: boolean;
  failed: boolean;
  onOpen(): void;
  onQuery(text: string): void;
  onPick(primary: string, sub: string | null): void;
  onCancel(): void;
  buttonRef?: React.Ref<HTMLButtonElement>;
}

export function NicheRow(props: NicheRowProps): React.JSX.Element {
  if (!props.open) return <RowButton label="Niche" value={props.value} onOpen={props.onOpen} buttonRef={props.buttonRef} />;
  return <NichePicker {...props} />;
}

function NichePicker({ saved, query, busy, failed, onQuery, onPick, onCancel }: NicheRowProps) {
  const id = useId();
  const fieldRef = useRef<HTMLInputElement>(null);
  useLayoutEffect(() => {
    fieldRef.current?.focus();
  }, []);
  const searching = query.trim() !== "";
  const options = nicheOptions(query);
  return (
    <div className="pb-4 pt-3.5" onKeyDown={cancelOnEscape(busy, onCancel)}>
      <label htmlFor={`${id}-field`} className="block text-title font-[640] text-foreground">
        Niche
      </label>
      <input
        id={`${id}-field`}
        ref={fieldRef}
        type="text"
        value={query}
        // The visible label says "Niche"; the field's own name says what typing in it does.
        aria-label={SEARCH_NICHES}
        placeholder="Search"
        autoComplete="off"
        spellCheck={false}
        enterKeyHint="search"
        aria-controls={options.length > 0 ? `${id}-list` : undefined}
        onChange={(e) => onQuery(e.target.value)}
        className="mt-2 h-12 w-full rounded-full bg-surface-sunken px-4 text-title text-foreground placeholder:text-foreground-muted md:h-11 md:text-ui"
      />
      {failed && <ErrorLine>{SAVE_FAILED}</ErrorLine>}
      {options.length === 0 ? (
        <p className="mt-2 px-2 py-3 text-ui text-foreground-secondary">{NO_NICHE}</p>
      ) : (
        <ul id={`${id}-list`} aria-label="Niches" aria-busy={busy || undefined} className="mt-2 max-h-80 overflow-y-auto">
          {options.map((o) => {
            const chosen = o.primary === saved.primary && o.sub === (saved.sub ?? null);
            const indented = !searching && o.sub !== null;
            return (
              <li key={`${o.primary}/${o.sub ?? ""}`}>
                <button
                  type="button"
                  aria-label={o.label}
                  aria-pressed={chosen}
                  onClick={() => {
                    if (!busy) onPick(o.primary, o.sub);
                  }}
                  className={cn(
                    "flex min-h-11 w-full items-center rounded-xl px-2 text-left text-ui transition-colors duration-150 hover:bg-hover",
                    indented ? "pl-6 text-foreground-secondary" : "font-[560] text-foreground",
                    chosen && "bg-active text-foreground",
                  )}
                >
                  {indented ? o.subLabel : o.label}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <CancelButton busy={busy} onCancel={onCancel} />
    </div>
  );
}
