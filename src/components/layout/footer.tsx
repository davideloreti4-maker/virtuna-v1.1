import Link from "next/link";
import { cn } from "@/lib/utils";
import { GithubLogo, LinkedinLogo, XLogo } from "@phosphor-icons/react/dist/ssr";

interface FooterProps {
  className?: string;
}

const SOCIAL_LINKS = [
  {
    label: "X (Twitter)",
    href: "https://x.com/virtuna",
    icon: XLogo,
  },
  {
    label: "GitHub",
    href: "https://github.com/virtuna",
    icon: GithubLogo,
  },
  {
    label: "LinkedIn",
    href: "https://linkedin.com/company/virtuna",
    icon: LinkedinLogo,
  },
] as const;

/**
 * Minimal Virtuna footer with copyright and social links.
 * Follows Raycast design: border-top separator, muted text, clean layout.
 */
export function Footer({ className }: FooterProps) {
  const currentYear = new Date().getFullYear();

  return (
    <footer
      role="contentinfo"
      className={cn(
        "border-t border-white/[0.06]",
        className
      )}
    >
      <div className="mx-auto flex max-w-[72rem] flex-col items-center justify-between gap-4 px-6 py-8 md:flex-row md:px-8">
        {/* Copyright */}
        <p className="text-sm text-foreground-muted">
          &copy; {currentYear} Virtuna. All rights reserved.
        </p>

        {/* Links */}
        <div className="flex items-center gap-4">
          <Link
            href="/privacy"
            className="text-sm text-foreground-muted transition-colors hover:text-foreground"
          >
            Privacy
          </Link>
          <Link
            href="/terms"
            className="text-sm text-foreground-muted transition-colors hover:text-foreground"
          >
            Terms
          </Link>
        </div>

        {/* Social Icons */}
        <div className="flex items-center gap-1">
          {SOCIAL_LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-9 w-9 items-center justify-center rounded-md text-foreground-muted transition-colors hover:text-foreground"
              aria-label={link.label}
            >
              <link.icon className="h-[18px] w-[18px]" weight="fill" />
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}
