"use client";

import { Avatar } from "@/components/ui/avatar";
import { IconButton } from "@/components/ui/icon-button";
import { useShellStore, type AccountFace } from "@/stores/shell-store";
import { DRAWER_WORDS } from "./drawer-words";
import { MenuIcon } from "./icons";

export interface MenuButtonProps {
  /** "picture" on the four places (the creator's face); "lines" in a chat's band, in Back's place. */
  variant: "picture" | "lines";
  /** "picture" only: drawn as given instead of the shell's face (dev previews and screen tests, which have no shell). */
  face?: AccountFace;
}

/**
 * What opens the phone's drawer. A plain button, not a dialog trigger: the drawer is mounted once by
 * the shell and opened through the shell store, so an opener can sit on any screen. It reads the
 * store only (the face the drawer publishes), so it needs no provider and sends no request. The
 * `data-drawer-opener` mark is where the drawer gives the focus back when it closes with nothing
 * chosen. Phone only: from 768 the sidebar is there.
 */
export function MenuButton({ variant, face }: MenuButtonProps): React.JSX.Element {
  const open = useShellStore((s) => s.drawerOpen);
  const openDrawer = useShellStore((s) => s.openDrawer);
  const accountFace = useShellStore((s) => s.accountFace);
  const opener = {
    "data-drawer-opener": "",
    "aria-haspopup": "dialog",
    "aria-expanded": open,
    onClick: openDrawer,
  } as const;

  if (variant === "lines") {
    return (
      <IconButton aria-label={DRAWER_WORDS.openMenu} className="md:hidden" {...opener}>
        <MenuIcon aria-hidden />
      </IconButton>
    );
  }

  const shown = face ?? accountFace;
  return (
    // A flex box: the button is the circle's 36 whatever the circle holds (initials, a picture or
    // nothing yet), with no line box under it.
    <button type="button" aria-label={DRAWER_WORDS.openMenu} className="tap-44 flex shrink-0 rounded-full md:hidden" {...opener}>
      <Avatar src={shown?.picture ?? undefined} alt="" fallback={shown?.initials ?? ""} size="sm" className="h-9 w-9" />
    </button>
  );
}
