/** What the edit tool's scripts use of the libraries that bring no types of their own. */

declare module "fontkit" {
  export interface Glyph {
    /** 0 is the font's "no such glyph". */
    id: number;
    /** In font units, at the instance's axes. */
    advanceWidth: number;
  }
  export interface Font {
    unitsPerEm: number;
    variationAxes: Record<string, { name: string; min: number; default: number; max: number }>;
    /** The font at these axis values; axes left out keep their default. */
    getVariation(settings: Record<string, number>): Font;
    glyphForCodePoint(codePoint: number): Glyph;
    /** Shapes a run of text; `features` turns the named ones on or off, the rest as the font asks. */
    layout(text: string, features?: Record<string, boolean>): { advanceWidth: number };
  }
  export function openSync(path: string): Font;
}

declare module "pixelmatch" {
  /** Counts the pixels of two pictures of one size that are further apart than `threshold`; draws them into `output` when one is given. */
  export default function pixelmatch(one: Uint8Array, two: Uint8Array, output: Uint8Array | undefined, width: number, height: number, options?: { threshold?: number }): number;
}

declare module "pngjs" {
  export class PNG {
    constructor(options?: { width?: number; height?: number });
    width: number;
    height: number;
    data: Buffer;
    static sync: { read(file: Buffer): PNG; write(picture: PNG): Buffer };
  }
}
