import Link from "next/link";
import { House } from "@phosphor-icons/react/dist/ssr";

import { Button } from "@/components/ui/button";

export default function AppNotFound() {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="max-w-md text-center">
        <p className="text-6xl font-bold text-foreground-muted">404</p>
        <h2 className="mt-4 text-lg font-semibold text-foreground">
          Page not found
        </h2>
        <p className="mt-2 text-sm text-foreground-secondary">
          This page doesn&apos;t exist. It may have been moved or deleted.
        </p>
        <div className="mt-6">
          <Button variant="primary" size="sm" asChild>
            <Link href="/home">
              <House className="h-4 w-4" />
              Back home
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
