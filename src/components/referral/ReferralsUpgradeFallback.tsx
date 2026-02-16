import Link from "next/link";
import { Zap } from "lucide-react";

export function ReferralsUpgradeFallback() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-6 sm:p-6 space-y-6">
      <div className="mb-2">
        <h1 className="text-3xl font-bold text-foreground mb-2">Referral Program</h1>
        <p className="text-muted">Invite friends to Virtuna and earn rewards for every conversion.</p>
      </div>
      <div className="rounded-lg border border-white/[0.06] bg-surface p-6 text-center">
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#FF7F50]/10">
          <Zap className="h-5 w-5 text-[#FF7F50]" />
        </div>
        <h3 className="text-sm font-medium text-white">Pro Feature</h3>
        <p className="mt-1 text-sm text-zinc-400">
          Upgrade to Pro to unlock the referral program and start earning.
        </p>
        <Link
          href="/pricing"
          className="mt-4 inline-block rounded-lg bg-[#FF7F50] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#FF7F50]/90"
        >
          View pricing
        </Link>
      </div>
    </div>
  );
}
