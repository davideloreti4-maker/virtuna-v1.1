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
      {/* `w-full min-w-0`, and both halves are load-bearing. This was a bare <div> inside an
          `items-center` flex, so it sized to its CONTENT rather than to the viewport: the
          calibration card's 3-column post grid pushed it past 390px and the reveal was severed
          at both edges — "…read @garyvee", "8K plays", "Use this audien…". It never showed up
          as a horizontal scrollbar (an ancestor clips rather than scrolls, which is why a
          scrollWidth-vs-clientWidth probe passes while content is being cut off), so it has to
          be measured on the element, not the document. `min-w-0` stops a wide grid child from
          re-inflating it through min-content. */}
      <div className="w-full min-w-0 max-w-[560px]">{children}</div>
    </div>
  );
}
