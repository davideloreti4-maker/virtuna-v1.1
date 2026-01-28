import Link from "next/link";
import { cn } from "@/lib/utils";
import { LinkedinLogo, XLogo, Envelope } from "@phosphor-icons/react/dist/ssr";

interface FooterProps {
  className?: string;
}

/**
 * Footer component matching societies.io design.
 * Includes CTA section + footer bar with social links.
 */
export function Footer({ className }: FooterProps) {
  const currentYear = new Date().getFullYear();

  return (
    <footer role="contentinfo" className={cn("py-24", className)}>
      <div className="mx-auto max-w-4xl px-6">
        {/* CTA Section */}
        <div className="mb-16 text-center">
          <h2 className="font-display text-[40px] font-[350] leading-[44px] text-white">
            Ready to understand your audience?
          </h2>
          <p className="mt-4 text-lg text-white/80">
            Join the world&apos;s leading organizations using AI to unlock human
            insights at scale.
          </p>
          <div className="mt-8 flex items-center justify-center gap-4">
            <Link
              href="https://calendly.com"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded bg-accent px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-accent/90"
            >
              Book a meeting
            </Link>
            <Link
              href="mailto:founders@societies.io"
              className="rounded border border-white/20 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-white/5"
            >
              Contact us
            </Link>
          </div>
        </div>

        {/* Footer Bar */}
        <div className="flex flex-col items-center gap-8 border-t border-white/10 pt-8 md:flex-row md:justify-between">
          {/* Left: Brand */}
          <div className="text-center md:text-left">
            <div className="font-medium text-white">Artificial Societies</div>
            <div className="mt-1 text-sm text-gray-400">
              &copy; {currentYear} Artificial Societies. All rights reserved.
            </div>
          </div>

          {/* Center: Legal Links */}
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
            <Link
              href="/coming-soon"
              className="text-sm text-gray-400 transition-colors hover:text-white"
            >
              Subprocessors
            </Link>
          </div>

          {/* Right: Social Links */}
          <div className="flex items-center gap-4">
            <a
              href="https://www.linkedin.com/company/artificial-societies"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 transition-colors hover:text-white"
              aria-label="LinkedIn"
            >
              <LinkedinLogo className="h-5 w-5" weight="fill" />
            </a>
            <a
              href="https://x.com/societiesio"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 transition-colors hover:text-white"
              aria-label="X (Twitter)"
            >
              <XLogo className="h-5 w-5" weight="fill" />
            </a>
            <a
              href="mailto:founders@societies.io"
              className="text-gray-400 transition-colors hover:text-white"
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
