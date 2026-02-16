import Link from "next/link";

/**
 * Onboarding layout — minimal centered layout for auth and welcome pages.
 * No sidebar, no header. Dark background with centered content and Virtuna logo.
 */
export default function OnboardingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      {/* Ambient glow */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 40%, rgba(255,127,80,0.06) 0%, transparent 70%)",
        }}
      />

      <div className="relative z-10 mb-8">
        <Link href="/" className="flex items-center gap-2.5">
          <svg
            width="32"
            height="32"
            viewBox="0 0 32 32"
            fill="none"
            className="text-white"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M16 6H13L8 27H11L16 6ZM16 6L21 27H24L19 6H16Z"
              fill="currentColor"
            />
          </svg>
          <span className="text-lg font-semibold text-foreground">Virtuna</span>
        </Link>
      </div>
      <div className="relative z-10">{children}</div>
    </div>
  );
}
