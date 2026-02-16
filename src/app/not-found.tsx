import Link from "next/link";

/**
 * Global 404 page.
 * Raycast design language: dark, minimal, centered.
 * Rendered by Next.js for any unmatched route.
 * Root layout.tsx provides <html><body> wrapper.
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
      <Link
        href="/"
        className="mt-4 inline-flex items-center justify-center rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/90"
      >
        Go home
      </Link>
    </div>
  );
}
