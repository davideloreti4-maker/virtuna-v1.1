/** @vitest-environment happy-dom */
/**
 * QrCode (plan 2026-11-24-earn, step A): the link's QR code drawn as SVG squares from `uqr`'s matrix, with
 * a quiet zone of four modules and an accessible name. Real: the component and the `uqr` package (its
 * `encode` is called here too, independently, to know which squares must be drawn). No stand-ins.
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { encode } from "uqr";

import { QR_QUIET, QrCode, qrMatrix } from "../qr";

const LINK = "https://maven.example.test/?ref=K349Z4QP";

afterEach(cleanup);

/** The dark cells the path draws, as "x,y", from its runs (`M x y h n v1 h-n z`). */
function cellsOf(d: string): Set<string> {
  const cells = new Set<string>();
  for (const m of d.matchAll(/M(\d+) (\d+)h(\d+)v1h-\d+z/g)) {
    const [x, y, run] = [Number(m[1]), Number(m[2]), Number(m[3])];
    for (let i = 0; i < run; i++) cells.add(`${x + i},${y}`);
  }
  return cells;
}
const darkOf = (data: boolean[][]) => new Set(data.flatMap((row, y) => row.flatMap((on, x) => (on ? [`${x},${y}`] : []))));

describe("qrMatrix", () => {
  it("is uqr's matrix for the text, without uqr's own border (the quiet zone is drawn around it)", () => {
    const own = encode(LINK, { ecc: "M", border: 0 });
    expect(qrMatrix(LINK)).toEqual(own.data);
    expect(qrMatrix(LINK).length).toBe(own.size);
  });
});

describe("QrCode", () => {
  it("is an image named 'QR code of your link'", () => {
    render(<QrCode text={LINK} ink="black" plate="white" />);
    expect(screen.getByRole("img", { name: "QR code of your link" })).toBeInTheDocument();
  });

  it("draws exactly the matrix's dark squares, every one, and nothing else", () => {
    render(<QrCode text={LINK} ink="black" plate="white" />);
    const d = screen.getByRole("img").querySelector("path")!.getAttribute("d")!;
    expect(d.replace(/M\d+ \d+h\d+v1h-\d+z/g, "")).toBe("");
    expect(cellsOf(d)).toEqual(darkOf(encode(LINK, { ecc: "M", border: 0 }).data));
  });

  it("another link draws other squares", () => {
    const { unmount } = render(<QrCode text={LINK} ink="black" plate="white" />);
    const one = screen.getByRole("img").querySelector("path")!.getAttribute("d");
    unmount();
    render(<QrCode text="https://maven.example.test/?ref=ZZZZ2222" ink="black" plate="white" />);
    expect(screen.getByRole("img").querySelector("path")!.getAttribute("d")).not.toBe(one);
  });

  it(`leaves a quiet zone of ${QR_QUIET} modules on the plate around the code`, () => {
    render(<QrCode text={LINK} ink="black" plate="white" />);
    const svg = screen.getByRole("img");
    const n = qrMatrix(LINK).length;
    expect(QR_QUIET).toBe(4);
    expect(svg.getAttribute("viewBox")).toBe(`-4 -4 ${n + 8} ${n + 8}`);
    const plate = svg.querySelector("rect")!;
    expect([plate.getAttribute("x"), plate.getAttribute("y"), plate.getAttribute("width"), plate.getAttribute("height")]).toEqual(["-4", "-4", `${n + 8}`, `${n + 8}`]);
    expect(plate.getAttribute("fill")).toBe("white");
    expect(svg.querySelector("path")!.getAttribute("fill")).toBe("black");
  });
});
