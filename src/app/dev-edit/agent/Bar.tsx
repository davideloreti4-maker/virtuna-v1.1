/**
 * Bar.tsx — the thin bar of something under way (Task 13b). With a share it fills to it; without one (how far it is cannot be
 * told) a short stretch runs along it. With reduced motion nothing moves: a share is set at once, and the bar with none
 * stands at rest, dim. Its keyframes are in `agent.tsx`'s own styles.
 */
export function Bar({ share, label, className = "" }: { share: number | null; label: string; className?: string }) {
  const percent = share === null ? undefined : Math.round(Math.min(1, Math.max(0, share)) * 100);
  return (
    <span role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} data-share={share ?? "none"} className={`relative block h-0.5 overflow-hidden rounded-full bg-foreground/15 ${className}`}>
      {percent === undefined ? (
        <span className="absolute inset-y-0 left-0 w-full rounded-full bg-foreground/30 motion-safe:w-1/3 motion-safe:animate-[edit-agent-run_1.4s_ease-in-out_infinite] motion-safe:bg-foreground" />
      ) : (
        <span className="absolute inset-y-0 left-0 rounded-full bg-foreground motion-safe:transition-[width] motion-safe:duration-700" style={{ width: `${percent}%` }} />
      )}
    </span>
  );
}
