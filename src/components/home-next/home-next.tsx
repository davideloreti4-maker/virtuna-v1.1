"use client";

import * as React from "react";
import { useState } from "react";

import { useSideNavCollapse } from "@/components/shell/use-side-nav-collapse";
import { useThreadActions } from "@/components/shell/use-thread-actions";
import { shownThreadTitle } from "@/components/shell/use-thread-title";
import { useThreadList, type ThreadSummary } from "@/hooks/queries";
import { useProfile } from "@/hooks/queries/use-profile";
import { timeAgo } from "@/lib/time-ago";

import { firstNameOf, greetingFor, initialsOf } from "./greeting";
import { HomeScreen, type HomeRecentRow, type HomeSkillId } from "./home-screen";

/**
 * Home with its data (spec 2026-11-23 §3): the greeting's name and the avatar from the profile,
 * the last chats from the sidebar's own list, and whether the sidebar shows them beside the page.
 * The composer draws it and hands in the field, the balance and the skill state.
 */

export const HOME_RECENT_LIMIT = 3;

const WEEK_MS = 7 * 24 * 3_600_000;
const DAY_MONTH = new Intl.DateTimeFormat("en", { month: "short", day: "numeric" });
const DAY_MONTH_YEAR = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" });

/** When a chat was last written to: "2h ago" within a week, then its date ("Oct 24"), with the
 *  year once it is not this one. "118d ago" asks the reader to do the sum. */
export function whenLabel(iso: string): string | null {
  const at = new Date(iso).getTime();
  const now = Date.now();
  if (!Number.isFinite(at)) return null;
  if (now - at < WEEK_MS) return timeAgo(iso);
  const date = new Date(at);
  return (date.getFullYear() === new Date(now).getFullYear() ? DAY_MONTH : DAY_MONTH_YEAR).format(date);
}

/** Home's Recent (spec §3.1): the chats last written to, newest first, titled ones only (an untitled
 *  chat is empty). Not the sidebar's order: that one puts pinned chats first, and under the word
 *  "Recent", with no pin on the rows, a pinned chat from the summer above today's reads as a fault. */
export function recentRows(threads: ThreadSummary[] | undefined): HomeRecentRow[] {
  return (threads ?? [])
    .map((thread) => ({ thread, title: thread.title?.trim() ?? "", at: new Date(thread.updated_at).getTime() || 0 }))
    .filter(({ title }) => title !== "")
    .sort((a, b) => b.at - a.at)
    .slice(0, HOME_RECENT_LIMIT)
    .map(({ thread, title }) => ({ id: thread.id, title: shownThreadTitle(title), when: whenLabel(thread.updated_at) }));
}

export interface HomeNextProps {
  field: React.ReactNode;
  credits: number | null;
  picked: boolean;
  onPickSkill(id: HomeSkillId): void;
  onMore(): void;
}

export function HomeNext({ field, credits, picked, onPickSkill, onMore }: HomeNextProps): React.JSX.Element {
  // Until the profile has answered, the heading and the avatar hold: "Good morning." growing a
  // name a moment later, and a "?" turning into initials, read as a flicker on the first screen.
  // Only while the first attempt is out: the query stays pending through its retries, and a
  // failing request must not leave the heading blank (and busy) for as long as they take.
  const { data: profile, isPending, failureCount } = useProfile();
  const profilePending = isPending && failureCount === 0;
  const { data: threads } = useThreadList();
  const actions = useThreadActions();
  const { collapsed } = useSideNavCollapse();
  // Home never renders on the server (the shell's auth guard), so the clock is safe at first render.
  const [now] = useState(() => new Date());
  return (
    <HomeScreen
      greeting={profilePending ? null : greetingFor(now, firstNameOf(profile?.name))}
      avatar={profile?.avatar ?? null}
      initials={profilePending ? "" : initialsOf(profile?.name, profile?.email)}
      credits={credits}
      field={field}
      picked={picked}
      onPickSkill={onPickSkill}
      recent={recentRows(threads)}
      onOpenThread={actions.openThread}
      // The sidebar's own Recent is on screen only while it is open.
      recentOnDesktop={collapsed}
      onMore={onMore}
    />
  );
}
