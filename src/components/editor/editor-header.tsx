"use client";

import { useRouter } from "next/navigation";
import { BackIcon } from "@/components/shell/icons";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { cn } from "@/lib/utils";
import { RedoIcon, UndoIcon } from "./editor-icons";

/**
 * editor-header.tsx — the editor's header (spec E1, E19; plan 2026-11-24-editor-screens-a, Task 15; drawing `.hd`, `.dtop`). On a
 * phone it sits in the shell's band (the shell draws none on `/edit/`): Back, Undo, Redo, and Export at the right, no title (the
 * title is the page's `<h1>`, read by assistive tech only). From md up it is a row of the page: Back, the title, then Undo,
 * Redo, Export. One tree, placed by `order`, so the focus order is Back, Undo, Redo, Export at every width. Back returns to where
 * the editor was opened from (Home, a chat), or Home when it was opened directly.
 *
 * Export is the screen's one primary; off, it is the tint the drawing gives it, not the ink at less. An edit that cannot be
 * shown (`bare`: not there, closed to the account, not read) has only the way back. Until the edit's title is read the page is
 * named "Edit" to assistive tech and shows no title, so none flashes before the edit's own.
 */
export interface HeaderProps {
  title: string;
  /** Only Back: there is no edit to undo in or to export. */
  bare?: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onUndo(): void;
  onRedo(): void;
  exportLabel: "Export" | "Exporting";
  exportOn: boolean;
  onExport(): void;
  /** Out of reach while the video is shown as it will be posted, over the page. */
  inert?: boolean;
}

/** Undo and Redo with nowhere to go, as drawn (`.ic.off`): the white circle stays and its arrow goes faint, where the part alone would fade the whole button. */
const RESTING = "disabled:text-foreground-muted disabled:opacity-100 disabled:shadow-[var(--shadow-control)] disabled:[&_svg]:opacity-60";

/** -0.014em, inline: as an <h1> the app-wide `h1 { letter-spacing: -0.02em }` (unlayered) would beat a tracking utility. */
const TITLE_TRACKING: React.CSSProperties = { letterSpacing: "-0.014em" };

export function EditorHeader({ title, bare = false, canUndo, canRedo, onUndo, onRedo, exportLabel, exportOn, onExport, inert = false }: HeaderProps) {
  const router = useRouter();
  const back = () => (window.history.length > 1 ? router.back() : router.push("/home"));
  return (
    <header
      data-part="editor-header" inert={inert}
      className="fixed inset-x-0 top-0 z-[var(--z-sidebar)] flex h-[calc(env(safe-area-inset-top)+var(--mobile-nav-band,46px))] shrink-0 items-center gap-2 bg-background px-4 pt-[env(safe-area-inset-top)] md:static md:z-auto md:h-[68px] md:bg-transparent md:pl-3 md:pr-7 md:pt-0"
    >
      <IconButton aria-label="Back" onClick={back}>
        <BackIcon aria-hidden />
      </IconButton>
      <h1 style={TITLE_TRACKING} className={cn("sr-only order-1 min-w-0 truncate text-title font-[640] text-foreground", title !== "" && "md:not-sr-only md:ml-1")}>
        {title === "" ? "Edit" : title}
      </h1>
      {!bare && (
        <>
          <div className="order-1 flex items-center gap-2 md:order-3">
            <IconButton aria-label="Undo" disabled={!canUndo} onClick={onUndo} className={RESTING}>
              <UndoIcon aria-hidden />
            </IconButton>
            <IconButton aria-label="Redo" disabled={!canRedo} onClick={onRedo} className={RESTING}>
              <RedoIcon aria-hidden />
            </IconButton>
          </div>
          <span aria-hidden className="order-2 flex-1" />
          <Button
            variant="primary" size="sm" disabled={!exportOn} onClick={onExport}
            className={cn(
              "tap-44 order-4 h-10 shrink-0 rounded-full px-[18px] text-ui next:rounded-full",
              "disabled:bg-surface-sunken disabled:text-foreground-muted disabled:opacity-100 disabled:shadow-none next:disabled:opacity-100 next:disabled:shadow-none",
            )}
          >
            {exportLabel}
          </Button>
        </>
      )}
    </header>
  );
}
