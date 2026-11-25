/** @vitest-environment happy-dom */
import { beforeEach, describe, expect, it } from "vitest";
import { useShellStore } from "@/stores/shell-store";

// The phone's drawer state lives in the shell store, in memory only: a reload starts closed.
beforeEach(() => {
  localStorage.clear();
  useShellStore.setState({ drawerOpen: false, accountFace: null });
});

describe("shell store: the phone's drawer", () => {
  it("starts closed, and openDrawer and closeDrawer set drawerOpen", () => {
    expect(useShellStore.getState().drawerOpen).toBe(false);
    useShellStore.getState().openDrawer();
    expect(useShellStore.getState().drawerOpen).toBe(true);
    useShellStore.getState().closeDrawer();
    expect(useShellStore.getState().drawerOpen).toBe(false);
  });

  it("is not stored: no persist API, and nothing in localStorage after opening", () => {
    expect("persist" in useShellStore).toBe(false);
    useShellStore.getState().openDrawer();
    useShellStore.getState().setAccountFace({ picture: null, initials: "NL" });
    expect(localStorage.length).toBe(0);
  });

  it("setThreadTitleHint writes the hint only: Back's marker and Library's scroll stay as they were", () => {
    useShellStore.getState().setThreadBack("/library", {
      title: { id: "t1", title: "Video simulation" },
      scroll: { href: "/library", top: 320 },
    });
    useShellStore.getState().setThreadTitleHint({ id: "t1", title: "meal prep for busy students" });
    const s = useShellStore.getState();
    expect(s.threadTitleHint).toEqual({ id: "t1", title: "meal prep for busy students" });
    expect(s.threadBack).toBe("/library");
    expect(s.libraryScroll).toEqual({ href: "/library", top: 320 });
    useShellStore.getState().setThreadTitleHint(null);
    expect(useShellStore.getState().threadTitleHint).toBeNull();
    expect(useShellStore.getState().threadBack).toBe("/library");
    expect(useShellStore.getState().libraryScroll).toEqual({ href: "/library", top: 320 });
    useShellStore.getState().setThreadBack(null);
  });

  it("accountFace starts null and holds what is set", () => {
    expect(useShellStore.getState().accountFace).toBeNull();
    useShellStore.getState().setAccountFace({ picture: "/avatars/nia.png", initials: "NL" });
    expect(useShellStore.getState().accountFace).toEqual({ picture: "/avatars/nia.png", initials: "NL" });
    useShellStore.getState().setAccountFace(null);
    expect(useShellStore.getState().accountFace).toBeNull();
  });
});
