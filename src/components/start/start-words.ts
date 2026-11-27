/**
 * Every word on /start's four screens (funnel spec §3.2; the sketch's screens 2–5). Plain and short; no price
 * or trial words here (those come from `src/lib/pricing.ts` in part 3).
 */
import { OTP_LENGTH } from "@/lib/auth/otp";
import type { Goal, Platform } from "@/lib/onboarding/answers";

const PLATFORM_NAME: Record<Platform, string> = { tiktok: "TikTok", instagram: "Instagram" };

export const START_WORDS = {
  back: "Back",
  progress: "Your setup",
  stepOf: (n: number) => `${n} of 3`,
  continue: "Continue",

  platformTitle: "Where do you post?",
  platformLine: "Pick one or both.",
  platformName: (p: Platform) => PLATFORM_NAME[p],
  handleLabel: (p: Platform) => `Your ${PLATFORM_NAME[p]} handle`,
  optional: "(optional)",
  handleHint:
    "Maven builds your own 1,000 viewers from your videos while you look around. Without it, you start with your niche's audience.",
  handleBad: (p: Platform) => `That doesn't look like a ${PLATFORM_NAME[p]} handle.`,
  skipHandle: "Skip the handle",

  nicheTitle: "What are your videos about?",
  nicheLine: "In your own words. Your outliers, scripts and viewers come from this.",
  nicheLabel: "What your videos are about",
  nichePlaceholder: "e.g. budget meals for students",
  nicheExamples: "e.g. “gym tips for beginners”, “my van life”, “skincare under $20”",
  nicheShort: "Write a few words about your videos.",
  or: "or",
  workItOut: "Let Maven work it out",
  workItOutLine: (handle: string) => `From your videos on @${handle}`,

  goalTitle: "What do you want most from your next 90 days?",
  goalLine: "Maven sets your first steps around it.",
  // The app's own primary_goal set, asked in these words (master plan, "Answers type"); also the chips on screen 5.
  goal: {
    growth: "More views and followers",
    engagement: "More likes, comments and shares",
    brand_deals: "Brand deals",
    conversion: "Sell my product or services",
  } satisfies Record<Goal, string>,

  accountTitle: "Save your setup",
  yourSetup: "Your answers",
  nicheFromVideos: "Niche from your videos",
  platformChip: (p: Platform, handle?: string) => (handle ? `${PLATFORM_NAME[p]} @${handle}` : PLATFORM_NAME[p]),
  emailLabel: "Email",
  emailPlaceholder: "you@email.com",
  sendCode: "Send my code",
  sending: "Sending…",
  codeTitle: "Enter the code we sent you",
  codeLabel: `${OTP_LENGTH}-digit code`,
  codeLine: "No password. The code is typed here, so it works inside TikTok and Instagram.",
  resend: "Send it again",
  resendIn: (seconds: number) => `Send it again in ${seconds}s`,
  changeEmail: "Change email",
  checking: "Checking…",
  saving: "Saving your setup…",
  signedInAs: (email: string) => `Signed in as ${email}`,
  signedIn: "You're signed in.",
  consent: "We'll email you about your setup and trial. Unsubscribe anytime.",
  consentBox: "Email me tips and reminders about my trial",
  saveFailed: "Couldn't save your setup. Try again.",
  somethingWrong: "Something went wrong. Try again.",
} as const;
