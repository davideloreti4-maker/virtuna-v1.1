"use client";

import dynamic from "next/dynamic";

const ClickToComponent = dynamic(
  () => import("click-to-react-component").then((m) => m.ClickToComponent),
  { ssr: false }
);

export function DevClickToComponent() {
  if (process.env.NODE_ENV !== "development") return null;
  return <ClickToComponent editor="vscode" />;
}
