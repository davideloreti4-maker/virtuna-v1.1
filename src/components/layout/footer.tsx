import Link from "next/link"
import { Container } from "./container"

export function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="border-t border-[#262626] bg-[#0d0d0d]">
      <Container>
        <div className="py-8">
          {/* Single row with three columns */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            {/* Left - Logo & Copyright */}
            <div className="flex flex-col items-center md:items-start gap-1">
              <span className="text-sm text-white font-medium">Artificial Societies</span>
              <span className="text-xs text-[#6b6b6b]">
                &copy; {currentYear} Artificial Societies. All rights reserved.
              </span>
            </div>

            {/* Center - Legal Links */}
            <div className="flex items-center gap-6">
              <Link
                href="/privacy-notice"
                className="text-sm text-[#9CA3AF] hover:text-white transition-colors"
              >
                Privacy Policy
              </Link>
              <Link
                href="/terms-of-service"
                className="text-sm text-[#9CA3AF] hover:text-white transition-colors"
              >
                Terms of Service
              </Link>
              <Link
                href="/subprocessors"
                className="text-sm text-[#9CA3AF] hover:text-white transition-colors"
              >
                Subprocessors
              </Link>
            </div>

            {/* Right - Social Links */}
            <div className="flex items-center gap-4">
              <Link
                href="https://www.linkedin.com/company/artificial-societies"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#9CA3AF] hover:text-white transition-colors"
                aria-label="LinkedIn"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                </svg>
              </Link>
              <Link
                href="https://x.com/societiesio"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#9CA3AF] hover:text-white transition-colors"
                aria-label="X (Twitter)"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </Link>
              <Link
                href="mailto:founders@societies.io"
                className="text-[#9CA3AF] hover:text-white transition-colors"
                aria-label="Email"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <path d="M22 6l-10 7L2 6" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </Container>
    </footer>
  )
}
