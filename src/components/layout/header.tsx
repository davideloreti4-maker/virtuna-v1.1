import { Container } from "./container"

export function Header() {
  return (
    <header className="border-b border-gray-200 bg-white">
      <Container>
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <div className="flex items-center">
            <span className="text-xl font-semibold text-gray-900">Virtuna</span>
          </div>

          {/* Navigation - hidden on mobile, visible on desktop */}
          <nav className="hidden md:flex md:gap-x-8">
            {/* Navigation links will be added in Phase 3 */}
          </nav>

          {/* Actions - Auth buttons will be added later */}
          <div className="flex items-center gap-x-4">
            {/* Auth buttons placeholder */}
          </div>
        </div>
      </Container>
    </header>
  )
}
