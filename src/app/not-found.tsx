import Link from "next/link";
import { House } from "@phosphor-icons/react/dist/ssr";

import { Button } from "@/components/ui/button";

/**
 * Global 404 page.
 * Flat-warm charcoal: solid charcoal bg, cream text, no glass.
 * Rendered by Next.js for any unmatched route.
 * Root layout.tsx provides the <html><body> wrapper.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background px-4">
      <h1 className="text-6xl font-bold tracking-tight text-foreground-muted">
        404
      </h1>
      <p className="text-lg text-foreground-secondary">
        Page not found
      </p>
      <p className="max-w-md text-center text-sm text-foreground-muted">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <Button variant="primary" className="mt-4" asChild>
        <Link href="/">
          <House className="h-4 w-4" />
          Go home
        </Link>
      </Button>
    </div>
  );
}
