import { Container } from "./container"

export function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="border-t border-gray-200 bg-gray-50">
      <Container>
        <div className="py-12 md:py-16">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
            {/* Brand Column */}
            <div className="md:col-span-1">
              <span className="text-xl font-semibold text-gray-900">Virtuna</span>
              <p className="mt-4 text-sm text-gray-600">
                AI-powered virtual assistant for modern workflows.
              </p>
            </div>

            {/* Links Column 1 */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Product</h3>
              <ul className="mt-4 space-y-3">
                {/* Links will be added in Phase 3 */}
              </ul>
            </div>

            {/* Links Column 2 */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Company</h3>
              <ul className="mt-4 space-y-3">
                {/* Links will be added in Phase 3 */}
              </ul>
            </div>

            {/* Links Column 3 */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Legal</h3>
              <ul className="mt-4 space-y-3">
                {/* Links will be added in Phase 3 */}
              </ul>
            </div>
          </div>

          {/* Copyright */}
          <div className="mt-12 border-t border-gray-200 pt-8">
            <p className="text-sm text-gray-600">
              &copy; {currentYear} Virtuna. All rights reserved.
            </p>
          </div>
        </div>
      </Container>
    </footer>
  )
}
