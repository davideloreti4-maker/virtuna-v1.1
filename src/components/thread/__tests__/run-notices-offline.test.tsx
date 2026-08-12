/** @vitest-environment happy-dom */

/**
 * Retry follows the connection.
 *
 * Leaving retry live while offline recreates the futile-retry loop `CreditWallRefusal` exists to
 * prevent — a button that cannot succeed, offered to someone who will keep pressing it. Removing
 * it outright is the other failure: it strands a user whose connection returns a second later.
 * So it stays rendered and goes disabled, and `useOnline` re-enables it on the `online` event
 * without a remount.
 */

import { describe, it, expect, afterEach } from "vitest";
import { render, screen, act, cleanup } from "@testing-library/react";

import { SkillRunError } from "@/components/thread/run-notices";

afterEach(() => {
  cleanup();
  Object.defineProperty(window.navigator, "onLine", { value: true, configurable: true });
});

function setOnLine(value: boolean) {
  Object.defineProperty(window.navigator, "onLine", { value, configurable: true });
}

describe("SkillRunError retry", () => {
  it("is disabled while offline — a retry into a dead connection is the futile loop again", () => {
    setOnLine(false);
    render(<SkillRunError onRetry={() => {}} />);
    expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(true);
  });

  it("is enabled while online", () => {
    setOnLine(true);
    render(<SkillRunError onRetry={() => {}} />);
    expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(false);
  });

  it("re-enables on reconnect without a remount", () => {
    setOnLine(false);
    render(<SkillRunError onRetry={() => {}} />);
    expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(true);

    act(() => {
      setOnLine(true);
      window.dispatchEvent(new Event("online"));
    });

    expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(false);
  });

  it("stays RENDERED while offline — removing it strands a connection that returns", () => {
    setOnLine(false);
    render(<SkillRunError onRetry={() => {}} />);
    expect(screen.queryByRole("button")).toBeTruthy();
  });

  it("still renders no button at all when no retry was given", () => {
    setOnLine(true);
    render(<SkillRunError />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("keeps the alert role regardless of connection", () => {
    setOnLine(false);
    render(<SkillRunError onRetry={() => {}} />);
    expect(screen.getByRole("alert")).toBeTruthy();
  });
});
