/** @vitest-environment happy-dom */
/**
 * NewAudienceScreen — `/audience/new`'s form (spec 2026-11-25-audience, 3.6; the drawing's New audience
 * frame), and its loading outline. Presentational: the door and the field come in, a press hands out the
 * request the real `buildRequestOf` makes, or nothing. Stand-ins: the build-time flag (on) and the router
 * (Back). The shell store is the real one (the pushed title).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { axe } from "vitest-axe";

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));
const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router, usePathname: () => "/audience/new" }));

import { AUDIENCE_STRINGS as S } from "@/lib/audience-next/audience-words";
import { buildRequestOf, type BuildRequest, type NewDoor } from "@/lib/audience-next/build-request";
import { useShellStore } from "@/stores/shell-store";

import { NewAudienceLoading, NewAudienceScreen } from "../new-audience-screen";

afterEach(() => {
  cleanup();
  router.push.mockReset();
  useShellStore.setState({ pushedTitle: "" });
});

/** The screen with its door and field held as a container would hold them. */
function Form({ initialDoor = "own", initialField = "", onSubmit }: { initialDoor?: NewDoor; initialField?: string; onSubmit(r: BuildRequest): void }) {
  const [door, setDoor] = useState<NewDoor>(initialDoor);
  const [field, setField] = useState(initialField);
  return <NewAudienceScreen door={door} field={field} onDoor={setDoor} onField={setField} onSubmit={onSubmit} />;
}

function show(props: { initialDoor?: NewDoor; initialField?: string } = {}) {
  const onSubmit = vi.fn();
  const view = render(<Form {...props} onSubmit={onSubmit} />);
  return { ...view, onSubmit };
}

const build = () => screen.getByRole("button", { name: S.build });

describe("NewAudienceScreen: the doors and the field", () => {
  it("names the page: the shell's pushed title, and the desk's h1 with Back", () => {
    show();
    expect(useShellStore.getState().pushedTitle).toBe(S.newAudience);
    expect(screen.getByRole("heading", { level: 1, name: S.newAudience })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: S.back }));
    expect(router.push).toHaveBeenCalledWith("/audience");
  });

  it("three native radio rows in one group, each named by its title and described by its line", () => {
    show();
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(3);
    expect(radios.every((r) => r.getAttribute("name") === "door")).toBe(true);
    expect(screen.getByRole("group", { name: S.newAudienceLine })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: S.doorOwn })).toHaveAccessibleDescription(S.doorOwnLine);
    expect(screen.getByRole("radio", { name: S.doorOther })).toHaveAccessibleDescription(S.doorOtherLine);
    expect(screen.getByRole("radio", { name: S.doorDescribe })).toHaveAccessibleDescription(S.doorDescribeLine);
    expect(screen.getByRole("radio", { name: S.doorOwn })).toBeChecked();
  });

  it("your own account: a handle field named “Your TikTok handle”, “@yourhandle”", () => {
    show();
    const field = screen.getByRole("textbox", { name: S.ownField });
    expect(field.tagName).toBe("INPUT");
    expect(field).toHaveAttribute("placeholder", S.ownPlaceholder);
  });

  it("another creator: “Their TikTok handle”, “@handle”", () => {
    show();
    fireEvent.click(screen.getByRole("radio", { name: S.doorOther }));
    expect(screen.getByRole("radio", { name: S.doorOther })).toBeChecked();
    expect(screen.getByRole("textbox", { name: S.otherField })).toHaveAttribute("placeholder", S.otherPlaceholder);
  });

  it("describe them: three lines, at most 500 characters, “Who they are”", () => {
    show({ initialDoor: "describe" });
    const field = screen.getByRole("textbox", { name: S.describeField });
    expect(field.tagName).toBe("TEXTAREA");
    expect(field).toHaveAttribute("rows", "3");
    expect(field).toHaveAttribute("maxlength", "500");
    expect(field).toHaveAttribute("placeholder", S.describePlaceholder);
  });

  it("the prefilled handle shows in the field", () => {
    show({ initialField: "nia.tests" });
    expect(screen.getByRole("textbox", { name: S.ownField })).toHaveValue("nia.tests");
  });

  it("About two minutes. Free.; TikTok only, and Connect them on You", () => {
    show();
    expect(screen.getByText(S.buildLine)).toBeInTheDocument();
    expect(screen.getByText(S.onlyTikTok, { exact: false })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: S.connectOnYou })).toHaveAttribute("href", "/you");
  });

  it("each row is at least 52 tall", () => {
    show();
    for (const radio of screen.getAllByRole("radio")) expect(radio.closest("label")!.className).toMatch(/min-h-\[(5[2-9]|[6-9]\d)px\]/);
  });
});

describe("NewAudienceScreen: Build audience", () => {
  it("is a submit button, in the tab order, aria-disabled while the field makes no request; a press sends nothing", () => {
    const { onSubmit } = show();
    expect(build()).toHaveAttribute("type", "submit");
    expect(build()).not.toBeDisabled();
    expect(build()).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(build());
    fireEvent.change(screen.getByRole("textbox", { name: S.ownField }), { target: { value: "not a handle" } });
    expect(build()).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(build());
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it.each([
    ["own", "@Nia.Tests", buildRequestOf("own", "nia.tests")],
    ["other", "leo.makes", buildRequestOf("other", "leo.makes")],
    ["other", "https://www.tiktok.com/@leo.makes?lang=en", buildRequestOf("other", "leo.makes")],
    ["describe", " Busy parents\nwho meal-prep ", buildRequestOf("describe", "Busy parents who meal-prep")],
  ] as const)("%s with %j hands out the request", (door, value, request) => {
    const { onSubmit } = show({ initialDoor: door });
    fireEvent.change(screen.getByRole("textbox"), { target: { value } });
    expect(build()).not.toHaveAttribute("aria-disabled");
    fireEvent.click(build());
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith(request);
  });

  it("Enter in the handle field builds", async () => {
    const { onSubmit } = show();
    const user = userEvent.setup();
    await user.type(screen.getByRole("textbox", { name: S.ownField }), "nia.tests{Enter}");
    expect(onSubmit).toHaveBeenCalledWith(buildRequestOf("own", "nia.tests"));
  });
});

describe("NewAudienceScreen: building replaces the form in place", () => {
  it("under the same title, with no form left", () => {
    render(<NewAudienceScreen door="own" field="nia.tests" onDoor={vi.fn()} onField={vi.fn()} onSubmit={vi.fn()} building={<p>the building view</p>} />);
    expect(screen.getByText("the building view")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: S.newAudience })).toBeInTheDocument();
    expect(screen.queryByRole("radio")).toBeNull();
    expect(screen.queryByRole("button", { name: S.build })).toBeNull();
  });
});

describe("NewAudienceLoading", () => {
  it("the title, and the card and the field as quiet blocks, busy", () => {
    const { container } = render(<NewAudienceLoading />);
    expect(useShellStore.getState().pushedTitle).toBe(S.newAudience);
    expect(screen.getByRole("heading", { level: 1, name: S.newAudience })).toBeInTheDocument();
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(container.querySelectorAll("[data-quiet]")).toHaveLength(2);
    expect(screen.queryByRole("radio")).toBeNull();
  });
});

describe("NewAudienceScreen: axe", () => {
  it.each(["own", "other", "describe"] as const)("the form on %s is clean", async (door) => {
    const { container } = show({ initialDoor: door });
    // @ts-expect-error -- vitest-axe matcher type augmentation not picked up
    expect(await axe(container)).toHaveNoViolations();
  });

  it("the loading outline is clean", async () => {
    const { container } = render(<NewAudienceLoading />);
    // @ts-expect-error -- vitest-axe matcher type augmentation not picked up
    expect(await axe(container)).toHaveNoViolations();
  });
});
