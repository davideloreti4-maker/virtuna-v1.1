"use client";

import { CopyButton } from "./CopyButton";

interface ReferralLinkCardProps {
  referralLink: string;
}

export function ReferralLinkCard({ referralLink }: ReferralLinkCardProps) {
  return (
    <div className="rounded-[12px] border border-white/[0.06] p-6 space-y-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]">
      <div>
        <h2 className="text-xl font-semibold text-foreground mb-2">
          Your Referral Link
        </h2>
        <p className="text-sm text-muted">
          Share this link with friends. When they sign up and purchase a
          subscription, you&apos;ll earn $10.
        </p>
      </div>

      <div className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.03] border border-white/[0.05]">
        <code className="flex-1 text-sm text-foreground font-mono truncate">
          {referralLink}
        </code>
        <CopyButton text={referralLink} />
      </div>

      <p className="text-xs text-muted">
        Tip: Share on social media, in your TikTok bio, or with creator friends.
      </p>
    </div>
  );
}
