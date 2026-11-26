import Link from "next/link";

import { MavenLogo } from "@/components/brand/maven-logo";

import { HOME_LABEL } from "./auth-words";

/**
 * The new look's frame for the signed-out screens (the `(onboarding)` layout with the flag on): the
 * lockup at the top left, as the app's sidebar carries it, and the content centred a little above the
 * middle on the theme's ground. No card of its own: each screen draws its own.
 */
export function AuthFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="flex h-14 shrink-0 items-center px-5 md:h-16 md:px-7">
        <Link href="/" aria-label={HOME_LABEL} className="rounded-md text-foreground">
          <MavenLogo size={18} />
        </Link>
      </header>
      {/* `pb-[12vh]` lifts the column off the exact middle, where a form reads as sinking. */}
      <main className="flex flex-1 flex-col items-center justify-center px-4 pb-[12vh] pt-4">
        {/* `w-full min-w-0`: see the legacy layout; a wide child must not size the column. */}
        <div className="w-full min-w-0 max-w-[560px]">{children}</div>
      </main>
    </div>
  );
}
