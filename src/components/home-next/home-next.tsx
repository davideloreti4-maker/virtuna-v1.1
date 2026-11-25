"use client";

import * as React from "react";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { rowOf, titleOf } from "@/components/library-next/chat-row-data";
import { MenuButton } from "@/components/shell/menu-button";
import { useSideNavCollapse } from "@/components/shell/use-side-nav-collapse";
import { useThreadActions } from "@/components/shell/use-thread-actions";
import { shownThreadTitle } from "@/components/shell/use-thread-title";
import { useThreadList, type ThreadSummary } from "@/hooks/queries";
import { useEarn } from "@/hooks/queries/use-earn";
import { libraryKeys, useLibraryRecent } from "@/hooks/queries/use-library";
import { useProfile } from "@/hooks/queries/use-profile";
import type { EarnPage } from "@/lib/earn/earn";
import { headline, moneyWord } from "@/lib/earn/earn-words";
import type { LibraryChat, LibraryPage } from "@/lib/library/library-page";
import { whenLabel } from "@/lib/time-ago";

import { firstNameOf, greetingFor } from "./greeting";
import { HomeScreen, type HomeMoney, type HomeRecentRow, type HomeSkillId } from "./home-screen";

/**
 * Home with its data (spec 2026-11-23 §3): the greeting's name from the profile, the last chats,
 * and whether the sidebar shows them beside the page. The phone's top row carries the drawer's
 * opener, which draws the face the shell publishes and reads nothing here. The composer draws it and
 * hands in the field, the balance and the skill state.
 *
 * Recent is the first page of Library's summary (`useLibraryRecent`: one
 * request under its own key, so a refetch never re-asks the pages the Library has loaded): its three
 * chats last written to, each as Library draws it. While that request is out, when it failed, or while it is behind the sidebar's list (a chat
 * written to, renamed or deleted since), Recent is the sidebar list's titles and times, as before:
 * Home is the first screen of a session and never shows a gap or an error for it. A summary found
 * behind is asked for again, once for each state of the list. Nothing here is paid; a tap is a
 * navigation.
 *
 * "Money made" (Earn plan 2026-11-24, step C; ruling 18) is `useEarn()`: the one `GET /api/earn`, under
 * the key Earn's page reads, so every reader shares it. See `moneyOf`.
 */

export const HOME_RECENT_LIMIT = 3;

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

/** Recent from Library's summary: the chats `recentChats` picked, each as
 *  Library draws it (tile, title, line, gauge), through Library's own mapping. A posted chat's line
 *  is Library's too, its mark included (after posting); the gauge stays what Maven said. */
export function summaryRows(chats: readonly LibraryChat[]): HomeRecentRow[] {
  return chats.map((chat) => {
    const row = rowOf(chat);
    return {
      id: row.id,
      title: row.title,
      when: null,
      summary: { tile: { lead: row.lead, frame: row.frame, still: row.still }, line: row.line, gauge: row.gauge, posted: row.posted ?? null },
    };
  });
}

/** A stored time to compare; null when it does not read as one. */
function timeOf(at: string): number | null {
  const t = Date.parse(at);
  return Number.isFinite(t) ? t : null;
}

/** The chats Recent shows from the summary's first page: the three last written to, newest first.
 *  Not its first three: the page leads with the pinned chats, and an old one is not "recent". The
 *  page holds every chat among the thirty last written to, so these are the creator's latest three.
 *  Equal times keep the page's order (its own by last message). Never an older page: Home asks for
 *  one page only. */
export function recentChats(page: LibraryPage | undefined): LibraryChat[] {
  const chats = page?.chats;
  if (!Array.isArray(chats)) return [];
  const at = (chat: LibraryChat) => timeOf(chat.updatedAt) ?? Number.NEGATIVE_INFINITY;
  return [...chats].sort((a, b) => (at(a) === at(b) ? 0 : at(b) > at(a) ? 1 : -1)).slice(0, HOME_RECENT_LIMIT);
}

const titleText = (title: string | null | undefined): string | null => title?.trim() || null;

/**
 * Whether the summary's rows (`shown`) still say what the sidebar's list says. The list is read
 * again after every send, new chat, rename, pin and delete; the summary is not. So each shown chat
 * must be in the list with the same last-message time (and the same title, when both have one), and
 * no titled chat of the list written to after the oldest shown one may be missing. With no list (it
 * is loading, or failed) there is nothing to hold it to.
 */
export function summaryAgrees(shown: readonly LibraryChat[], threads: readonly ThreadSummary[] | undefined): boolean {
  if (!threads) return true;
  const listed = new Map(threads.map((thread) => [thread.id, thread]));
  for (const chat of shown) {
    const thread = listed.get(chat.id);
    if (!thread || timeOf(thread.updated_at) !== timeOf(chat.updatedAt)) return false;
    const [ours, theirs] = [titleText(chat.title), titleText(thread.title)];
    if (ours !== null && theirs !== null && ours !== theirs) return false;
  }
  const ids = new Set(shown.map((chat) => chat.id));
  const oldest = shown.length > 0 ? Math.min(...shown.map((chat) => timeOf(chat.updatedAt) ?? Number.NEGATIVE_INFINITY)) : Number.NEGATIVE_INFINITY;
  return !threads.some(
    (thread) => titleText(thread.title) !== null && !ids.has(thread.id) && (timeOf(thread.updated_at) ?? Number.NEGATIVE_INFINITY) > oldest,
  );
}

/**
 * The "Money made" row from Earn's read (rulings 18 and 24):
 * - no answer yet: `loading` (the row's space is held);
 * - refused or failed with nothing to show (a funnel visitor's 404, signed out, an error): null, so no
 *   row, no space and no error on Home;
 * - answered: `shown`. The amount is what Whop reported, in money words, and "$0" when there is none
 *   (not enrolled, or the payment side not read: nothing earned through us is true). One case has no
 *   amount: an enrolled creator (`whop.username` set) whose number could not be read (`earnedCents`
 *   null) may have earned, so the row does not say "$0" to them. The rate at the right is Earn's
 *   headline ("Earn 50%"), built from the rate's constant.
 * An answer once in stays: a later failed read does not take the row away.
 */
export function moneyOf(earn: { data: EarnPage | undefined; isError: boolean }): HomeMoney | null {
  if (earn.data === undefined) return earn.isError ? null : { state: "loading" };
  const whop = earn.data?.whop;
  const cents = typeof whop?.earnedCents === "number" ? whop.earnedCents : null;
  const unread = Boolean(whop?.username) && cents === null;
  return { state: "shown", amount: unread ? null : moneyWord(cents ?? 0), hint: headline() };
}

export interface HomeNextProps {
  field: React.ReactNode;
  credits: number | null;
  picked: boolean;
  onPickSkill(id: HomeSkillId): void;
  onMore(): void;
  /** The editor is open to this account: Home shows its six cards (plan 2026-11-24-editor-screens-a). */
  editOpen?: boolean;
}

export function HomeNext({ field, credits, picked, onPickSkill, onMore, editOpen = false }: HomeNextProps): React.JSX.Element {
  // Until the profile has answered, the heading holds: "Good morning." growing a name a moment
  // later reads as a flicker on the first screen.
  // Only while the first attempt is out: the query stays pending through its retries, and a
  // failing request must not leave the heading blank (and busy) for as long as they take.
  const { data: profile, isPending, failureCount } = useProfile();
  const profilePending = isPending && failureCount === 0;
  const { data: threads } = useThreadList();
  const summary = useLibraryRecent();
  const earn = useEarn();
  const actions = useThreadActions();
  const queryClient = useQueryClient();
  const { collapsed } = useSideNavCollapse();
  // Home never renders on the server (the shell's auth guard), so the clock is safe at first render.
  const [now] = useState(() => new Date());

  // The summary's rows when they are in and agree with the sidebar's list; else the list's own.
  const page = summary.data;
  const shown = recentChats(page);
  const behind = page !== undefined && !summaryAgrees(shown, threads);
  const fromSummary = page !== undefined && !behind;
  const recent = fromSummary ? summaryRows(shown) : recentRows(threads);

  /**
   * A Recent row opens its chat with no way back to Library (`threadBack`), and, for a chat with no
   * title of its own, the name its row shows, so its header names it the same. The summary is
   * marked old, not read now: what the creator does in the chat shows when Home or Library is next
   * on screen.
   */
  const openRecent = (id: string) => {
    const chat = fromSummary ? shown.find((one) => one.id === id) : undefined;
    actions.openThread(id, chat && !chat.title?.trim() ? { title: titleOf(chat) } : undefined);
    void queryClient.invalidateQueries({ queryKey: libraryKeys.all, refetchType: "none" });
  };

  // Behind the list: ask for the summary again, once for each state of the list (a list that comes
  // back the same is the same state), and not while a request for it is already out.
  const { refetch, isFetching } = summary;
  const askedFor = useRef<ThreadSummary[] | undefined>(undefined);
  useEffect(() => {
    if (!behind || isFetching || askedFor.current === threads) return;
    askedFor.current = threads;
    void refetch();
  }, [behind, isFetching, threads, refetch]);

  return (
    <HomeScreen
      greeting={profilePending ? null : greetingFor(now, firstNameOf(profile?.name))}
      money={moneyOf(earn)}
      opener={<MenuButton variant="picture" />}
      credits={credits}
      field={field}
      picked={picked}
      onPickSkill={onPickSkill}
      recent={recent}
      onOpenThread={openRecent}
      // The sidebar's own Recent is on screen only while it is open.
      recentOnDesktop={collapsed}
      onMore={onMore}
      editOpen={editOpen}
    />
  );
}
