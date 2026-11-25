import { describe, expect, it } from "vitest";

import { firstNameOf, greetingFor, initialsOf } from "../greeting";

/** A local time on the day the screen was drawn. */
const at = (hour: number) => new Date(2026, 10, 23, hour);

describe("greetingFor", () => {
  it("says morning until noon, afternoon until six, then evening", () => {
    expect(greetingFor(at(8), "Nia")).toBe("Good morning, Nia.");
    expect(greetingFor(at(12), "Nia")).toBe("Good afternoon, Nia.");
    expect(greetingFor(at(17), "Nia")).toBe("Good afternoon, Nia.");
    expect(greetingFor(at(18), "Nia")).toBe("Good evening, Nia.");
  });

  it("counts the small hours as morning", () => {
    expect(greetingFor(at(0), "Nia")).toBe("Good morning, Nia.");
    expect(greetingFor(at(4), "Nia")).toBe("Good morning, Nia.");
  });

  it("without a name, greets without one", () => {
    expect(greetingFor(at(8), null)).toBe("Good morning.");
  });
});

describe("firstNameOf", () => {
  it("is the first word, trimmed", () => {
    expect(firstNameOf("  Nia  Long ")).toBe("Nia");
  });

  it.each(["", "   ", null, undefined])("is null for %j", (name) => {
    expect(firstNameOf(name)).toBeNull();
  });
});

describe("initialsOf", () => {
  it("takes up to two first letters, upper case", () => {
    expect(initialsOf("Nia Long")).toBe("NL");
    expect(initialsOf("nia")).toBe("N");
    expect(initialsOf("A B C")).toBe("AB");
  });

  it.each(["", null])("is ? for %j", (name) => {
    expect(initialsOf(name)).toBe("?");
  });

  it("without a name takes the email's first letter before \"?\"", () => {
    expect(initialsOf("", "nia@example.test")).toBe("N");
    expect(initialsOf(null, "  zed@example.test")).toBe("Z");
    expect(initialsOf("Nia Long", "zed@example.test")).toBe("NL");
    expect(initialsOf("", "")).toBe("?");
    expect(initialsOf(undefined, null)).toBe("?");
  });
});
