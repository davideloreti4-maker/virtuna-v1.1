/** @vitest-environment happy-dom */
/**
 * save-affordance-state.test.tsx — saved state must be READABLE, not just writable.
 *
 * The shipped affordance derived "am I saved?" from `save.isSuccess`, the mutation's own per-mount
 * flag. Three live consequences, none of which any test could see:
 *   - a card saved last week rendered "Save" again on every fresh mount;
 *   - clicking it wrote a SECOND row (no unique constraint existed either);
 *   - there was no way to un-save from the card you saved it on.
 *
 * So these assertions are about which mutation fires for a given STORE state. A button that reads
 * "Saved" while posting a duplicate is the exact bug, and it is invisible to a test that only
 * checks the label.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SaveAffordance } from "../save-affordance";
import type { SavedItem } from "@/lib/shelf/shelf-repo";

const saveMutate = vi.fn();
const removeMutate = vi.fn();

/** The store's answer for the identity under test — set per test. */
let storeItem: SavedItem | undefined;
let saveIsSuccess = false;

vi.mock("@/hooks/queries/use-saved-items", () => ({
  useSaveItem: () => ({ mutate: saveMutate, isPending: false, isSuccess: saveIsSuccess }),
  useDeleteSavedItem: () => ({ mutate: removeMutate, isPending: false }),
  useSavedItemByRef: () => ({ item: storeItem, ready: true }),
}));

// Provenance is exercised by save-provenance.test.tsx; here the ref is passed explicitly so the
// identity under test is unambiguous.
const persisted: SavedItem = {
  id: "row-99",
  user_id: "u1",
  item_type: "hook",
  ref_id: "msg-1:0",
  thread_id: "thread-a",
  project_id: null,
  title: "a hook",
  snapshot: {},
  created_at: "2026-07-01T00:00:00Z",
};

function mount(props: Partial<React.ComponentProps<typeof SaveAffordance>> = {}) {
  return render(
    <SaveAffordance item_type="hook" ref_id="msg-1:0" snapshot={{ hookLine: "x" }} {...props} />,
  );
}

beforeEach(() => {
  saveMutate.mockClear();
  removeMutate.mockClear();
  storeItem = undefined;
  saveIsSuccess = false;
});

describe("an already-saved card renders saved ON MOUNT", () => {
  it("shows Saved with no prior interaction when the store has the row", () => {
    // This is the regression: a fresh mount used to show "Save" because isSuccess was false.
    storeItem = persisted;
    mount();
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Saved")).toBeTruthy();
  });

  it("shows Save when the store does not have it", () => {
    mount();
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByLabelText("Save to shelf")).toBeTruthy();
  });
});

describe("a second click un-saves instead of duplicating", () => {
  it("DELETEs the known row id and never POSTs again", () => {
    storeItem = persisted;
    mount();
    fireEvent.click(screen.getByRole("button"));
    expect(removeMutate).toHaveBeenCalledWith("row-99");
    expect(saveMutate).not.toHaveBeenCalled();
  });

  it("POSTs exactly once when not yet saved", () => {
    mount();
    fireEvent.click(screen.getByRole("button"));
    expect(saveMutate).toHaveBeenCalledTimes(1);
    expect(removeMutate).not.toHaveBeenCalled();
    const input = saveMutate.mock.calls[0]![0] as Record<string, unknown>;
    expect(input.ref_id).toBe("msg-1:0");
    expect(input.item_type).toBe("hook");
  });

  it("offers un-save as the ACTION in its label, not just a state", () => {
    storeItem = persisted;
    mount();
    expect(screen.getByLabelText("Remove from your Library")).toBeTruthy();
  });
});

describe("a block with no identity degrades honestly", () => {
  it("cannot be looked up, so it uses the per-mount flag and refuses to re-post", () => {
    // A live run has no message row yet, so ref_id is null and there is nothing to match on.
    // It must not offer un-save (no row id) and must not write a duplicate.
    saveIsSuccess = true;
    mount({ ref_id: null });
    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Saved to shelf")).toBeTruthy();
    expect(button).toBeDisabled();

    fireEvent.click(button);
    expect(saveMutate).not.toHaveBeenCalled();
    expect(removeMutate).not.toHaveBeenCalled();
  });

  it("still saves normally on a first click with a null ref", () => {
    mount({ ref_id: null });
    fireEvent.click(screen.getByRole("button"));
    expect(saveMutate).toHaveBeenCalledTimes(1);
    // Null, never a guessed identity.
    expect((saveMutate.mock.calls[0]![0] as Record<string, unknown>).ref_id).toBeNull();
  });
});

describe("the store wins over the mutation flag", () => {
  it("reads unsaved when the row was removed elsewhere, even after a local success", () => {
    // Un-save on the shelf must un-fill the in-thread bookmark. Deriving state from isSuccess made
    // that impossible — the flag stays true for the life of the mount.
    saveIsSuccess = true;
    storeItem = undefined;
    mount();
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(screen.getByRole("button"));
    expect(saveMutate).toHaveBeenCalledTimes(1);
  });
});
