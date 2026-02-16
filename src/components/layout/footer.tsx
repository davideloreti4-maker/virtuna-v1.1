import Link from "next/link";
import { cn } from "@/lib/utils";
import { XLogo, Envelope } from "@phosphor-icons/react/dist/ssr";

interface FooterProps {
  className?: string;
}

export function Footer({ className }: FooterProps) {
  const currentYear = new Date().getFullYear();

  return (
    <footer
      role="contentinfo"
      className={cn(
        "border-t border-white/[0.06] py-8",
        className
      )}
    >
      <div className="mx-auto max-w-4xl px-6">
        <div className="flex flex-col items-center gap-6 md:flex-row md:justify-between">
          <div className="text-center md:text-left">
            <div className="font-medium text-white">Virtuna</div>
            <div className="mt-1 text-sm text-foreground-muted">
              &copy; {currentYear} Virtuna. All rights reserved.
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6">
            <Link
              href="/coming-soon"
              className="text-sm text-foreground-muted transition-colors hover:text-white"
            >
              Privacy Policy
            </Link>
            <Link
              href="/coming-soon"
              className="text-sm text-foreground-muted transition-colors hover:text-white"
            >
              Terms of Service
            </Link>
            <a
              href="mailto:hello@virtuna.io"
              className="text-sm text-foreground-muted transition-colors hover:text-white"
            >
              Contact
            </a>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="https://x.com/virtuna"
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-9 w-9 items-center justify-center text-foreground-muted transition-colors hover:text-white"
              aria-label="X (Twitter)"
            >
              <XLogo className="h-4 w-4" weight="fill" />
            </a>
            <a
              href="mailto:hello@virtuna.io"
              className="flex h-9 w-9 items-center justify-center text-foreground-muted transition-colors hover:text-white"
              aria-label="Email"
            >
              <Envelope className="h-4 w-4" weight="fill" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
