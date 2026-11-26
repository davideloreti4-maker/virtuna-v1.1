"use client";

import * as React from "react";
import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import { ArrowSquareOut, UserMinus } from "@phosphor-icons/react";

import { DotsIcon } from "@/components/library-next/library-icons";
import { MENU_ITEM, MenuRow, RowMenuLayer } from "@/components/library-next/row-menu-layer";
import { IconButton } from "@/components/ui/icon-button";
import { DISCOVER_STRINGS, creatorMore } from "@/lib/discover-next/discover-words";
import { profileHref } from "@/lib/discover-next/watchlist";

import { RemoveStep } from "./remove-step";

/**
 * A creator's page's More (spec 3.2): the Watchlist row's menu, moved onto the page it opens. A round
 * three-dot button on Library's layer (`RowMenuLayer`): on a phone a small bottom sheet named for the
 * creator, from 768 a menu standing on the button. Presentational: the container removes.
 *
 *   (···)      its menu (named "@jay.makes")      the question
 *                Open on TikTok                    Remove @jay.makes?
 *                Remove                            Cancel
 *                                                  [ Remove ]
 *
 * - Open on TikTok (a new tab) only for a handle Maven can read; Remove only when the page rests on
 *   records it can clear. Neither: no button at all.
 * - The first item takes the focus when the layer opens; every close hands it back to More.
 * - Remove clears the creator for good, so it is asked once more (`RemoveStep`), with the focus on
 *   Cancel, and the confirming Remove ignores every press for 500 ms after the question appears: the
 *   second press of a double tap lands there.
 * - A closing layer does nothing: it stays on screen and pressable through its exit.
 * - A confirmed Remove puts the focus on More before `onRemove`: left in the closing layer, it would
 *   fall to the page.
 */

const W = DISCOVER_STRINGS.watchlist;

export interface CreatorMenuProps {
  /** Bare: names the button, the layer and the question. */
  handle: string;
  /** The page holds records Remove can clear. */
  removable: boolean;
  /** Remove, confirmed. */
  onRemove(): void;
  /** The round button's ground: in the creator's card (a phone), in the page's header (a desk). */
  surface: "card" | "ground";
}

type Step = "menu" | "remove";

export function CreatorMenu({ handle, removable, onRemove, surface }: CreatorMenuProps): React.JSX.Element | null {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("menu");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const linkRef = useRef<HTMLAnchorElement>(null);
  const removeRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  // Open as of the last tap, not the last render: two taps can land before a render.
  const live = useRef(false);
  // When the question appeared (`performance.now()`): the confirming Remove waits from there.
  const askedAt = useRef(0);

  const profile = profileHref(handle);
  if (!profile && !removable) return null;

  const name = `@${handle}`;

  const onOpenChange = (next: boolean) => {
    live.current = next;
    if (next) setStep("menu");
    setOpen(next);
  };
  const close = () => {
    live.current = false;
    setOpen(false);
  };
  const askRemove = () => {
    if (!live.current) return;
    flushSync(() => setStep("remove"));
    askedAt.current = performance.now();
    cancelRef.current?.focus();
  };
  const confirmRemove = () => {
    if (!live.current) return;
    live.current = false;
    flushSync(() => setOpen(false));
    triggerRef.current?.focus();
    onRemove();
  };

  const rows =
    step === "remove" ? (
      <RemoveStep handle={handle} askedAt={askedAt} cancelRef={cancelRef} onCancel={close} onConfirm={confirmRemove} />
    ) : (
      <>
        {profile && (
          <MenuRow>
            <a
              ref={linkRef}
              href={profile}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${W.openOnTikTok}${DISCOVER_STRINGS.video.newTab}`}
              onClick={close}
              className={MENU_ITEM}
            >
              <ArrowSquareOut size={18} aria-hidden className="shrink-0 text-foreground-secondary" />
              {W.openOnTikTok}
            </a>
          </MenuRow>
        )}
        {removable && (
          <MenuRow>
            <button ref={removeRef} type="button" onClick={askRemove} className={MENU_ITEM}>
              <UserMinus size={18} aria-hidden className="shrink-0 text-foreground-secondary" />
              {W.remove}
            </button>
          </MenuRow>
        )}
      </>
    );

  return (
    <RowMenuLayer
      name={name}
      heading={name}
      open={open}
      onOpenChange={onOpenChange}
      onClose={close}
      firstRef={profile ? linkRef : removeRef}
      triggerRef={triggerRef}
      divided={step === "menu"}
      waitsForRow={false}
      renderTrigger={(ref) => (
        // Tinted while its layer is open, as the Audience page's More.
        <IconButton ref={ref} surface={surface} aria-label={creatorMore(handle)} className="aria-expanded:bg-active">
          <DotsIcon aria-hidden />
        </IconButton>
      )}
    >
      {rows}
    </RowMenuLayer>
  );
}
