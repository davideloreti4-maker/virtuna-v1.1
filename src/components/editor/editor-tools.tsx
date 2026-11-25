"use client";

import { Chip } from "@/components/ui/chip";
import { IconButton } from "@/components/ui/icon-button";
import { CaptionsIcon, ExpandIcon, EyeIcon, LookIcon } from "./editor-icons";

/**
 * editor-tools.tsx — the row of tools under the video (spec 2026-11-24-editor-screens-design.md §3 screens 3 and 6, E16, E17; plan
 * 2026-11-25-editor-screens-b, Tasks 5 and 6; drawing `.tools`): Look and Captions, which open their sheets; Original, a toggle
 * (E16: not a press-and-hold, so a keyboard and a screen reader have it too) that shows the take as it was shot; and at the row's
 * right end the video full screen as it will be posted (E17). Original and the preview can be used while the file is made, when
 * Look and Captions rest: watching is allowed then (E20).
 *
 * Four controls on one line from 320 px wide up, never wrapping, scrolling or overflowing (ruling S8): Look and Captions keep
 * icon and word; Original shows its word from 390 px wide and its icon alone in a 36 circle below that, its name kept for a
 * screen reader and 44 to tap; the preview is an icon alone at every width.
 */

export interface ToolsProps {
  /** Look and Captions rest. */
  disabled: boolean;
  /** Original and the preview are usable: a cut is shown and no call is out, the file being made or not. */
  watching: boolean;
  /** The take as it was shot is on the stage. */
  original: boolean;
  onLook(): void;
  onCaptions(): void;
  onOriginal(): void;
  onPreview(): void;
  /** The preview's button, which the focus comes back to when the preview closes. */
  previewRef?: React.Ref<HTMLButtonElement>;
}

export function EditorTools({ disabled, watching, original, onLook, onCaptions, onOriginal, onPreview, previewRef }: ToolsProps) {
  return (
    <div data-part="tools" className="mb-3 flex shrink-0 items-center gap-2">
      <Chip disabled={disabled} aria-haspopup="dialog" onClick={onLook} className="[&_svg]:size-4">
        <LookIcon aria-hidden />
        Look
      </Chip>
      <Chip disabled={disabled} aria-haspopup="dialog" onClick={onCaptions} className="[&_svg]:size-4">
        <CaptionsIcon aria-hidden />
        Captions
      </Chip>
      <Chip selected={original} disabled={!watching} onClick={onOriginal} className="w-9 px-0 [&_svg]:size-4 min-[390px]:w-auto min-[390px]:px-3.5">
        <EyeIcon aria-hidden />
        <span className="sr-only min-[390px]:not-sr-only">Original</span>
      </Chip>
      <IconButton ref={previewRef} aria-label="Preview as posted" aria-haspopup="dialog" disabled={!watching} onClick={onPreview} className="ml-auto size-9 [&_svg]:size-4">
        <ExpandIcon aria-hidden />
      </IconButton>
    </div>
  );
}
