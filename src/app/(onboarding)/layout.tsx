import Link from "next/link";
import { MavenLogo } from "@/components/brand/maven-logo";

/**
 * Onboarding layout — minimal centered layout for auth and welcome pages.
 * No sidebar, no header. Dark background with centered content and the Maven logo.
 */
export default function OnboardingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="mb-8">
        <Link href="/" className="text-foreground" aria-label="Maven home">
          <MavenLogo size={28} />
        </Link>
      </div>
      <div>{children}</div>
    </div>
  );
}
