import Link from "next/link"
import { Container } from "./container"

export function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-[#0d0d0d]">
      <Container>
        <div className="flex h-[60px] items-center justify-between">
          {/* Logo + Brand Name */}
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl font-light text-white">Λ</span>
            <span className="text-[16px] font-medium text-white">Artificial Societies</span>
          </Link>

          {/* Right side - Auth buttons */}
          <div className="flex items-center gap-6">
            <Link
              href="/login"
              className="text-[14px] text-white hover:text-white/80 transition-colors"
            >
              Sign in
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center justify-center bg-[#E57850] text-white font-medium text-[14px] rounded-[4px] hover:bg-[#d46a45] transition-colors"
              style={{ padding: '8px 16px' }}
            >
              Book a Meeting
            </Link>
          </div>
        </div>
      </Container>
    </header>
  )
}
