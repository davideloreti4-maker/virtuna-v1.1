"use client";

/**
 * The page's one action, now that the composer has left the fold.
 *
 * The hero used to BE the entry: an embedded composer that signed the visitor in anonymously
 * on submit and pushed them into the thread with their run already in flight. Owner call
 * 2026-07-27: the demo below is a non-interactive probe and its composer is part of the shot,
 * so the real ask is a button. The visitor lands in the real thread with Test selected and an
 * empty composer, and types there.
 *
 * WHY THIS IS NOT A PLAIN LINK: `/home` redirects an unauthenticated visitor to `/login`. An
 * `<a href="/home?v=Test">` would bounce every cold visitor into a login wall — the exact
 * opposite of "free, no account". So the click mints the anonymous session first and pushes
 * afterwards. The real href stays on the anchor for crawlers, no-JS and modified clicks.
 *
 * PREWARM on hover/focus, not on mount. This preserves the seam `HeroEntry` measured on
 * 2026-07-27 — the sign-in round-trip held the visitor on /go for ~3s after pressing the
 * page's one button — while keeping the anonymous.ts rule's intent that a crawler
 * page-viewing must not mint a row. Fire-and-forget: the click awaits its own
 * `ensureAnonymousSession`, which is idempotent and reuses whatever the prewarm minted.
 *
 * TWO SHAPES, ONE BEHAVIOUR. `FreeEntryCta` covers the plain button sites; `useFreeEntry`
 * serves the four bespoke anchors (the two sticky bars, the nav pill, the footer link) that
 * carry their own classes and extra children, so none of them has to be reshaped to adopt
 * the session-minting click.
 */

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ensureAnonymousSession } from "@/lib/auth/anonymous";
import { cn } from "@/lib/utils";
import { FREE_ENTRY, primaryCtaClass } from "./cta-config";

export function useFreeEntry() {
  const router = useRouter();
  const [starting, setStarting] = useState(false);
  const [failed, setFailed] = useState(false);
  const prewarmedRef = useRef(false);

  const prewarm = () => {
    if (prewarmedRef.current) return;
    prewarmedRef.current = true;
    void ensureAnonymousSession();
  };

  const onClick = async (e: React.MouseEvent) => {
    // Let modified clicks (new tab, middle-click) fall through to the real href.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    if (starting) return;

    setStarting(true);
    setFailed(false);

    const session = await ensureAnonymousSession();
    if (!session.ok) {
      // Never strand them on a dead button at the one moment the page exists to convert. The
      // label becomes the retry affordance rather than a separate error row, so this behaves
      // identically in all eight places the entry is mounted.
      setStarting(false);
      setFailed(true);
      prewarmedRef.current = false;
      return;
    }

    router.push(FREE_ENTRY.href);
  };

  return {
    starting,
    failed,
    /** Spread onto any anchor to make it the free entry. */
    linkProps: {
      href: FREE_ENTRY.href,
      onClick,
      onPointerEnter: prewarm,
      onFocus: prewarm,
      "aria-busy": starting || undefined,
    },
    /** The label with its own busy/retry states — sites that show plain text can use it. */
    label: failed ? "Couldn't start — tap to retry" : starting ? "Starting…" : FREE_ENTRY.label,
  };
}

type Variant = "primary" | "secondary" | "link";

interface FreeEntryCtaProps {
  children?: React.ReactNode;
  variant?: Variant;
  size?: "md" | "lg";
  full?: boolean;
  className?: string;
}

const SECONDARY_CLASS =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-surface-elevated font-semibold text-foreground transition-colors hover:bg-surface-sunken";
const SECONDARY_SIZE = { md: "h-11 px-5 text-[14px]", lg: "h-12 px-6 text-[15px]" } as const;

export function FreeEntryCta({
  children,
  variant = "primary",
  size = "lg",
  full,
  className,
}: FreeEntryCtaProps) {
  const { linkProps, label, starting, failed } = useFreeEntry();

  const cls =
    variant === "primary"
      ? primaryCtaClass({ size, full, className })
      : variant === "secondary"
        ? cn(SECONDARY_CLASS, SECONDARY_SIZE[size], full && "w-full", className)
        : cn(
            "text-foreground-secondary transition-colors hover:text-foreground",
            className,
          );

  // A caller-supplied label is the site's own copy ("Start with a free test"); the busy and
  // retry states still take precedence, because they describe what the button is doing now.
  const text = starting || failed || !children ? label : children;

  return (
    <a {...linkProps} className={cls}>
      {text}
    </a>
  );
}
