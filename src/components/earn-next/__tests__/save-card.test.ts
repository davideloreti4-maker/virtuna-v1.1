/** @vitest-environment happy-dom */
/**
 * save-card (plan 2026-11-24-earn, step A): the share card drawn on a canvas 1080 wide (the same layout,
 * the QR from the same matrix), made a PNG, and handed to the share sheet where the browser can share a
 * file, else downloaded as `maven-earn.png`. Real: the drawing, the layout, the QR matrix (`uqr`). Stood
 * in for: the canvas (its 2D context and `toBlob`) and `navigator.share` / `canShare`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { MARK_PATH_NEXT } from "@/components/brand/maven-logo";

import { qrMatrix, qrRuns } from "../qr";
import { CARD_WIDTH, IMAGE_SCALE, IMAGE_WIDTH, SHARE_LOOK, cardHeight, deliverCardImage, drawCard, renderCardImage, type CardData } from "../save-card";
import { recordingContext, textsOf } from "./canvas-context";

const CARD: CardData = { link: "https://maven.example.test/?ref=K349Z4QP", code: "K349Z4QP", name: "Nia Carter", ratePct: "50%" };
const FAMILY = "Inter, sans-serif";

describe("the layout", () => {
  it("is 1080 wide: the 360-wide card at three times", () => {
    expect(CARD_WIDTH * IMAGE_SCALE).toBe(IMAGE_WIDTH);
    expect(IMAGE_WIDTH).toBe(1080);
  });

  it("is as tall as what it holds: the name's two lines only when there is a name", () => {
    expect(cardHeight(CARD)).toBe(354);
    expect(cardHeight({ ...CARD, name: null })).toBe(288);
  });
});

describe("drawCard: what is drawn", () => {
  const draw = (card: CardData = CARD) => {
    const { ctx, calls } = recordingContext();
    drawCard(ctx, card, FAMILY);
    return calls;
  };

  it("the card's words, in order, in the app's font", () => {
    const calls = draw();
    expect(textsOf(calls)).toEqual(["Maven", "YOU EARN", "50%", "SHARED BY", "Nia Carter", "K349Z4QP"]);
    for (const c of calls.filter((x) => x.op === "fillText")) expect(c.font).toContain(FAMILY);
  });

  it("every word inside the image", () => {
    const calls = draw();
    const height = cardHeight(CARD) * IMAGE_SCALE;
    for (const c of calls.filter((x) => x.op === "fillText")) {
      const [, x, y] = c.args as [string, number, number];
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(IMAGE_WIDTH);
      expect(y).toBeGreaterThan(0);
      expect(y).toBeLessThan(height);
    }
  });

  it("the card in its dark fill, the QR plate, every run of the matrix's dark modules, and nothing else in the module colour", () => {
    const calls = draw();
    const fills = calls.filter((c) => c.op === "fill").map((c) => c.fillStyle);
    expect(fills[0]).toBe(SHARE_LOOK.card);
    expect(fills).toContain(SHARE_LOOK.plate);
    const modules = calls.filter((c) => c.op === "fillRect" && c.fillStyle === SHARE_LOOK.module);
    expect(modules).toHaveLength(qrRuns(qrMatrix(CARD.link)).length);
    // Whole pixels, so neighbouring runs leave no seam for a scanner to trip on.
    for (const m of modules) for (const v of m.args as number[]) expect(Number.isInteger(v)).toBe(true);
  });

  it("the modules sit on the plate with the quiet zone around them, centred", () => {
    const calls = draw();
    const modules = calls.filter((c) => c.op === "fillRect" && c.fillStyle === SHARE_LOOK.module).map((c) => c.args as number[]);
    const n = qrMatrix(CARD.link).length;
    const size = modules.reduce((min, [, , , h]) => Math.min(min, h!), Infinity);
    const left = Math.min(...modules.map(([x]) => x!));
    const right = Math.max(...modules.map(([x, , w]) => x! + w!));
    // Four modules at least on each side of the code, inside the plate (150 at 3x = 450, centred).
    const plateLeft = (IMAGE_WIDTH - 450) / 2;
    expect(left - plateLeft).toBeGreaterThanOrEqual(4 * size);
    expect(plateLeft + 450 - right).toBeGreaterThanOrEqual(4 * size);
    expect(right - left).toBeLessThanOrEqual(n * size);
  });

  it("Maven's mark: the new look's path, every curve of it, in the accent", () => {
    const calls = draw();
    const curves = calls.filter((c) => c.op === "bezierCurveTo");
    expect(curves).toHaveLength((MARK_PATH_NEXT.match(/C/g) ?? []).length);
    const markFill = calls.findIndex((c) => c.op === "fill" && c.fillStyle === SHARE_LOOK.mark);
    expect(markFill).toBeGreaterThan(calls.indexOf(curves.at(-1)!));
  });

  it("no name: no SHARED BY, and the code still drawn", () => {
    expect(textsOf(draw({ ...CARD, name: null }))).toEqual(["Maven", "YOU EARN", "50%", "K349Z4QP"]);
  });

  it("a name too long for the card is cut to fit, with an ellipsis", () => {
    const long = "Bartholomew Montgomery-Featherstonehaugh the Third";
    const calls = draw({ ...CARD, name: long });
    const drawn = textsOf(calls)[4]!;
    expect(drawn.endsWith("…")).toBe(true);
    expect(long.startsWith(drawn.slice(0, -1))).toBe(true);
    const size = 22 * IMAGE_SCALE;
    expect(drawn.length * size * 0.55).toBeLessThanOrEqual((CARD_WIDTH - 40) * IMAGE_SCALE);
  });

  it("the share card's accent is the app's brand accent", () => {
    const css = readFileSync(join(__dirname, "..", "..", "..", "app", "globals.css"), "utf8");
    const accent = /--color-accent:\s*(#[0-9a-fA-F]{6})/.exec(css)![1]!;
    expect(SHARE_LOOK.mark.toLowerCase()).toBe(accent.toLowerCase());
  });
});

describe("renderCardImage: the PNG", () => {
  let recorded: ReturnType<typeof recordingContext>;
  let canvases: HTMLCanvasElement[];
  beforeEach(() => {
    recorded = recordingContext();
    canvases = [];
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (this: HTMLCanvasElement) {
      canvases.push(this);
      return recorded.ctx as never;
    });
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((done: BlobCallback, type?: string) => done(new Blob(["png"], { type: type ?? "" })));
  });
  afterEach(() => vi.restoreAllMocks());

  it("a canvas 1080 wide and as tall as the card, drawn, as image/png", async () => {
    const blob = await renderCardImage(CARD);
    expect(canvases).toHaveLength(1);
    expect([canvases[0]!.width, canvases[0]!.height]).toEqual([1080, 1062]);
    expect(textsOf(recorded.calls)).toContain("K349Z4QP");
    expect(blob.type).toBe("image/png");
  });

  it("a browser with no 2D canvas: it fails, saying why", async () => {
    vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue(null);
    await expect(renderCardImage(CARD)).rejects.toThrow(/canvas/);
  });
});

describe("deliverCardImage: the share sheet, else a download", () => {
  const blob = new Blob(["png"], { type: "image/png" });
  let downloads: Array<{ name: string; href: string }>;
  const onClick = (event: Event) => {
    const a = event.target as HTMLAnchorElement;
    if (a.tagName === "A") {
      downloads.push({ name: a.download, href: a.href });
      event.preventDefault();
    }
  };
  beforeEach(() => {
    downloads = [];
    document.addEventListener("click", onClick);
  });
  afterEach(() => document.removeEventListener("click", onClick));

  it("where the browser can share the file: the share sheet with maven-earn.png, no download", async () => {
    const share = vi.fn(async () => {});
    const canShare = vi.fn(() => true);
    expect(await deliverCardImage(blob, { share, canShare } as unknown as Navigator)).toBe("shared");
    const { files } = (share.mock.calls[0] as unknown as [{ files: File[] }])[0];
    expect(files).toHaveLength(1);
    expect([files[0]!.name, files[0]!.type]).toEqual(["maven-earn.png", "image/png"]);
    expect(canShare).toHaveBeenCalledWith({ files });
    expect(downloads).toEqual([]);
  });

  it("where it cannot (or has no share at all): a download named maven-earn.png", async () => {
    expect(await deliverCardImage(blob, { canShare: () => false, share: vi.fn() } as unknown as Navigator)).toBe("downloaded");
    expect(await deliverCardImage(blob, {} as Navigator)).toBe("downloaded");
    expect(downloads.map((d) => d.name)).toEqual(["maven-earn.png", "maven-earn.png"]);
    expect(downloads[0]!.href).toMatch(/^blob:/);
    expect(document.querySelector("a[download]")).toBeNull();
  });

  it("the creator closes the share sheet: nothing else happens", async () => {
    const share = vi.fn(async () => {
      throw new DOMException("Share canceled", "AbortError");
    });
    expect(await deliverCardImage(blob, { share, canShare: () => true } as unknown as Navigator)).toBe("cancelled");
    expect(downloads).toEqual([]);
  });

  it("the share sheet refuses (no gesture left, a policy): the download instead", async () => {
    const share = vi.fn(async () => {
      throw new DOMException("Must be handling a user gesture", "NotAllowedError");
    });
    expect(await deliverCardImage(blob, { share, canShare: () => true } as unknown as Navigator)).toBe("downloaded");
    expect(downloads.map((d) => d.name)).toEqual(["maven-earn.png"]);
  });
});
