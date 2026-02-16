"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { InputField } from "@/components/ui/input";
import { Heading, Text } from "@/components/ui/typography";
import { useOnboardingStore } from "@/stores/onboarding-store";

export function ConnectStep() {
  const { tiktokHandle, setTiktokHandle, setStep, skipOnboarding } =
    useOnboardingStore();
  const [handle, setHandle] = useState(tiktokHandle);
  const [error, setError] = useState<string | null>(null);

  const handleContinue = () => {
    const trimmed = handle.trim().replace(/^@/, "");
    if (!trimmed) {
      setError("Please enter your TikTok handle");
      return;
    }
    if (!/^[a-zA-Z0-9._]+$/.test(trimmed)) {
      setError("Handle can only contain letters, numbers, dots, and underscores");
      return;
    }
    setTiktokHandle(trimmed);
    setStep("goal");
  };

  const handleSkip = async () => {
    await skipOnboarding();
  };

  return (
    <div className="w-full space-y-6">
      <div className="text-center">
        <Heading level={3} className="mb-2">
          Connect your TikTok
        </Heading>
        <Text size="sm" muted>
          Enter your TikTok handle so we can personalize your experience
        </Text>
      </div>

      <div className="space-y-4">
        <InputField
          label="TikTok Handle"
          placeholder="@yourhandle"
          value={handle}
          onChange={(e) => {
            setHandle(e.target.value);
            setError(null);
          }}
          error={error ?? undefined}
        />

        <Button
          variant="primary"
          className="w-full"
          onClick={handleContinue}
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
