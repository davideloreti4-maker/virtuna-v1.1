/** @vitest-environment happy-dom */
/**
 * honesty-comparison.test.tsx — Wave-0 Nyquist scaffold for TRUST-01 / TRUST-02.
 *
 * RED until Plan 03-02 ships `@/components/numen-landing/honesty-comparison`.
 * Encodes the UI-SPEC §1 semantic-table contract for the anti-snake-oil section:
 *  - exactly one `<table>` with a `<caption>` and two column `<th scope="col">`
 *    headers ("Numen" vs the rival "Virality-score tools");
 *  - this is the ONE sanctioned home of the rival strings (D-05 / RESEARCH
 *    Pitfall 5), so a POSITIVE assertion confirms they ARE present here — the
 *    voice gate (voice.test.tsx) bans them everywhere else.
 *
 * Component imported dynamically so the file is RED on the missing module now.
 */
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";

describe("HonestyComparison — TRUST-01/02 semantic table + scoped rival strings (RED until Plan 03-02)", () => {
  it("renders a single <table> with a <caption> and two scope=\"col\" headers", async () => {
    const { HonestyComparison } = await import(
      "@/components/numen-landing/honesty-comparison"
    );
    const { container } = render(<HonestyComparison />);
    expect(container.querySelectorAll("table").length).toBe(1);
    expect(container.querySelector("caption")).toBeTruthy();
    const colHeaders = Array.from(container.querySelectorAll('th[scope="col"]'));
    expect(colHeaders.length).toBeGreaterThanOrEqual(2);
    const headerText = colHeaders.map((th) => th.textContent ?? "").join(" ");
    expect(headerText).toMatch(/Numen/);
    expect(headerText).toMatch(/Virality-score tools/i);
  });

  it("POSITIVELY contains the sanctioned rival strings (D-05 — they live ONLY here)", async () => {
    const { HonestyComparison } = await import(
      "@/components/numen-landing/honesty-comparison"
    );
    const text = render(<HonestyComparison />).container.textContent ?? "";
    // These are SUPPOSED to be present in this one scoped section.
    expect(text).toMatch(/viral/i);
    expect(text).toMatch(/accuracy|guaranteed/i);
  });
});
