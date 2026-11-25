"use client";

import * as React from "react";
import { useId, useLayoutEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { whopUsernameOf, type EarnWhop, type EnrolRefusal } from "@/lib/earn/earn";
import { GET_PAID_STRINGS, paidByLine } from "@/lib/earn/earn-words";
import { cn } from "@/lib/utils";

/**
 * The card `Get paid` on Earn (plan 2026-11-24-earn, step B; rulings 13, 17, 33 and 43): enrolling at Whop is
 * the creator's own act. Its states:
 * - Whop not configured here: "Payouts aren't available yet." and nothing offered.
 * - A paying customer not yet enrolled: the line about Whop, the line that earlier sales are not credited
 *   (ruling 43), and one button, `Set up payouts`.
 * - Anyone else not yet enrolled: the two lines, "Add your Whop username to get paid.", the field `Whop
 *   username` and `Save` (Enter saves too).
 * - Enrolled: who Whop pays and when, and a quiet `Change`, which opens the field (Escape goes back). The
 *   line about earlier sales is not shown to an enrolled creator, with the field open or not.
 *
 * The part sends nothing: `onEnrol` does (the container's mutation), answering null when it is done or
 * the refusal. While it runs the button says it waits (`aria-busy`, `aria-disabled`, never `disabled`: the
 * focus stays) and another press sends nothing. A refusal is a line under the field or the button (a Whop
 * account that is another creator's already has its own words). Done, the focus lands on `Change`.
 */
export interface GetPaidProps {
  whop: EarnWhop;
  onEnrol(username: string | undefined): Promise<EnrolRefusal | null>;
  className?: string;
}

const S = GET_PAID_STRINGS;
/** The page's buttons and field: 48 tall, round, 15. */
const PILL = "h-12 px-5 text-ui next:rounded-full";

/** The words of a refusal: by the field, Whop not finding the name is its own line. */
function wordsOf(refusal: EnrolRefusal, byField: boolean): string {
  if (refusal === "not_available") return S.notAvailable;
  if (refusal === "already_connected") return S.alreadyConnected;
  if (byField && (refusal === "not_found" || refusal === "invalid_username")) return S.notFound;
  return S.failed;
}

export function GetPaid({ whop, onEnrol, className }: GetPaidProps): React.JSX.Element {
  const titleId = useId();
  const fieldId = useId();
  const errorId = useId();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Held at once, before a render: a second press in the same moment sends nothing.
  const running = useRef(false);
  const fieldRef = useRef<HTMLInputElement>(null);
  const changeRef = useRef<HTMLButtonElement>(null);
  // Where the focus goes once the card has turned: "change" after an enrolment or Escape, "field" for Change.
  const focusNext = useRef<"change" | "field" | null>(null);

  const enrolled = whop.username !== null;
  const view = !whop.canEnrol ? "unavailable" : enrolled && !editing ? "enrolled" : whop.knownAccount && !enrolled ? "button" : "field";

  useLayoutEffect(() => {
    const target = focusNext.current === "change" ? changeRef.current : focusNext.current === "field" ? fieldRef.current : null;
    if (!target) return;
    focusNext.current = null;
    target.focus();
  });

  async function enrol(username: string | undefined, byField: boolean) {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setError(null);
    const refusal = await onEnrol(username);
    running.current = false;
    setBusy(false);
    if (refusal === null) {
      setEditing(false);
      setText("");
      focusNext.current = "change";
      return;
    }
    setError(wordsOf(refusal, byField));
    if (byField) focusNext.current = "field";
  }

  function save(e?: React.FormEvent) {
    e?.preventDefault();
    if (running.current) return;
    const username = whopUsernameOf(text);
    if (!username) {
      setError(S.notFound);
      fieldRef.current?.focus();
      return;
    }
    void enrol(username, true);
  }

  return (
    <section aria-labelledby={titleId} className={cn("min-w-0", className)}>
      <Card className="p-[18px]">
        <h2 id={titleId} className="text-title font-[640] text-foreground">
          {S.title}
        </h2>
        {view === "unavailable" ? (
          <p className="mt-1.5 text-ui text-foreground-secondary">{S.notAvailable}</p>
        ) : (
          <>
            <p className="mt-1.5 text-ui text-foreground-secondary">{S.lead}</p>
            {!enrolled && <p className="mt-1.5 text-ui text-foreground-secondary">{S.notCredited}</p>}
            {view === "enrolled" && (
              <div className="mt-3 flex items-start gap-3">
                <p className="min-w-0 flex-1 pt-2.5 text-ui text-foreground">{paidByLine(whop.username!)}</p>
                <Button
                  ref={changeRef}
                  type="button"
                  variant="quiet"
                  onClick={() => {
                    setEditing(true);
                    setError(null);
                    focusNext.current = "field";
                  }}
                  className="h-11 shrink-0 px-4 text-ui next:rounded-full"
                >
                  {S.change}
                </Button>
              </div>
            )}
            {view === "button" && (
              <>
                <Button
                  type="button"
                  variant="primary"
                  aria-busy={busy || undefined}
                  aria-disabled={busy || undefined}
                  aria-describedby={error ? errorId : undefined}
                  onClick={() => void enrol(undefined, false)}
                  className={cn(PILL, "mt-3 w-full aria-disabled:opacity-40")}
                >
                  {S.setUp}
                </Button>
                {error && <ErrorLine id={errorId}>{error}</ErrorLine>}
              </>
            )}
            {view === "field" && (
              <form
                noValidate
                onSubmit={save}
                onKeyDown={(e) => {
                  // Escape that dismisses a composition candidate belongs to the field.
                  if (e.key !== "Escape" || !editing || busy || e.nativeEvent.isComposing) return;
                  e.preventDefault();
                  setEditing(false);
                  setError(null);
                  setText("");
                  focusNext.current = "change";
                }}
                className="mt-3"
              >
                <p className="text-ui text-foreground">{S.addUsername}</p>
                <label htmlFor={fieldId} className="mt-3 block text-meta text-foreground-secondary">
                  {S.field}
                </label>
                <div className="mt-1.5 flex gap-2">
                  <input
                    id={fieldId}
                    ref={fieldRef}
                    type="text"
                    value={text}
                    // 64, and room for the "@" that is dropped.
                    maxLength={65}
                    placeholder={S.placeholder}
                    autoComplete="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    enterKeyHint="done"
                    readOnly={busy}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? errorId : undefined}
                    onChange={(e) => {
                      setText(e.target.value);
                      setError(null);
                    }}
                    // 16 on the phone: iOS zooms the page into a field set smaller. 15 from 768.
                    className="h-12 min-w-0 flex-1 rounded-full bg-surface-sunken px-4 text-title text-foreground placeholder:text-foreground-muted md:text-ui"
                  />
                  <Button
                    type="submit"
                    variant="primary"
                    aria-busy={busy || undefined}
                    aria-disabled={busy || undefined}
                    className={cn(PILL, "shrink-0 aria-disabled:opacity-40")}
                  >
                    {S.save}
                  </Button>
                </div>
                {error && <ErrorLine id={errorId}>{error}</ErrorLine>}
              </form>
            )}
          </>
        )}
      </Card>
    </section>
  );
}

/** A refusal: in ink (no colour), announced. */
function ErrorLine({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <p id={id} role="alert" className="mt-2 px-0.5 text-meta font-[560] text-foreground">
      {children}
    </p>
  );
}
