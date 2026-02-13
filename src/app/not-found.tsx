import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background text-foreground">
      <h1 className="text-6xl font-bold tracking-tight">404</h1>
      <p className="text-foreground-secondary">This page doesn&apos;t exist.</p>
      <Link
        href="/"
        className="mt-2 text-sm text-accent underline underline-offset-4 hover:text-accent/80"
      >
        Back to home
      </Link>
    </div>
  );
}
