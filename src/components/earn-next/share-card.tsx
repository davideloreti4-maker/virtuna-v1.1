"use client";

import { useCallback, useEffect, useRef } from "react";

import { MavenMark } from "@/components/brand/maven-logo";
import { EARN_STRINGS } from "@/lib/earn/earn-words";
import { cn } from "@/lib/utils";

import { QrCode } from "./qr";
import { SHARE_LOOK, deliverCardImage, renderCardImage, type CardData } from "./save-card";

/**
 * The share card (plan 2026-11-24-earn, step A; ruling 10; the drawing's `.share`): Maven's mark, YOU EARN
 * and the rate, SHARED BY and the creator's name (left out when there is none), the QR code of the link,
 * the code under it. Dark in both themes: it is an object to share, not chrome, so its colours are the
 * card's own (`SHARE_LOOK`), inline. The numbers are `save-card.ts`'s layout, so the saved image is this
 * card: 20 inside, a 44 top row (12/18 over 22/26), 26 to SHARED BY, 22 to the QR (26 without a name), a
 * 150 plate, 10 to the code.
 */
export function ShareCard({ link, code, name, ratePct }: CardData) {
  const soft = { color: SHARE_LOOK.inkSoft };
  return (
    <div
      data-share-card
      className="rounded-2xl p-5"
      style={{ background: SHARE_LOOK.card, color: SHARE_LOOK.ink, boxShadow: `inset 0 0 0 1px ${SHARE_LOOK.ring}` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-[22px] min-w-0 items-center gap-2">
          <MavenMark size={13} className="shrink-0" />
          <span className="text-title font-bold leading-[22px]">Maven</span>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-label font-[560] leading-[18px] tracking-[0.06em]" style={soft}>
            {EARN_STRINGS.youEarn}
          </p>
          <p className="text-heading font-bold leading-[26px] tabular-nums">{ratePct}</p>
        </div>
      </div>
      {name && (
        <div className="mt-[26px] min-w-0">
          <p className="text-label font-[560] leading-[18px] tracking-[0.06em]" style={soft}>
            {EARN_STRINGS.sharedBy}
          </p>
          <p className="truncate text-heading font-bold leading-[26px]">{name}</p>
        </div>
      )}
      <QrCode
        text={link}
        ink={SHARE_LOOK.module}
        plate={SHARE_LOOK.plate}
        className={cn("mx-auto block size-[150px] overflow-hidden rounded-lg", name ? "mt-[22px]" : "mt-[26px]")}
      />
      <p className="mt-2.5 text-center text-meta font-[560] leading-[18px] tracking-[0.08em] tabular-nums" style={soft}>
        {code}
      </p>
    </div>
  );
}

/**
 * "Save image": the card's PNG is drawn as soon as the card is on screen, so the press hands it to the
 * share sheet at once (a browser may refuse a share sheet opened long after the press). If it is not ready
 * (still drawing, or the first try failed), the press draws it. A failure is logged; the page stays as it is.
 */
export function useSaveCardImage(card: CardData): () => Promise<void> {
  const { link, code, name, ratePct } = card;
  const ready = useRef<Blob | null>(null);
  const drawing = useRef<Promise<Blob> | null>(null);

  useEffect(() => {
    let live = true;
    ready.current = null;
    const image = renderCardImage({ link, code, name, ratePct });
    drawing.current = image;
    image.then(
      (blob) => {
        if (live) ready.current = blob;
      },
      () => {},
    );
    return () => {
      live = false;
    };
  }, [link, code, name, ratePct]);

  return useCallback(async () => {
    try {
      const blob =
        ready.current ?? (await drawing.current?.catch(() => null)) ?? (await renderCardImage({ link, code, name, ratePct }));
      await deliverCardImage(blob);
    } catch (err) {
      console.error("[earn] save image failed:", err instanceof Error ? err.message : String(err));
    }
  }, [link, code, name, ratePct]);
}
