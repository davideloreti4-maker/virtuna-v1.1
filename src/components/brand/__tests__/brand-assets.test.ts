import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { MARK_PATH_NEXT } from "../maven-logo";

const brand = (f: string) => readFileSync(join(process.cwd(), "public/brand", f), "utf8");

/**
 * The standalone new-look assets carry a copy of the mark's path (an SVG file cannot import it).
 * Regenerating the mark without them would ship a favicon that no longer matches the sidebar.
 */
describe("new-look brand assets", () => {
  it.each(["next-icon.svg", "next-apple-icon.svg", "maven-mark-next.svg"])(
    "%s draws the current MARK_PATH_NEXT in the brand coral",
    (file) => {
      const svg = brand(file);
      expect(svg).toContain(`d="${MARK_PATH_NEXT}"`);
      expect(svg).toContain("#FF6363");
    },
  );

  it("keeps the legacy favicons byte-for-byte on the old gull", () => {
    for (const file of ["icon.svg", "apple-icon.svg"]) {
      expect(brand(file)).toContain('fill="#ece7de" d="M34 66 Q50 30 84 24');
      expect(brand(file)).toContain('fill="#262624"');
    }
  });
});
