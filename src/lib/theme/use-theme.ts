"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import {
  THEME_EVENT,
  applyThemeChoice,
  paintTheme,
  readThemeChoice,
  type ThemeChoice,
} from "./theme";

function subscribe(onChange: () => void): () => void {
  window.addEventListener(THEME_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(THEME_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

const serverChoice = (): ThemeChoice => "light";

/** The stored choice and a setter that stores and paints it. For the Appearance setting. */
export function useThemeChoice(): [ThemeChoice, (choice: ThemeChoice) => void] {
  const choice = useSyncExternalStore(subscribe, readThemeChoice, serverChoice);
  const set = useCallback((next: ThemeChoice) => {
    applyThemeChoice(next);
  }, []);
  return [choice, set];
}

/**
 * Keeps <html data-theme> right while the app is open: when the OS switches (choice "system")
 * and when another tab changes the choice. Mounted once, by the app shell.
 */
export function useThemeSync(): void {
  useEffect(() => {
    const repaint = () => {
      paintTheme(readThemeChoice());
    };
    const mq =
      typeof window.matchMedia === "function"
        ? window.matchMedia("(prefers-color-scheme: dark)")
        : null;
    mq?.addEventListener("change", repaint);
    window.addEventListener("storage", repaint);
    return () => {
      mq?.removeEventListener("change", repaint);
      window.removeEventListener("storage", repaint);
    };
  }, []);
}
