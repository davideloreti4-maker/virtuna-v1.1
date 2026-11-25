/**
 * A recording stand-in for `CanvasRenderingContext2D` (the canvas is the boundary: happy-dom draws
 * nothing). Every drawing call is recorded with the state it ran under (fill colour, font, alignment,
 * letter spacing), so a test can read what was drawn where. `measureText` gives a width of 0.55 em per
 * character, enough for a long name to need cutting.
 */
export interface DrawCall {
  op: string;
  args: unknown[];
  fillStyle: string;
  font: string;
  textAlign: string;
  letterSpacing: string;
}

const OPS = [
  "beginPath", "moveTo", "lineTo", "bezierCurveTo", "quadraticCurveTo", "arcTo", "closePath", "rect",
  "fill", "fillRect", "fillText", "save", "restore", "translate", "scale", "clearRect", "clip",
] as const;

export function recordingContext() {
  const calls: DrawCall[] = [];
  const ctx: Record<string, unknown> = {
    fillStyle: "#000000",
    font: "10px sans-serif",
    textAlign: "start",
    textBaseline: "alphabetic",
    letterSpacing: "0px",
    measureText(text: string) {
      const size = Number(/(\d+(?:\.\d+)?)px/.exec(String(ctx.font))?.[1] ?? 10);
      return { width: text.length * size * 0.55 };
    },
  };
  for (const op of OPS) {
    ctx[op] = (...args: unknown[]) => {
      calls.push({ op, args, fillStyle: String(ctx.fillStyle), font: String(ctx.font), textAlign: String(ctx.textAlign), letterSpacing: String(ctx.letterSpacing) });
    };
  }
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
}

/** The texts drawn, in order. */
export const textsOf = (calls: DrawCall[]) => calls.filter((c) => c.op === "fillText").map((c) => c.args[0] as string);
