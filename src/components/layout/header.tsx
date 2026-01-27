import Link from "next/link"
import { Container } from "./container"
import { Button } from "@/components/ui/button"

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white">
      <Container>
        <div className="flex h-16 items-center justify-between">
          {/* Logo + Brand Name */}
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl font-light text-gray-900">Λ</span>
            <span className="text-lg font-medium text-gray-900">Artificial Societies</span>
          </Link>

          {/* Navigation - hidden on mobile, visible on desktop */}
          <nav className="hidden md:flex md:items-center md:gap-x-8">
            <Link
              href="/pricing"
              className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              Pricing
            </Link>
            <Link
              href="/about"
              className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              About
            </Link>
            <Link
              href="/blog"
              className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              Blog
            </Link>
          </nav>

          {/* Right side - Auth buttons */}
          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              Sign in
            </Link>
            <Button
              variant="primary"
              size="sm"
              rounded="full"
              asChild
            >
              <Link href="/contact">Book a Meeting</Link>
            </Button>
          </div>
        </div>
      </Container>
    </header>
  )
}
