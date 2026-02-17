"use client";

import { Button } from "@/components/ui/button";
import { Heading, Text } from "@/components/ui/typography";
import { HiveDemoCanvas } from "@/components/hive-demo/hive-demo-canvas";
import { useOnboardingStore } from "@/stores/onboarding-store";

export function PreviewStep() {
  const { tiktokHandle, completeOnboarding } = useOnboardingStore();

  const handleComplete = async () => {
    await completeOnboarding();
  };

  return (
    <div className="w-full space-y-6">
      <div className="text-center">
        <Heading level={3} className="mb-2">
          Your AI society is ready
        </Heading>
        <Text size="sm" muted>
          {tiktokHandle
            ? `Here's a preview of your personalized hive, @${tiktokHandle}`
            : "Here's a preview of your AI society"}
        </Text>
      </div>

      <div className="relative mx-auto h-[240px] w-full overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02]">
        <HiveDemoCanvas />
      </div>

      <Button
        variant="primary"
        className="w-full"
        onClick={handleComplete}
      >
        Go to Dashboard
      </Button>
    </div>
  );
}
