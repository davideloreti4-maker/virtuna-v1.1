import Link from "next/link";
import { cn } from "@/lib/utils";
import { XLogo, Envelope } from "@phosphor-icons/react/dist/ssr";

interface FooterProps {
  className?: string;
}

export function Footer({ className }: FooterProps) {
  const currentYear = new Date().getFullYear();

  return (
    <footer role="contentinfo" className={cn("py-24", className)}>
      <div className="mx-auto max-w-4xl px-6">
        {/* CTA Section */}
        <div className="mb-16 text-center">
          <h2 className="text-[32px] font-normal leading-[36px] text-white sm:text-[40px] sm:leading-[44px]">
            Ready to create smarter?
          </h2>
          <p className="mt-4 text-lg text-white/80">
            Join creators using AI to predict viral content and maximize
            earnings.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/signup"
              className="min-h-[44px] rounded-lg bg-accent px-6 py-3 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/90"
            >
              Start free trial
            </Link>
            <Link
              href="/pricing"
              className="min-h-[44px] rounded-lg border border-white/20 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-white/5"
            >
              See pricing
            </Link>
          </div>
        </div>

        {/* Footer Bar */}
        <div className="flex flex-col items-center gap-8 border-t border-white/10 pt-8 md:flex-row md:justify-between">
          <div className="text-center md:text-left">
            <div className="font-medium text-white">Virtuna</div>
            <div className="mt-1 text-sm text-gray-400">
              &copy; {currentYear} Virtuna. All rights reserved.
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6">
            <Link
              href="/coming-soon"
              className="text-sm text-gray-400 transition-colors hover:text-white"
            >
              Privacy Policy
            </Link>
            <Link
              href="/coming-soon"
              className="text-sm text-gray-400 transition-colors hover:text-white"
            >
              Terms of Service
            </Link>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="https://x.com/virtuna"
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-11 w-11 items-center justify-center text-gray-400 transition-colors hover:text-white"
              aria-label="X (Twitter)"
            >
              <XLogo className="h-5 w-5" weight="fill" />
            </a>
            <a
              href="mailto:hello@virtuna.io"
              className="flex h-11 w-11 items-center justify-center text-gray-400 transition-colors hover:text-white"
              aria-label="Email"
            >
              <Envelope className="h-5 w-5" weight="fill" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
