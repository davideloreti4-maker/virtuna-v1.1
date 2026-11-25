"use client";

import * as React from "react";

import { EnrolError, useEarn, useEnrolWhop } from "@/hooks/queries/use-earn";
import type { EnrolRefusal } from "@/lib/earn/earn";

import { EarnScreen } from "./earn-screen";

/**
 * Earn with its data (plan 2026-11-24-earn, steps A and B): `useEarn` (GET /api/earn) into the screen,
 * and `useEnrolWhop` (POST /api/earn/whop) behind the card "Get paid". The page waits for its first
 * answer; a refused first read is the error line with Try again. A read that fails later (a refetch) keeps
 * the page and what it shows. An enrolment puts the page it answers in place.
 */
export function EarnNext(): React.JSX.Element {
  const earn = useEarn();
  const enrol = useEnrolWhop();
  const state = earn.data ? "ready" : earn.isError ? "error" : "loading";
  const onEnrol = async (username: string | undefined): Promise<EnrolRefusal | null> => {
    try {
      await enrol.mutateAsync(username);
      return null;
    } catch (err) {
      return err instanceof EnrolError ? err.refusal : "failed";
    }
  };
  return <EarnScreen state={state} page={earn.data ?? null} onRetry={() => void earn.refetch()} onEnrol={onEnrol} />;
}
