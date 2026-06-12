"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";

import { joinWaitlist, type WaitlistState } from "@/app/(marketing)/actions";

/**
 * WaitlistForm — CTA-02 client island (the ONLY "use client" component on the page).
 *
 * Mirrors `src/app/(onboarding)/signup/signup-form.tsx` (`"use client"` +
 * `useActionState` + the `isPending` disable wiring) but DIVERGES per UI-SPEC §4:
 * native `<input>`/`<button>` with `.numen-surface` token classes (NOT the app's
 * `@/components/ui/*` glass kit), renders inline success/error from `state` instead
 * of redirecting, and adds the honeypot.
 *
 * Both `#cta` entry points (hero scroll-anchor + footer repeat) feed ONE waitlist,
 * distinguished by the hidden `source` field (server re-validates against a literal
 * allowlist — the field is never trusted raw).
 *
 * Color by token NAME only. `bg-accent`/`text-bg` + the focus-visible ring are the
 * ONLY accent on the page — reserved for the submit button fill + focus rings.
 * Success/duplicate render IDENTICAL copy (no enumeration leak, D-02).
 * Reduced-motion: the Loader2 spinner does not spin (`motion-reduce:animate-none`).
 */

// Carried verbatim from hero.tsx (← nav.tsx / footer.tsx) — the shared focus ring.
const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg";

export interface WaitlistFormProps {
  source: "landing-hero" | "landing-footer-cta";
}

export function WaitlistForm({ source }: WaitlistFormProps) {
  const [state, action, pending] = useActionState<WaitlistState, FormData>(
    joinWaitlist,
    { status: "idle" },
  );

  // Success AND duplicate land here with the SAME copy — never reveal membership.
  if (state.status === "success") {
    return (
      <p
        role="status"
        aria-live="polite"
        className="text-base leading-relaxed text-text"
      >
        You&apos;re on the list.
      </p>
    );
  }

  return (
    <form action={action} className="flex w-full max-w-md flex-col gap-2">
      <input type="hidden" name="source" value={source} />

      {/* Honeypot — visually hidden, offscreen for AT, never tab-focusable. */}
      <input
        type="text"
        name="company"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="sr-only"
      />

      <div className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor="waitlist-email" className="sr-only">
          Email address
        </label>
        <input
          id="waitlist-email"
          type="email"
          name="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          disabled={pending}
          className={`min-h-11 flex-1 rounded-lg border border-border bg-panel px-4 text-base text-text placeholder:text-text-muted disabled:opacity-60 ${FOCUS_RING}`}
        />
        <button
          type="submit"
          disabled={pending}
          className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-accent px-5 text-sm font-medium text-bg transition-opacity hover:opacity-90 disabled:opacity-60 ${FOCUS_RING}`}
        >
          {pending ? (
            <>
              <Loader2
                className="size-4 animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
              Joining…
            </>
          ) : (
            "Join the waitlist"
          )}
        </button>
      </div>

      {state.status === "error" && (
        <p
          role="alert"
          className="text-sm leading-relaxed text-text-muted"
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
