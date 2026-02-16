import type { Metadata } from "next";
import Link from "next/link";
import { Handshake } from "lucide-react";

export const metadata: Metadata = {
  title: "Brand Deals | Virtuna",
  description: "Connect with brands and monetize your content.",
};

export default function BrandDealsPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-6 sm:p-6 space-y-6">
      <div className="mb-2">
        <h1 className="text-3xl font-bold text-foreground mb-2">Brand Deals</h1>
        <p className="text-muted">
          Connect with brands and monetize your content through partnerships.
        </p>
      </div>

      <div className="rounded-xl border border-white/[0.06] p-4 sm:p-6 space-y-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]">
        <h2 className="text-xl font-semibold text-foreground">
          Virtuna Affiliate Program
        </h2>
        <p className="text-sm text-muted">
          Earn $10 for every creator you refer to Virtuna. Share your referral
          link and track conversions.
        </p>
        <Link
          href="/referrals"
          className="inline-block bg-white text-gray-950 rounded-lg px-4 py-2 text-sm font-medium hover:bg-white/90 transition-colors"
        >
          Go to Referral Program &rarr;
        </Link>
      </div>

      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/[0.06] px-6 py-16 text-center">
        <Handshake className="h-12 w-12 text-foreground-muted" />
        <h2 className="mt-4 text-xl font-semibold text-foreground">
          Brand Deal Marketplace
        </h2>
        <p className="mt-2 text-sm text-muted max-w-md">
          Browse brand partnerships, apply to campaigns, and manage your
          collaborations — all in one place. Coming soon.
        </p>
      </div>
    </div>
  );
}
