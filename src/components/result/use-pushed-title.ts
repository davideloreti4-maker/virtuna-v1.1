"use client";

import { useEffect } from "react";
import { useShellStore } from "@/stores/shell-store";

/** Names the screen in the phone's pushed header (NextShell) and clears the name on the way out. */
export function usePushedTitle(title: string) {
  const setPushedTitle = useShellStore((s) => s.setPushedTitle);
  useEffect(() => setPushedTitle(title), [title, setPushedTitle]);
  useEffect(() => () => setPushedTitle(""), [setPushedTitle]);
}
