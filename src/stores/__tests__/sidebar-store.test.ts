/** @vitest-environment happy-dom */
import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Phase 2.5 — sidebar-store tests
 *
 * Covers:
 * - Initial state (isOpen: true, isCollapsed: false)
 * - toggle / open / close
 * - toggleCollapsed / setCollapsed (new in plan 2.5)
 * - State independence (collapsed does not affect open)
 */

// Zustand persist middleware writes to localStorage. Mock it so we don't
// depend on happy-dom's Storage implementation.
const mockStorage: Record<string, string> = {};
vi.stubGlobal("localStorage", {
  getItem: (key: string) => mockStorage[key] ?? null,
  setItem: (key: string, value: string) => { mockStorage[key] = value; },
  removeItem: (key: string) => { delete mockStorage[key]; },
  clear: () => { Object.keys(mockStorage).forEach((k) => delete mockStorage[k]); },
  get length() { return Object.keys(mockStorage).length; },
  key: (index: number) => Object.keys(mockStorage)[index] ?? null,
});

beforeEach(() => {
  // Clear persisted state and re-import fresh module each test
  Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
  vi.resetModules();
});

describe("sidebar-store — open/close", () => {
  it("initial state: isOpen=true, isCollapsed=false", async () => {
    const { useSidebarStore } = await import("@/stores/sidebar-store");
    const state = useSidebarStore.getState();
    expect(state.isOpen).toBe(true);
    expect(state.isCollapsed).toBe(false);
  });

  it("toggle() flips isOpen", async () => {
    const { useSidebarStore } = await import("@/stores/sidebar-store");
    useSidebarStore.getState().toggle();
    expect(useSidebarStore.getState().isOpen).toBe(false);
    useSidebarStore.getState().toggle();
    expect(useSidebarStore.getState().isOpen).toBe(true);
  });

  it("open() sets isOpen=true", async () => {
    const { useSidebarStore } = await import("@/stores/sidebar-store");
    useSidebarStore.getState().close();
    useSidebarStore.getState().open();
    expect(useSidebarStore.getState().isOpen).toBe(true);
  });

  it("close() sets isOpen=false", async () => {
    const { useSidebarStore } = await import("@/stores/sidebar-store");
    useSidebarStore.getState().close();
    expect(useSidebarStore.getState().isOpen).toBe(false);
  });
});

describe("sidebar-store — collapsed mode (D-12)", () => {
  it("toggleCollapsed() flips isCollapsed", async () => {
    const { useSidebarStore } = await import("@/stores/sidebar-store");
    useSidebarStore.getState().toggleCollapsed();
    expect(useSidebarStore.getState().isCollapsed).toBe(true);
    useSidebarStore.getState().toggleCollapsed();
    expect(useSidebarStore.getState().isCollapsed).toBe(false);
  });

  it("setCollapsed(true) forces collapsed", async () => {
    const { useSidebarStore } = await import("@/stores/sidebar-store");
    useSidebarStore.getState().setCollapsed(true);
    expect(useSidebarStore.getState().isCollapsed).toBe(true);
  });

  it("setCollapsed(false) forces expanded", async () => {
    const { useSidebarStore } = await import("@/stores/sidebar-store");
    useSidebarStore.getState().setCollapsed(true);
    useSidebarStore.getState().setCollapsed(false);
    expect(useSidebarStore.getState().isCollapsed).toBe(false);
  });

  it("toggling collapsed does not change isOpen", async () => {
    const { useSidebarStore } = await import("@/stores/sidebar-store");
    const initialOpen = useSidebarStore.getState().isOpen;
    useSidebarStore.getState().toggleCollapsed();
    expect(useSidebarStore.getState().isOpen).toBe(initialOpen);
  });

  it("toggling open does not change isCollapsed", async () => {
    const { useSidebarStore } = await import("@/stores/sidebar-store");
    useSidebarStore.getState().setCollapsed(true);
    useSidebarStore.getState().toggle();
    expect(useSidebarStore.getState().isCollapsed).toBe(true);
  });
});

describe("sidebar-store — action contract", () => {
  it("exports all required actions", async () => {
    const { useSidebarStore } = await import("@/stores/sidebar-store");
    const state = useSidebarStore.getState();
    expect(typeof state.toggle).toBe("function");
    expect(typeof state.open).toBe("function");
    expect(typeof state.close).toBe("function");
    expect(typeof state.toggleCollapsed).toBe("function");
    expect(typeof state.setCollapsed).toBe("function");
  });
});
