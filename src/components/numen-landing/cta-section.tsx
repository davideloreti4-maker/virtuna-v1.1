import { WaitlistForm } from "@/components/numen-landing/waitlist-form";

/**
 * CtaSection — CTA-02 RSC wrapper for the footer waitlist form (#cta slot).
 *
 * Static RSC (mirrors how-it-works.tsx hosting a child artifact). The `#cta` `<h2>`
 * is owned by the SectionShell slot in page.tsx — this emits NO heading, only a
 * one-line lead + the form. `<WaitlistForm>` is the only `"use client"` island; this
 * wrapper stays RSC. The hero CTA scroll-anchors to this same form; both feed ONE
 * waitlist (this placement is `source="landing-footer-cta"`).
 *
 * Color by token NAME only — no accent here (accent lives on the form submit button).
 * Every string passes VOICE (second person, no hype, no fake precision).
 */
export function CtaSection() {
  return (
    <div className="mt-6 flex flex-col gap-8 md:mt-8">
      <p className="max-w-md text-base leading-relaxed text-text-muted md:text-lg">
        Get an honest verdict on your content before you post. Join the waitlist —
        we&apos;ll let you know when it&apos;s your turn.
      </p>
      <WaitlistForm source="landing-footer-cta" />
    </div>
  );
}
