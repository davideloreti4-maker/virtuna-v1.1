/** @vitest-environment happy-dom */
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MavenMark } from "../maven-logo";

// Flag off (the default): the mark is the legacy gull, byte for byte.
describe("MavenMark, flag off", () => {
  it("draws the legacy gull in its 240 x 96 box", () => {
    const { container } = render(<MavenMark size={20} />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("viewBox")).toBe("0 0 240 96");
    expect(svg.getAttribute("width")).toBe("50");
    expect(svg.getAttribute("height")).toBe("20");
    expect(svg.querySelector("path")!.getAttribute("d")).toBe(
      "M34 66 Q50 30 84 24 Q106 20 120 48 Q134 20 156 24 Q190 30 206 66 " +
        "Q192 38 158 34 Q138 32 120 58 Q102 32 82 34 Q48 38 34 66 Z",
    );
  });
});
