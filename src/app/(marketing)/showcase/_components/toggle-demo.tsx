"use client";

import * as React from "react";
import { Toggle } from "@/components/ui";

/** Interactive toggle demos requiring client-side state. */
export function ToggleSizeDemo() {
  const [smChecked, setSmChecked] = React.useState(false);
  const [mdChecked, setMdChecked] = React.useState(true);
  const [lgChecked, setLgChecked] = React.useState(false);

  return (
    <div className="flex items-center gap-8">
      <div className="flex flex-col items-center gap-2">
        <Toggle
          size="sm"
          checked={smChecked}
          onCheckedChange={setSmChecked}
          aria-label="Small toggle"
        />
        <span className="text-xs text-foreground-muted">sm</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <Toggle
          size="md"
          checked={mdChecked}
          onCheckedChange={setMdChecked}
          aria-label="Medium toggle"
        />
        <span className="text-xs text-foreground-muted">md</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <Toggle
          size="lg"
          checked={lgChecked}
          onCheckedChange={setLgChecked}
          aria-label="Large toggle"
        />
        <span className="text-xs text-foreground-muted">lg</span>
      </div>
    </div>
  );
}

export function ToggleDisabledDemo() {
  return (
    <div className="flex items-center gap-8">
      <div className="flex flex-col items-center gap-2">
        <Toggle checked disabled aria-label="Checked disabled" />
        <span className="text-xs text-foreground-muted">Checked</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <Toggle disabled aria-label="Unchecked disabled" />
        <span className="text-xs text-foreground-muted">Unchecked</span>
      </div>
    </div>
  );
}

export function ToggleLabelDemo() {
  const [notifications, setNotifications] = React.useState(true);
  const [darkMode, setDarkMode] = React.useState(false);

  return (
    <div className="flex flex-col gap-4">
      <Toggle
        label="Enable notifications"
        checked={notifications}
        onCheckedChange={setNotifications}
      />
      <Toggle
        label="Dark mode"
        checked={darkMode}
        onCheckedChange={setDarkMode}
      />
      <Toggle label="Locked setting" checked disabled />
    </div>
  );
}
