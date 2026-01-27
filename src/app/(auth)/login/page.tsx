import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export default function LoginPage() {
  return (
    <div className="flex flex-col text-app-text">
      {/* Logo - just Λ, no text */}
      <div className="mb-12">
        <span className="text-3xl font-light">Λ</span>
      </div>

      {/* Main Form */}
      <div className="flex flex-col space-y-6">
        {/* Header - Two lines */}
        <div className="space-y-1 mb-2">
          <h1 className="text-3xl font-bold tracking-tight">Welcome to</h1>
          <h1 className="text-3xl font-bold tracking-tight">Artificial Societies</h1>
        </div>

        {/* Subtext */}
        <p className="text-sm text-app-text-muted mb-4">
          Optimize your content using simulated networks of your audience.
        </p>

        {/* Google Sign In Button */}
        <Button
          variant="app-primary"
          size="lg"
          fullWidth
          className="h-11"
        >
          Continue with Google
        </Button>

        {/* Simple "or" divider - left-aligned like societies.io */}
        <div className="py-2">
          <span className="text-sm text-app-text-muted">or</span>
        </div>

        {/* Email Input */}
        <div className="space-y-3">
          <Input
            type="email"
            placeholder="Enter email address"
            variant="dark"
            inputSize="lg"
          />

          <Button
            variant="app-secondary"
            size="lg"
            fullWidth
            className="h-11"
          >
            Continue with email
          </Button>
        </div>
      </div>

      {/* Footer Links */}
      <div className="mt-auto pt-16 space-y-2">
        <p className="text-sm text-app-text-muted">
          Trouble logging in? Email us at{" "}
          <Link
            href="mailto:support@societies.io"
            className="text-app-text-muted underline hover:text-white transition-colors"
          >
            support@societies.io
          </Link>
        </p>
        <div className="flex items-center gap-2 text-sm text-app-text-muted">
          <Link href="/privacy" className="underline hover:text-white transition-colors">
            Privacy Notice
          </Link>
          <span>•</span>
          <Link href="/terms" className="underline hover:text-white transition-colors">
            Terms of Service
          </Link>
        </div>
      </div>
    </div>
  )
}
