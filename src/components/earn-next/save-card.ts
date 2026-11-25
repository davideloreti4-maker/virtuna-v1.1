/**
 * save-card.ts — "Save image" (plan 2026-11-24-earn, step A): the share card drawn on a canvas 1080 wide,
 * made a PNG, and handed to the phone's share sheet where the browser can share a file, else downloaded as
 * `maven-earn.png`.
 *
 * The card is an object to share, not chrome: it is dark in both themes, so its colours are fixed here
 * (`SHARE_LOOK`), in the one file of this folder allowed literals, and the on-screen card
 * (`share-card.tsx`) takes them from here. The layout below is the on-screen card's, at 360 wide, drawn at
 * three times (`IMAGE_SCALE`); the QR comes from the same matrix (`qr.tsx`) and Maven's mark from the same
 * path (`maven-logo.tsx`).
 *
 * The drawing is one function, `drawCard(ctx, card, fontFamily)`, so a test can read what it drew on a
 * stand-in 2D context. The QR modules are drawn on whole pixels (the module size is rounded down and the
 * code centred on its plate), so neighbouring runs leave no seam for a scanner to trip on.
 */
import { MARK_PATH_NEXT, MARK_VIEWBOX_NEXT } from "@/components/brand/maven-logo";
import { EARN_STRINGS } from "@/lib/earn/earn-words";

import { QR_QUIET, qrMatrix, qrRuns } from "./qr";

/** The card's own colours, the same in both themes. `mark` is the app's `--color-accent` (a test holds them equal). */
export const SHARE_LOOK = {
  card: "#141413",
  /** A hairline inside the card's edge, so it still reads on the dark theme's card. */
  ring: "rgba(255, 255, 255, 0.1)",
  ink: "#f7f6f3",
  inkSoft: "rgba(247, 246, 243, 0.62)",
  plate: "#ffffff",
  module: "#141413",
  mark: "#FF6363",
} as const;

export interface CardData {
  link: string;
  code: string;
  /** The creator's name; null leaves out "SHARED BY" and the name. */
  name: string | null;
  /** "50%". */
  ratePct: string;
}

/** The card's width on the canvas before scaling, and the scale: 360 × 3 = 1080. */
export const CARD_WIDTH = 360;
export const IMAGE_SCALE = 3;
export const IMAGE_WIDTH = CARD_WIDTH * IMAGE_SCALE;

// The layout, in the on-screen card's pixels (share-card.tsx has the same numbers as classes).
const PAD = 20;
const RADIUS = 20;
const LABEL_LINE = 18; // "YOU EARN", "SHARED BY" (12 / 18)
const BIG_LINE = 26; // "50%", the name (22 / 26)
const BRAND_LINE = 22; // "Maven" (16 / 22)
const MARK_HEIGHT = 13;
const MARK_GAP = 8;
const TOP = LABEL_LINE + BIG_LINE; // the top row: YOU EARN over 50%
const AFTER_TOP = 26;
const AFTER_NAME = 22;
const PLATE = 150;
const PLATE_RADIUS = 12;
const CODE_GAP = 10;
const CODE_LINE = 18; // the code (13 / 18)

/** Where the QR plate starts, from the top of the card. */
function plateTop(card: CardData): number {
  return PAD + TOP + AFTER_TOP + (card.name ? LABEL_LINE + BIG_LINE + AFTER_NAME : 0);
}

/** The card's height before scaling (354 with a name, 288 without). */
export function cardHeight(card: CardData): number {
  return plateTop(card) + PLATE + CODE_GAP + CODE_LINE + PAD;
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Traces an SVG path of absolute M, L, C and Z commands (the mark's) on the context. */
function tracePath(ctx: CanvasRenderingContext2D, d: string): void {
  const tokens = d.match(/[A-Za-z]|-?\d*\.?\d+/g) ?? [];
  const num = (i: number) => Number(tokens[i]);
  ctx.beginPath();
  let command = "";
  for (let i = 0; i < tokens.length; ) {
    if (/[A-Za-z]/.test(tokens[i]!)) {
      command = tokens[i]!;
      i += 1;
      if (command === "Z") ctx.closePath();
      continue;
    }
    if (command === "M") {
      ctx.moveTo(num(i), num(i + 1));
      i += 2;
      command = "L";
    } else if (command === "L") {
      ctx.lineTo(num(i), num(i + 1));
      i += 2;
    } else if (command === "C") {
      ctx.bezierCurveTo(num(i), num(i + 1), num(i + 2), num(i + 3), num(i + 4), num(i + 5));
      i += 6;
    } else {
      throw new Error(`mark path: unsupported command ${command}`);
    }
  }
}

/** Cuts `text` with an ellipsis until it fits `max` in the context's current font. */
function fit(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text;
  let cut = text;
  while (cut.length > 1 && ctx.measureText(`${cut.trimEnd()}…`).width > max) cut = cut.slice(0, -1);
  return `${cut.trimEnd()}…`;
}

/**
 * Draws the card on `ctx` at `IMAGE_SCALE`, from (0, 0), `IMAGE_WIDTH` wide and `cardHeight(card) ×
 * IMAGE_SCALE` tall. `fontFamily` is the page's (the canvas cannot read the app's font variable).
 */
export function drawCard(ctx: CanvasRenderingContext2D, card: CardData, fontFamily: string): void {
  const s = IMAGE_SCALE;
  const width = CARD_WIDTH * s;
  const font = (weight: number, size: number) => `${weight} ${size * s}px ${fontFamily}`;
  const tracking = (em: number, size: number) => {
    if ("letterSpacing" in ctx) ctx.letterSpacing = `${em * size * s}px`;
  };
  const text = (words: string, x: number, middle: number, align: CanvasTextAlign, colour: string) => {
    ctx.textAlign = align;
    ctx.fillStyle = colour;
    ctx.fillText(words, x * s, middle * s);
  };
  ctx.textBaseline = "middle";

  // The card.
  roundedRect(ctx, 0, 0, width, cardHeight(card) * s, RADIUS * s);
  ctx.fillStyle = SHARE_LOOK.card;
  ctx.fill();

  // Maven's mark and name, top left: the mark 13 tall in its 2.5:1 box, centred on the 22px line.
  const [vbX, vbY, , vbH] = MARK_VIEWBOX_NEXT.split(" ").map(Number) as [number, number, number, number];
  const k = MARK_HEIGHT / vbH;
  const markTop = PAD + (BRAND_LINE - MARK_HEIGHT) / 2;
  ctx.save();
  ctx.translate((PAD - vbX * k) * s, (markTop - vbY * k) * s);
  ctx.scale(k * s, k * s);
  tracePath(ctx, MARK_PATH_NEXT);
  ctx.fillStyle = SHARE_LOOK.mark;
  ctx.fill();
  ctx.restore();
  ctx.font = font(700, 16);
  tracking(-0.01, 16);
  text("Maven", PAD + MARK_HEIGHT * 2.5 + MARK_GAP, PAD + BRAND_LINE / 2, "left", SHARE_LOOK.ink);

  // YOU EARN over the rate, top right.
  ctx.font = font(560, 12);
  tracking(0.06, 12);
  text(EARN_STRINGS.youEarn, CARD_WIDTH - PAD, PAD + LABEL_LINE / 2, "right", SHARE_LOOK.inkSoft);
  ctx.font = font(700, 22);
  tracking(-0.02, 22);
  text(card.ratePct, CARD_WIDTH - PAD, PAD + LABEL_LINE + BIG_LINE / 2, "right", SHARE_LOOK.ink);

  // SHARED BY and the name.
  if (card.name) {
    const y = PAD + TOP + AFTER_TOP;
    ctx.font = font(560, 12);
    tracking(0.06, 12);
    text(EARN_STRINGS.sharedBy, PAD, y + LABEL_LINE / 2, "left", SHARE_LOOK.inkSoft);
    ctx.font = font(700, 22);
    tracking(-0.02, 22);
    text(fit(ctx, card.name, (CARD_WIDTH - PAD * 2) * s), PAD, y + LABEL_LINE + BIG_LINE / 2, "left", SHARE_LOOK.ink);
  }

  // The QR on its plate: whole-pixel modules, the quiet zone around them, centred on the plate.
  const top = plateTop(card);
  const plateX = ((CARD_WIDTH - PLATE) / 2) * s;
  const plateY = top * s;
  const plateSize = PLATE * s;
  roundedRect(ctx, plateX, plateY, plateSize, plateSize, PLATE_RADIUS * s);
  ctx.fillStyle = SHARE_LOOK.plate;
  ctx.fill();
  const matrix = qrMatrix(card.link);
  const cells = matrix.length + QR_QUIET * 2;
  const m = Math.floor(plateSize / cells);
  const offset = Math.round((plateSize - m * cells) / 2);
  const x0 = Math.round(plateX) + offset + QR_QUIET * m;
  const y0 = Math.round(plateY) + offset + QR_QUIET * m;
  ctx.fillStyle = SHARE_LOOK.module;
  for (const [x, y, run] of qrRuns(matrix)) ctx.fillRect(x0 + x * m, y0 + y * m, run * m, m);

  // The code under it.
  ctx.font = font(560, 13);
  tracking(0.08, 13);
  text(card.code, CARD_WIDTH / 2, top + PLATE + CODE_GAP + CODE_LINE / 2, "center", SHARE_LOOK.inkSoft);
  tracking(0, 13);
}

/** The card as a PNG. Waits for the page's fonts so the image is drawn in the app's. */
export async function renderCardImage(card: CardData, doc: Document = document): Promise<Blob> {
  const canvas = doc.createElement("canvas");
  canvas.width = IMAGE_WIDTH;
  canvas.height = cardHeight(card) * IMAGE_SCALE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("save image: no 2D canvas");
  await doc.fonts?.ready;
  const family = doc.defaultView?.getComputedStyle(doc.body).fontFamily || "system-ui, sans-serif";
  drawCard(ctx, card, family);
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("save image: the canvas made no PNG"))), "image/png"),
  );
}

function download(blob: Blob, doc: Document): void {
  const url = URL.createObjectURL(blob);
  const a = doc.createElement("a");
  a.href = url;
  a.download = EARN_STRINGS.fileName;
  doc.body.append(a);
  a.click();
  a.remove();
  // Revoked once the download has started (Safari reads the address after the click returns).
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

/**
 * Hands the PNG over: the share sheet where the browser can share a file (`navigator.canShare({ files })`),
 * else a download. Closing the sheet ends it ("cancelled"); a sheet the browser refuses (no gesture left, a
 * policy) falls back to the download.
 */
export async function deliverCardImage(
  blob: Blob,
  nav: Navigator = navigator,
  doc: Document = document,
): Promise<"shared" | "downloaded" | "cancelled"> {
  const file = new File([blob], EARN_STRINGS.fileName, { type: "image/png" });
  if (typeof nav.share === "function" && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file] });
      return "shared";
    } catch (err) {
      if ((err as { name?: string } | null)?.name === "AbortError") return "cancelled";
    }
  }
  download(blob, doc);
  return "downloaded";
}
