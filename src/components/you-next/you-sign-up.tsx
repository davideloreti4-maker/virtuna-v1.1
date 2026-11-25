"use client";

import * as React from "react";

import { usePushedTitle } from "@/components/result/use-pushed-title";
import { Card } from "@/components/ui/card";

import { SettingsRow } from "./row-parts";
import { SIGN_UP_LINE } from "./you-words";

/**
 * You for a /go funnel visitor (an anonymous session): one card asking them to create an account,
 * then the page's own Settings row (on the phone the menu leads here, and to Settings as well). Nothing
 * on it saves or reads: an anonymous session never gets a creator_profiles row.
 * The card carries no button: the new look has no sign-up path for an anonymous session (plan open
 * point C2).
 */
export function YouSignUp(): React.JSX.Element {
  usePushedTitle("You");
  return (
    <div data-testid="you-sign-up" className="flex w-full flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-[720px] flex-col px-4 pb-12 pt-1 md:pb-16 md:pt-11">
        {/* The global h1 tracking is unlayered and beats a utility: inline. */}
        <h1 className="hidden pb-[18px] text-3xl font-bold leading-[35px] text-foreground md:block" style={{ letterSpacing: "-0.035em" }}>
          You
        </h1>
        <Card className="p-[18px]">
          <p className="text-title font-[430] text-foreground">{SIGN_UP_LINE}</p>
        </Card>
        <SettingsRow />
      </div>
    </div>
  );
}
