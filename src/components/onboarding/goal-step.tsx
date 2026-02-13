"use client";

import { useState } from "react";
import { Briefcase, TrendingUp, DollarSign, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Heading, Text } from "@/components/ui/typography";
import {
  useOnboardingStore,
  type PrimaryGoal,
} from "@/stores/onboarding-store";
import { cn } from "@/lib/utils";

const GOALS: { id: PrimaryGoal; title: string; description: string; icon: LucideIcon }[] = [
  {
    id: "brand_deals",
    title: "Brand Deals",
    description: "Get matched with brands looking for creators in your niche",
    icon: Briefcase,
  },
  {
    id: "viral_content",
    title: "Viral Content",
    description: "Test your content with AI audiences before posting",
    icon: TrendingUp,
  },
  {
    id: "affiliate_revenue",
    title: "Affiliate Revenue",
    description: "Earn commissions by promoting products your audience loves",
    icon: DollarSign,
  },
];

export function GoalStep() {
  const { primaryGoal, setPrimaryGoal, setStep, skipOnboarding } =
    useOnboardingStore();
  const [selected, setSelected] = useState<PrimaryGoal | null>(primaryGoal);

  const handleContinue = () => {
    if (!selected) return;
    setPrimaryGoal(selected);
    setStep("preview");
  };

  const handleSkip = async () => {
    await skipOnboarding();
  };

  return (
    <div className="w-full space-y-6">
      <div className="text-center">
        <Heading level={3} className="mb-2">
          What&apos;s your primary goal?
        </Heading>
        <Text size="sm" muted>
          We&apos;ll tailor your dashboard to help you get there faster
        </Text>
      </div>

      <div className="space-y-3">
        {GOALS.map(({ id, title, description, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setSelected(id)}
            className={cn(
              "flex w-full items-center gap-4 rounded-xl border p-4 text-left transition-colors",
              selected === id
                ? "border-accent bg-accent/[0.08]"
                : "border-white/[0.06] bg-transparent hover:bg-white/[0.02]"
            )}
          >
            <div
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                selected === id
                  ? "bg-accent/20 text-accent"
                  : "bg-white/[0.05] text-foreground-secondary"
              )}
            >
              <Icon size={20} />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">{title}</p>
              <p className="text-xs text-foreground-secondary">{description}</p>
            </div>
          </button>
        ))}
      </div>

      <div className="space-y-3">
        <Button
          variant="primary"
          className="w-full"
          onClick={handleContinue}
          disabled={!selected}
        >
          Continue
        </Button>

        <button
          type="button"
          onClick={handleSkip}
          className="block w-full text-center text-sm text-foreground-secondary hover:text-foreground transition-colors"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}
