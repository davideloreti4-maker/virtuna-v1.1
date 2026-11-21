/**
 * Place header (new look, spec §6.1): the screen title on the left, up to two trailing controls
 * on the right. Used by the four places. On desktop the title sits 44px from the top.
 */
export function PlaceHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <header className="flex items-end justify-between gap-3 pb-4 pt-2 md:pt-11">
      <h1 className="text-3xl font-bold leading-[35px] tracking-[-0.035em] text-foreground">{title}</h1>
      {children ? <div className="flex shrink-0 items-center gap-2">{children}</div> : null}
    </header>
  );
}
