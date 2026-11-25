"use client";

import * as React from "react";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { rowOf, titleOf } from "@/components/library-next/chat-row-data";
import { MenuButton } from "@/components/shell/menu-button";
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
import { HomeScreen, type HomeAudience, type HomeMoney, type HomeRecentRow, type HomeSkillId, type HomeUnder } from "./home-screen";

/**
 * Home with its data (spec 2026-11-23 §3, redrawn by 2026-11-25 §2): the greeting's name from the
 * profile, the last chats, the money, and which of three things goes under the field (`underOf`). The
 * phone's top row carries the drawer's opener, which draws the face the shell publishes and reads
 * nothing here. The composer draws it and hands in the field, the audience line's values (spec
 * 2026-11-25 §2.3), the balance and the card's pick.
 *
 * Under the field (spec 2026-11-25 §2.5): nothing until the sidebar's chat list has answered, so a
 * creator with chats never sees the cards for a moment; then Recent when there is a row for it, else
 * the four cards (no titled chat, or the list failed). Recent shows beside the sidebar whether it is
 * open or the rail: with the cards gone the page would be empty under the field.
 *
 * Recent is the first page of Library's summary (`useLibraryRecent`: one
 * request under its own key, so a refetch never re-asks the pages the Library has loaded): its five
 * chats last written to, each as Library draws it. While that request is out, when it failed, or while it is behind the sidebar's list (a chat
 * written to, renamed or deleted since), Recent is the sidebar list's titles and times, as before:
 * Home is the first screen of a session and never shows a gap or an error for it. A summary found
 * behind is asked for again, once for each state of the list. Nothing here is paid; a tap is a
 * navigation.
 *
 * "Money made" (Earn plan 2026-11-24, step C; ruling 18; spec 2026-11-25 §2.6) is `useEarn()`: the one
 * `GET /api/earn`, under the key Earn's page reads, so every reader shares it. See `moneyOf`.
 */

/** Recent's rows at most (spec 2026-11-25 §2.5). */
export const HOME_RECENT_LIMIT = 5;

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

/** The chats Recent shows from the summary's first page: the five last written to, newest first.
 *  Not its first five: the page leads with the pinned chats, and an old one is not "recent". The
 *  page holds every chat among the thirty last written to, so these are the creator's latest five.
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
 * The "Money made" row from Earn's read (spec 2026-11-25 §2.6; rulings 18 and 24): only when Whop's
 * number says something was earned, in whole cents above zero. Nothing earned, a number that could not
 * be read, the payment side not read, not enrolled, a read still out or refused: null, so no row and no
 * space. The amount is in money words, the rate at the right is Earn's headline ("Earn 50%"). An answer
 * once in stays (react-query keeps it through a later failed read).
 */
export function moneyOf(page: EarnPage | undefined): HomeMoney | null {
  const cents = page?.whop?.earnedCents;
  return typeof cents === "number" && cents > 0 ? { amount: moneyWord(cents), hint: headline() } : null;
}

/** What goes under the field: nothing until the chat list has answered (data or error), then Recent
 *  if there is a row for it, else the cards. */
export function underOf(list: { data: unknown; isError: boolean }, rows: readonly HomeRecentRow[]): HomeUnder {
  if (list.data === undefined && !list.isError) return "pending";
  return rows.length > 0 ? "recent" : "cards";
}

export interface HomeNextProps {
  field: React.ReactNode;
  audience: HomeAudience;
  /** Set to the audience line, for the audience sheet to stand on. */
  audienceRef?: React.Ref<HTMLButtonElement>;
  credits: number | null;
  onPickSkill(id: HomeSkillId): void;
  /** The editor is open to this account: Home shows its six cards (plan 2026-11-24-editor-screens-a). */
  editOpen?: boolean;
  /** The six cards' More card: the field's More sheet. */
  onMore?(): void;
}

export function HomeNext({ field, audience, audienceRef, credits, onPickSkill, editOpen = false, onMore }: HomeNextProps): React.JSX.Element {
  // Until the profile has answered, the heading holds: "Good morning." growing a name a moment
  // later reads as a flicker on the first screen.
  // Only while the first attempt is out: the query stays pending through its retries, and a
  // failing request must not leave the heading blank (and busy) for as long as they take.
  const { data: profile, isPending, failureCount } = useProfile();
  const profilePending = isPending && failureCount === 0;
  const list = useThreadList();
  const threads = list.data;
  const summary = useLibraryRecent();
  const earn = useEarn();
  const actions = useThreadActions();
  const queryClient = useQueryClient();
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
      audience={audience}
      audienceRef={audienceRef}
      money={moneyOf(earn.data)}
      opener={<MenuButton variant="picture" />}
      credits={credits}
      field={field}
      under={underOf(list, recent)}
      onPickSkill={onPickSkill}
      recent={recent}
      onOpenThread={openRecent}
      editOpen={editOpen}
      onMore={onMore}
    />
  );
}
