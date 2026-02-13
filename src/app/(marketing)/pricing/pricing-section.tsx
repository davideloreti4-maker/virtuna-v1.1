"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui";
import { FadeIn } from "@/components/motion";
import { Check, X } from "@phosphor-icons/react";
import { CheckoutModal } from "@/components/app/checkout-modal";
import { createClient } from "@/lib/supabase/client";

interface PricingFeature {
  name: string;
  starter: boolean | string;
  pro: boolean | string;
}

const features: PricingFeature[] = [
  { name: "Viral prediction score", starter: "5 / month", pro: "Unlimited" },
  { name: "Trend intelligence", starter: "Basic", pro: "Advanced" },
  { name: "Audience insights", starter: false, pro: true },
  { name: "Brand deal matching", starter: false, pro: true },
  { name: "Content calendar suggestions", starter: false, pro: true },
  { name: "Priority support", starter: false, pro: true },
  { name: "Hive visualization", starter: true, pro: true },
  { name: "Export reports", starter: false, pro: true },
];

function FeatureValue({ value }: { value: boolean | string }) {
  if (value === true) {
    return <Check size={18} weight="bold" className="text-accent mx-auto" />;
  }
  if (value === false) {
    return <X size={18} weight="bold" className="text-foreground-muted/50 mx-auto" />;
  }
  return <span className="text-sm text-white">{value}</span>;
}

export function PricingSection() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [checkoutPlan, setCheckoutPlan] = useState<"starter" | "pro" | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setIsAuthenticated(true);
    };
    checkAuth();
  }, []);

  return (
    <section className="py-24">
      <div className="mx-auto max-w-5xl px-6">
        {/* Header */}
        <FadeIn>
          <div className="text-center mb-16">
            <h1 className="text-[36px] sm:text-[44px] md:text-[52px] leading-[1.1] font-normal text-white">
              Simple, transparent pricing
            </h1>
            <p className="mt-4 text-lg text-white/80 max-w-xl mx-auto">
              Start with a 7-day free Pro trial. No feature limits during the
              trial. Cancel anytime.
            </p>
          </div>
        </FadeIn>

        {/* Pricing Cards */}
        <FadeIn delay={0.1}>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 mb-16">
            {/* Starter */}
            <div
              className="rounded-[12px] border border-white/[0.06] p-8"
              style={{
                boxShadow: "rgba(255, 255, 255, 0.05) 0px 1px 0px 0px inset",
              }}
            >
              <div className="mb-8">
                <h3 className="text-lg font-medium text-white">Starter</h3>
                <p className="mt-1 text-sm text-foreground-muted">
                  For creators getting started with content intelligence
                </p>
                <div className="mt-6 flex items-baseline gap-1">
                  <span className="text-[48px] font-normal text-white">$19</span>
                  <span className="text-foreground-muted">/month</span>
                </div>
              </div>
              {isAuthenticated ? (
                <Button
                  variant="secondary"
                  size="lg"
                  className="w-full"
                  onClick={() => setCheckoutPlan("starter")}
                >
                  Get started
                </Button>
              ) : (
                <Button variant="secondary" size="lg" className="w-full" asChild>
                  <Link href="/auth/signup?plan=starter">Get started</Link>
                </Button>
              )}
            </div>

            {/* Pro */}
            <div
              className="relative rounded-[12px] border border-accent/30 p-8"
              style={{
                boxShadow: "rgba(255, 127, 80, 0.1) 0px 1px 0px 0px inset",
              }}
            >
              <div className="absolute -top-3 left-8">
                <span className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
                  Most popular
                </span>
              </div>
              <div className="mb-8">
                <h3 className="text-lg font-medium text-white">Pro</h3>
                <p className="mt-1 text-sm text-foreground-muted">
                  Everything you need to grow and monetize
                </p>
                <div className="mt-6 flex items-baseline gap-1">
                  <span className="text-[48px] font-normal text-white">$49</span>
                  <span className="text-foreground-muted">/month</span>
                </div>
              </div>
              {isAuthenticated ? (
                <Button
                  variant="primary"
                  size="lg"
                  className="w-full"
                  onClick={() => setCheckoutPlan("pro")}
                >
                  Start free trial
                </Button>
              ) : (
                <Button variant="primary" size="lg" className="w-full" asChild>
                  <Link href="/auth/signup?plan=pro">Start free trial</Link>
                </Button>
              )}
            </div>
          </div>
        </FadeIn>

        {/* Comparison Table */}
        <FadeIn delay={0.2}>
          <div className="rounded-[12px] border border-white/[0.06] overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="py-4 px-6 text-left text-sm font-medium text-foreground-muted">
                    Feature
                  </th>
                  <th className="py-4 px-6 text-center text-sm font-medium text-white w-32">
                    Starter
                  </th>
                  <th className="py-4 px-6 text-center text-sm font-medium text-accent w-32">
                    Pro
                  </th>
                </tr>
              </thead>
              <tbody>
                {features.map((feature, index) => (
                  <tr
                    key={feature.name}
                    className={
                      index < features.length - 1
                        ? "border-b border-white/[0.04]"
                        : ""
                    }
                  >
                    <td className="py-4 px-6 text-sm text-white">
                      {feature.name}
                    </td>
                    <td className="py-4 px-6 text-center">
                      <FeatureValue value={feature.starter} />
                    </td>
                    <td className="py-4 px-6 text-center">
                      <FeatureValue value={feature.pro} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </FadeIn>
      </div>

      {checkoutPlan && (
        <CheckoutModal
          open={!!checkoutPlan}
          onClose={() => setCheckoutPlan(null)}
          planId={checkoutPlan}
        />
      )}
    </section>
  );
}
