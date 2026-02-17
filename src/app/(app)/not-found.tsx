import Link from "next/link";
import { Home } from "lucide-react";

export default function AppNotFound() {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="max-w-md text-center">
        <p className="text-6xl font-bold text-zinc-800">404</p>
        <h2 className="mt-4 text-lg font-semibold text-white">
          Page not found
        </h2>
        <p className="mt-2 text-sm text-zinc-400">
          This page doesn&apos;t exist. It may have been moved or deleted.
        </p>
        <div className="mt-6">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-200"
          >
            <Home className="h-4 w-4" />
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
