/** @vitest-environment happy-dom */
/**
 * `/login?deleted=1` (spec 2026-11-26-settings, 2.4): after an account is deleted, one line above the
 * form reads "Your account was deleted."; without the param the page is as before. The page and its form
 * are the real code; only the router (a Next.js boundary) is stood in.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn(), push: vi.fn() }),
  redirect: vi.fn(),
}));

import LoginPage from "../page";

async function renderPage(params: Record<string, string>) {
  render(await LoginPage({ searchParams: Promise.resolve(params) }));
}

afterEach(cleanup);

describe("/login after a delete", () => {
  it("?deleted=1: one status line, in ink, above the form", async () => {
    await renderPage({ deleted: "1" });
    const line = screen.getByRole("status");
    expect(line.textContent).toBe("Your account was deleted.");
    expect(line.className).toContain("text-foreground");
    const heading = screen.getByRole("heading", { name: "Welcome back" });
    // The line comes before the form's card in the document.
    expect(line.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("without the param: no line", async () => {
    await renderPage({});
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByText("Your account was deleted.")).toBeNull();
    expect(screen.getByRole("heading", { name: "Welcome back" })).toBeTruthy();
  });

  it("any other value: no line", async () => {
    await renderPage({ deleted: "true" });
    expect(screen.queryByText("Your account was deleted.")).toBeNull();
  });
});
