"use client";

import { useActionState } from "react";
import Link from "next/link";
import { MailCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { InputField } from "@/components/ui/input";
import { Heading, Text } from "@/components/ui/typography";
import { requestPasswordReset } from "./actions";

/**
 * Ask for the reset email. The submitted state says "if an account exists" on purpose —
 * this form must not confirm which emails are customers (see actions.ts).
 */
export function ForgotPasswordForm() {
  const [state, formAction, isPending] = useActionState(requestPasswordReset, null);

  return (
    <div
      className="w-full max-w-[400px] rounded-[12px] border border-white/[0.06] px-8 py-10"
      style={{
        backgroundColor: "var(--color-charcoal-chip)",
        boxShadow: "rgba(255,255,255,0.05) 0 1px 0 0 inset",
      }}
    >
      <div className="mb-8 text-center">
        <Heading level={3} className="mb-2">
          Reset your password
        </Heading>
        <Text size="sm" muted>
          {state?.sent
            ? "Check your inbox"
            : "We'll email you a link to set a new one"}
        </Text>
      </div>

      {state?.sent ? (
        <div className="flex items-start gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
          <MailCheck size={14} className="mt-0.5 shrink-0 text-foreground-secondary" />
          <Text size="sm" className="text-foreground-secondary">
            If an account exists for that email, a reset link is on its way. The link is
            valid for one hour.
          </Text>
        </div>
      ) : (
        <form action={formAction} className="space-y-4">
          <InputField
            label="Email"
            name="email"
            type="email"
            placeholder="you@example.com"
            required
          />
          <Button type="submit" variant="primary" className="w-full" loading={isPending}>
            Send reset link
          </Button>
        </form>
      )}

      <Text size="sm" muted className="mt-8 text-center">
        Remembered it?{" "}
        <Link href="/login" className="text-foreground-secondary hover:underline">
          Sign in
        </Link>
      </Text>
    </div>
  );
}
