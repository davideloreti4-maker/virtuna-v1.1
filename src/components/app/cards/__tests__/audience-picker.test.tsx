/** @vitest-environment happy-dom */
import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import {
  AudiencePicker,
  type TargetAudience,
} from "@/components/app/cards/audience-picker";

/**
 * PROFILE-05 — Card 2 composite controlled value (age + gender + geo + language).
 *
 * Behavioral contract:
 * - Each subfield's onChange emits the FULL spread, never a partial diff
 * - Optional fields accept null and empty inputs coerce back to null on geo / language
 * - Gender skew tiles render with aria-pressed and stable testids
 */
const EMPTY: TargetAudience = {
  age_range: null,
  gender_skew: null,
  geo: null,
  language: null,
};

describe("AudiencePicker (PROFILE-05)", () => {
  it("renders three gender-skew tiles with stable data-testid selectors", () => {
    const { container } = render(
      <AudiencePicker value={EMPTY} onChange={() => {}} />
    );
    expect(
      container.querySelector('[data-testid="card-2-gender-female"]')
    ).not.toBeNull();
    expect(
      container.querySelector('[data-testid="card-2-gender-balanced"]')
    ).not.toBeNull();
    expect(
      container.querySelector('[data-testid="card-2-gender-male"]')
    ).not.toBeNull();
  });

  it("renders geo and language text inputs with stable testids", () => {
    const { container } = render(
      <AudiencePicker value={EMPTY} onChange={() => {}} />
    );
    expect(
      container.querySelector('[data-testid="card-2-geo"]')
    ).not.toBeNull();
    expect(
      container.querySelector('[data-testid="card-2-language"]')
    ).not.toBeNull();
  });

  it("clicking a gender tile emits the full spread with gender_skew set", () => {
    const onChange = vi.fn();
    const { container } = render(
      <AudiencePicker value={EMPTY} onChange={onChange} />
    );
    fireEvent.click(
      container.querySelector('[data-testid="card-2-gender-female"]') as HTMLElement
    );
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({
      age_range: null,
      gender_skew: "female",
      geo: null,
      language: null,
    });
  });

  it("typing in geo input emits the full spread (other fields preserved)", () => {
    const onChange = vi.fn();
    const seeded: TargetAudience = {
      age_range: "25-34",
      gender_skew: "balanced",
      geo: null,
      language: "English",
    };
    const { container } = render(
      <AudiencePicker value={seeded} onChange={onChange} />
    );
    const geoInput = container.querySelector(
      '[data-testid="card-2-geo"]'
    ) as HTMLInputElement;
    fireEvent.change(geoInput, { target: { value: "United States" } });
    expect(onChange).toHaveBeenCalledWith({
      age_range: "25-34",
      gender_skew: "balanced",
      geo: "United States",
      language: "English",
    });
  });

  it("typing in language input emits the full spread (other fields preserved)", () => {
    const onChange = vi.fn();
    const seeded: TargetAudience = {
      age_range: "18-24",
      gender_skew: null,
      geo: "Canada",
      language: null,
    };
    const { container } = render(
      <AudiencePicker value={seeded} onChange={onChange} />
    );
    const langInput = container.querySelector(
      '[data-testid="card-2-language"]'
    ) as HTMLInputElement;
    fireEvent.change(langInput, { target: { value: "French" } });
    expect(onChange).toHaveBeenCalledWith({
      age_range: "18-24",
      gender_skew: null,
      geo: "Canada",
      language: "French",
    });
  });

  it("clearing geo input coerces back to null in the emitted value", () => {
    const onChange = vi.fn();
    const seeded: TargetAudience = {
      age_range: null,
      gender_skew: null,
      geo: "Germany",
      language: null,
    };
    const { container } = render(
      <AudiencePicker value={seeded} onChange={onChange} />
    );
    const geoInput = container.querySelector(
      '[data-testid="card-2-geo"]'
    ) as HTMLInputElement;
    fireEvent.change(geoInput, { target: { value: "" } });
    expect(onChange).toHaveBeenCalledWith({
      age_range: null,
      gender_skew: null,
      geo: null,
      language: null,
    });
  });

  it("aria-pressed mirrors gender_skew prop", () => {
    const { container, rerender } = render(
      <AudiencePicker value={EMPTY} onChange={() => {}} />
    );
    expect(
      container
        .querySelector('[data-testid="card-2-gender-balanced"]')
        ?.getAttribute("aria-pressed")
    ).toBe("false");
    rerender(
      <AudiencePicker
        value={{ ...EMPTY, gender_skew: "balanced" }}
        onChange={() => {}}
      />
    );
    expect(
      container
        .querySelector('[data-testid="card-2-gender-balanced"]')
        ?.getAttribute("aria-pressed")
    ).toBe("true");
    expect(
      container
        .querySelector('[data-testid="card-2-gender-female"]')
        ?.getAttribute("aria-pressed")
    ).toBe("false");
  });

  it("renders empty input value (not null) when geo is null (controlled-input safety)", () => {
    const { container } = render(
      <AudiencePicker value={EMPTY} onChange={() => {}} />
    );
    const geoInput = container.querySelector(
      '[data-testid="card-2-geo"]'
    ) as HTMLInputElement;
    expect(geoInput.value).toBe("");
  });
});
