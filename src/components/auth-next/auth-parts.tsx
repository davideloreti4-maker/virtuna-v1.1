"use client";

import * as React from "react";
import Link from "next/link";

import { FIELD, FIELD_LABEL } from "@/components/settings-next/password-row";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

import { GOOGLE, OR } from "./auth-words";

/**
 * The pieces every new-look auth screen is built from. The page is the theme's ground; the form sits
 * on one card (the new look's surface and resting shadow), the heading above it in the Home
 * greeting's voice, one quiet link under it. No colour: primary actions are ink, errors are a line.
 */

/** The heading and its line, above the card. */
export function AuthHeading({ title, line }: { title: string; line: string }) {
  return (
    <div className="mb-7 text-center">
      {/* The global h1 tracking is unlayered and beats a utility: set inline (as Home does). */}
      <h1
        className="text-3xl font-bold leading-[35px] text-foreground md:text-[34px] md:leading-[40px]"
        style={{ letterSpacing: "-0.035em" }}
      >
        {title}
      </h1>
      <p className="mt-2 text-ui text-foreground-secondary">{line}</p>
    </div>
  );
}

/** The one card the form sits on. 400 at most, the width of a sign-in column. */
export function AuthCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("mx-auto w-full max-w-[400px]", className)}>
      <div className="rounded-3xl bg-surface p-5 shadow-[var(--shadow-rest)] md:p-6">{children}</div>
    </div>
  );
}

/** A sentence for the visitor before the form: why they are here (expired, deleted, a message). */
export function Notice({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div role="status" className="mb-4 flex items-start gap-2.5 rounded-xl bg-surface-sunken px-3.5 py-3 text-meta text-foreground-secondary">
      {icon && <span className="mt-px shrink-0 [&>svg]:size-4">{icon}</span>}
      <span>{children}</span>
    </div>
  );
}

/** A labelled field, Settings' field (16 on the phone so iOS does not zoom, 15 from 768). */
export const Field = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; invalid?: boolean }
>(function Field({ label, hint, invalid, id, className, ...input }, ref) {
  const autoId = React.useId();
  const fieldId = id ?? autoId;
  const hintId = hint ? `${fieldId}-hint` : undefined;
  return (
    <div>
      <label htmlFor={fieldId} className={FIELD_LABEL}>
        {label}
      </label>
      <input
        ref={ref}
        id={fieldId}
        aria-invalid={invalid || undefined}
        aria-describedby={hintId}
        className={cn(FIELD, "mt-1.5", className)}
        {...input}
      />
      {hint && (
        <p id={hintId} className="mt-1.5 px-0.5 text-meta text-foreground-muted">
          {hint}
        </p>
      )}
    </div>
  );
});

/** A refusal, in the foreground (the new look draws errors as a line, not in red). */
export function AuthError({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="px-0.5 text-meta font-[560] text-foreground">
      {children}
    </p>
  );
}

/** The ink primary action, full width. */
export function PrimaryButton(props: React.ComponentProps<typeof Button>) {
  return <Button variant="primary" size="md" {...props} className={cn("w-full", props.className)} />;
}

/** A quiet text action inside the card (resend, change email, password instead). */
export function TextAction({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        "rounded-md text-meta font-[560] text-foreground-secondary transition-colors hover:text-foreground disabled:opacity-40",
        className,
      )}
      {...props}
    />
  );
}

/** "or", between the hairlines. */
export function OrRule() {
  return (
    <div className="my-5 flex items-center gap-3" aria-hidden="true">
      <span className="h-px flex-1 bg-border" />
      <span className="text-meta text-foreground-muted">{OR}</span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

/** Google's sign-in, back to `next` (Home when there is none). */
export function GoogleButton({ next }: { next?: string }) {
  const start = async () => {
    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next || "/home")}`;
    await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
  };
  return (
    <Button type="button" variant="secondary" size="md" className="w-full gap-2.5" onClick={() => void start()}>
      <GoogleIcon />
      {GOOGLE}
    </Button>
  );
}

/** The one line under the card: "No account yet? Sign up". */
export function FootLink({ lead, href, label }: { lead: string; href: string; label: string }) {
  return (
    <p className="mt-6 text-center text-meta text-foreground-secondary">
      {lead}{" "}
      <Link href={href} className="font-[560] text-foreground underline-offset-4 hover:underline">
        {label}
      </Link>
    </p>
  );
}

/** Google's own four-colour G: a third party's mark, kept as Google draws it. */
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"
        fill="#34A853"
      />
      <path
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z"
        fill="#EA4335"
      />
    </svg>
  );
}
