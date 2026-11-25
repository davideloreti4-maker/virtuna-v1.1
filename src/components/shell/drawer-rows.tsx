"use client";

import { useEffect, useId } from "react";
import { flushSync } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { GearSix, SignOut } from "@phosphor-icons/react";
import { MavenMark } from "@/components/brand/maven-logo";
import { creditsLabel } from "@/components/thread-next/thread-field";
import { Avatar } from "@/components/ui/avatar";
import { useThreadList } from "@/hooks/queries";
import { useSubscription } from "@/hooks/use-subscription";
import { shownBalance } from "@/lib/pricing";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { useBoardStore } from "@/stores/board-store";
import { useShellStore } from "@/stores/shell-store";
import { DRAWER_WORDS } from "./drawer-words";
import { ComposeIcon } from "./icons";
import {
  EARN,
  PLACES,
  RECENT_LIMIT,
  SHELL_FOCUS,
  SIDE_NAV_ORDER,
  YOU,
  activePlace,
  earnActive,
  youActive,
} from "./nav-config";
import type { ThreadActions } from "./use-thread-actions";

/**
 * What a row tells the drawer once tapped, so the drawer knows where the focus goes as it closes:
 * - `stay`: the row leads where the creator already is; the focus goes back to the opener.
 * - `go`: it leads elsewhere (a link, another chat, a new chat, Log out); the new screen keeps the
 *   focus (on a blank Home, New chat's field).
 */
export type DrawerChoice = { kind: "stay" } | { kind: "go" };

/** The account as the drawer draws it. The balance is read by the block itself, on open. */
export interface DrawerAccount {
  name: string;
  picture: string | null;
  initials: string;
}

export interface DrawerRowsProps {
  actions: ThreadActions;
  account: DrawerAccount;
  choose(choice: DrawerChoice): void;
  /** The last balance the drawer showed, kept by the frame (it outlives each opening, and goes with
   *  a sign-out): drawn while the next read is out, so the name does not move on every opening. */
  balanceRef: React.RefObject<number | null>;
}

/** A row: the sidebar's row at the phone's 44. SHELL_FOCUS: most rows sit in a scroll box. */
const ROW = cn(
  "flex h-11 w-full shrink-0 items-center gap-[11px] rounded-lg px-3 text-left text-ui font-[560] transition-colors duration-150",
  SHELL_FOCUS,
);
const LIT = "bg-active text-foreground";
const UNLIT = "text-foreground-secondary hover:bg-hover hover:text-foreground";
const HAIRLINE = "mx-3 my-2 h-px shrink-0 bg-border";

function LinkRow({
  href,
  label,
  icon,
  lit = false,
  choose,
  instead,
}: {
  href: string;
  label: string;
  icon?: React.ReactNode;
  lit?: boolean;
  choose: DrawerRowsProps["choose"];
  /** Run in the tap instead of the link's own navigation (it stays a link to `href`). */
  instead?: () => void;
}) {
  const pathname = usePathname();
  return (
    <Link
      href={href}
      aria-current={lit ? "page" : undefined}
      onClick={(event) => {
        if (instead) {
          event.preventDefault();
          instead();
          return;
        }
        choose(pathname === href ? { kind: "stay" } : { kind: "go" });
      }}
      className={cn(ROW, lit ? LIT : UNLIT)}
    >
      {icon}
      <span className="min-w-0 truncate">{label}</span>
    </Link>
  );
}

/**
 * The balance under the name, as the sidebar's tag words it. Its own component so the request goes
 * out when the drawer opens (the panel mounts only while open), on a phone only, not once per load.
 * While it loads, the balance shown last (nothing on a load's first opening); once the answer is
 * in, the fresh one. Nothing when there is no countable balance: the block's height does not change.
 */
function Balance({ balanceRef }: { balanceRef: DrawerRowsProps["balanceRef"] }) {
  const { usage, tier, isTrial, isLoading } = useSubscription();
  const fresh = shownBalance(usage, tier, isTrial);
  useEffect(() => {
    if (!isLoading) balanceRef.current = fresh;
  }, [isLoading, fresh, balanceRef]);
  // Read while rendering on purpose: the ref is written only in the effect above, once an answer is
  // in, and then `fresh` is drawn; so every render of a loading block reads the same value, the
  // balance the last opening showed.
  // eslint-disable-next-line react-hooks/refs
  const left = isLoading ? balanceRef.current : fresh;
  if (left === null) return null;
  return <span className="truncate text-meta tabular-nums text-foreground-secondary">{creditsLabel(left)}</span>;
}

/**
 * What the phone's drawer holds, in the desktop sidebar's order and by its rules: Maven, New chat,
 * the places, You and Earn, Recent (All chats beside its label), then the account, Settings and Log
 * out. The middle scrolls when it does not fit; the top two rows and the account stay.
 */
export function DrawerRows({ actions, account, choose, balanceRef }: DrawerRowsProps): React.JSX.Element {
  const pathname = usePathname();
  const recentLabelId = useId();
  const threadOpen = useShellStore((s) => s.threadOpen);
  const activeThreadId = useBoardStore((s) => s.activeThreadId);
  const { data: threads } = useThreadList();
  const current = activePlace(pathname);

  // The sidebar's rules (it has a rail; the drawer has none). The newest chat always shows (it may be
  // the open, still untitled one); beyond it only named ones.
  const recent = (threads ?? [])
    .filter((thread, index) => index === 0 || Boolean(thread.title?.trim()))
    .slice(0, RECENT_LIMIT);
  const chatOnScreen = threadOpen && pathname === "/home";
  // Inside a chat its own row is where the creator is, not Home: one mark, while that row is listed.
  const inThread = chatOnScreen && recent.some((thread) => thread.id === activeThreadId);

  // Inside a chat Home is the way out of it, to the blank Home, as New chat from the chat's band
  // (no cursor sent to the field). Elsewhere Home is the plain link.
  const leaveChat = () => {
    actions.newThread();
    choose({ kind: "go" });
  };

  const newChat = () => {
    // The drawer closes first, in this tap: its dialog is closed in this commit, so the focus trap is
    // off when a blank Home puts the cursor in the field (a phone raises its keyboard only for a
    // focus inside the tap). Then at once, as the band's New chat; anywhere else it
    // navigates, and the new screen keeps the focus.
    flushSync(() => choose({ kind: "go" }));
    actions.newThread();
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col p-3">
      <div className="flex h-11 shrink-0 items-center gap-[9px] pl-2 text-foreground">
        <span aria-hidden className="flex size-[26px] shrink-0 items-center justify-center">
          <MavenMark size={13} className="shrink-0 text-accent" />
        </span>
        <span className="text-title font-[640] tracking-[-0.02em]">Maven</span>
      </div>

      <button
        type="button"
        onClick={newChat}
        className={cn(
          "mt-1 flex h-11 w-full shrink-0 items-center gap-[9px] rounded-xl bg-surface px-3 text-ui font-[640] text-foreground shadow-[var(--shadow-control)]",
          "transition-transform duration-150 motion-safe:active:scale-[0.98]",
          SHELL_FOCUS,
        )}
      >
        <ComposeIcon size={17} aria-hidden />
        <span>New chat</span>
      </button>

      <div className="mt-2.5 flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overscroll-contain">
        {SIDE_NAV_ORDER.map((id) => {
          const place = PLACES.find((candidate) => candidate.id === id);
          if (!place) return null;
          const Glyph = place.icon;
          return (
            <LinkRow
              key={place.id}
              href={place.href}
              label={place.label}
              icon={<Glyph size={18} aria-hidden />}
              lit={current === place.id && !(place.id === "home" && inThread)}
              choose={choose}
              instead={place.id === "home" && chatOnScreen ? leaveChat : undefined}
            />
          );
        })}

        <div aria-hidden data-part="hairline" className={HAIRLINE} />

        <LinkRow href={YOU.href} label={YOU.label} icon={<YOU.icon size={18} aria-hidden />} lit={youActive(pathname)} choose={choose} />
        <LinkRow href={EARN.href} label={EARN.label} icon={<EARN.icon size={18} aria-hidden />} lit={earnActive(pathname)} choose={choose} />

        {recent.length > 0 && (
          <div className="mt-[18px] flex shrink-0 flex-col gap-0.5">
            {/* All chats at the label's right, as Home's Recent carries Library: in view whenever Recent
                is. Its 44 touch area does not make the row taller; the room below the row lets that
                area end before the first chat, so a tap on that chat's top edge opens the chat. */}
            <div className="mx-3 mb-3 flex items-center justify-between gap-3">
              <p id={recentLabelId} className="min-w-0 truncate text-label font-[560] leading-[21px] text-foreground-muted">
                Recent
              </p>
              <Link
                href="/library"
                onClick={() => choose(pathname === "/library" ? { kind: "stay" } : { kind: "go" })}
                className={cn(
                  "tap-44 -mr-1 shrink-0 rounded-sm px-1 text-label font-[560] leading-[21px] text-foreground-secondary transition-colors duration-150 hover:text-foreground",
                  SHELL_FOCUS,
                )}
              >
                {DRAWER_WORDS.allChats}
              </Link>
            </div>
            <ul aria-labelledby={recentLabelId} className="flex flex-col gap-0.5">
              {recent.map((thread) => {
                const isActive = pathname === "/home" && thread.id === activeThreadId;
                const isOpenChat = threadOpen && isActive;
                return (
                  <li key={thread.id}>
                    <button
                      type="button"
                      aria-current={isActive ? "page" : undefined}
                      onClick={() => {
                        // The open chat's own row: it is on screen already, nothing to open again.
                        if (isOpenChat) {
                          choose({ kind: "stay" });
                          return;
                        }
                        choose({ kind: "go" });
                        // No way back recorded: its band then shows the menu, not Back.
                        actions.openThread(thread.id);
                      }}
                      className={cn(
                        "flex h-11 w-full items-center rounded-lg px-3 text-left text-reading transition-colors duration-150",
                        SHELL_FOCUS,
                        isActive ? "bg-active font-[560] text-foreground" : UNLIT,
                      )}
                    >
                      <span className="min-w-0 truncate">{thread.title?.trim() || "New chat"}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      <div className="flex shrink-0 flex-col gap-0.5">
        <div aria-hidden data-part="hairline" className={HAIRLINE} />
        {/* One height whether the balance is there, on its way or absent, so nothing around it moves;
            without the balance the name sits centred on the picture. Not a control. */}
        <div data-part="account" className="flex h-14 shrink-0 items-center gap-2.5 px-1.5">
          <Avatar src={account.picture ?? undefined} alt="" fallback={account.initials} size="sm" className="h-[30px] w-[30px]" />
          <div className="flex min-w-0 flex-1 flex-col justify-center">
            <span className="truncate text-ui font-[640] text-foreground">{account.name}</span>
            <Balance balanceRef={balanceRef} />
          </div>
        </div>
        <LinkRow href="/settings" label="Settings" icon={<GearSix size={18} aria-hidden />} choose={choose} />
        <button
          type="button"
          onClick={() => {
            choose({ kind: "go" });
            // The app's auth guard leads to the sign-in page; nothing navigates here.
            void createClient().auth.signOut();
          }}
          className={cn(ROW, UNLIT)}
        >
          <SignOut size={18} aria-hidden />
          <span>Log out</span>
        </button>
      </div>
    </div>
  );
}
