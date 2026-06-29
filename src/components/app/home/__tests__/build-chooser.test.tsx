/** @vitest-environment happy-dom */
/**
 * BuildChooser — the `+ Build an audience` chooser (UX-04 / D-03 / D-08).
 *
 * Locks the three Build paths converging on a saved named General SIM:
 *  - the three path labels render;
 *  - From a description issues navigation to the literal /audience/new?mode=general (D-08);
 *  - From a template lists GENERAL_TEMPLATES and picking one → names → calls cloneTemplateAudience
 *    and fires onBuilt with the saved mode:'general' SIM;
 *  - no accent/coral leaks into the rendered tree (matte + dosage).
 *
 * Mocks: next/navigation (router.push), @/lib/supabase/client (createClient),
 * and cloneTemplateAudience (real GENERAL_TEMPLATES kept via importOriginal).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import type { Audience } from "@/lib/audience/audience-types";

// ─── Mocks ──────────────────────────────────────────────────────────────────

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ __mockClient: true }),
}));

const cloneMock = vi.fn();
vi.mock("@/lib/audience/audience-repo", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/audience/audience-repo")>();
  return {
    ...actual, // keep the real GENERAL_TEMPLATES
    cloneTemplateAudience: (...args: unknown[]) => cloneMock(...args),
  };
});

import { BuildChooser } from "../build-chooser";
import { GENERAL_TEMPLATES } from "@/lib/audience/audience-repo";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function savedSim(): Audience {
  return {
    ...GENERAL_TEMPLATES[0]!,
    id: "aud-cloned-1",
    user_id: "user-1",
    mode: "general",
    name: "My Analyst Panel",
  };
}

function renderChooser(over: Partial<React.ComponentProps<typeof BuildChooser>> = {}) {
  const props: React.ComponentProps<typeof BuildChooser> = {
    open: true,
    onOpenChange: vi.fn(),
    onBuilt: vi.fn(),
    onEvidence: vi.fn(),
    ...over,
  };
  render(<BuildChooser {...props} />);
  return props;
}

beforeEach(() => {
  pushMock.mockReset();
  cloneMock.mockReset();
  cleanup();
});

afterEach(() => cleanup());

describe("BuildChooser — three Build paths (UX-04 / D-03 / D-08)", () => {
  it("renders the three path labels", () => {
    renderChooser();
    expect(screen.getByText("From a description")).toBeInTheDocument();
    expect(screen.getByText("From evidence")).toBeInTheDocument();
    expect(screen.getByText("From a template")).toBeInTheDocument();
  });

  it("From a description navigates to the literal /audience/new?mode=general (D-08)", () => {
    const props = renderChooser();
    fireEvent.click(screen.getByText("From a description"));
    expect(pushMock).toHaveBeenCalledTimes(1);
    expect(pushMock).toHaveBeenCalledWith("/audience/new?mode=general");
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("From evidence closes and invokes onEvidence (reuse, no rebuild)", () => {
    const props = renderChooser();
    fireEvent.click(screen.getByText("From evidence"));
    expect(props.onEvidence).toHaveBeenCalledTimes(1);
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("From a template lists GENERAL_TEMPLATES; picking one → clone → onBuilt with a mode:'general' SIM", async () => {
    const saved = savedSim();
    cloneMock.mockResolvedValue(saved);
    const props = renderChooser();

    // Open the template list.
    fireEvent.click(screen.getByText("From a template"));

    // Every GENERAL_TEMPLATES name renders.
    for (const tpl of GENERAL_TEMPLATES) {
      expect(screen.getByText(tpl.name)).toBeInTheDocument();
    }

    // Pick the first template → naming view (auto-named, editable).
    fireEvent.click(screen.getByText(GENERAL_TEMPLATES[0]!.name));
    const nameInput = screen.getByLabelText("Name your audience") as HTMLInputElement;
    expect(nameInput.value).toBe(GENERAL_TEMPLATES[0]!.name);
    fireEvent.change(nameInput, { target: { value: "My Analyst Panel" } });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Build audience" }));
      await Promise.resolve();
    });

    // Clone helper called with the picked template id + the edited name.
    expect(cloneMock).toHaveBeenCalledTimes(1);
    const cloneArgs = cloneMock.mock.calls[0]!;
    expect(cloneArgs[1]).toBe(GENERAL_TEMPLATES[0]!.id);
    expect(cloneArgs[2]).toBe("My Analyst Panel");

    // onBuilt fired with the saved mode:'general' SIM; chooser closed.
    expect(props.onBuilt).toHaveBeenCalledTimes(1);
    const built = (props.onBuilt as ReturnType<typeof vi.fn>).mock.calls[0]![0] as Audience;
    expect(built.mode).toBe("general");
    expect(built.id).toBe("aud-cloned-1");
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("renders no accent/coral paint (matte + dosage)", () => {
    const { container } = render(
      <BuildChooser open onOpenChange={vi.fn()} onBuilt={vi.fn()} />,
    );
    const html = document.body.innerHTML + container.innerHTML;
    expect(html).not.toMatch(/text-accent/);
    expect(html).not.toMatch(/d97757/i);
    expect(html).not.toMatch(/FF7F50/i);
  });
});
