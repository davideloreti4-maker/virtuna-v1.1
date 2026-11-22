/**
 * While a run is live (spec §4.8): one row under the "Maven" label, three soft dots and the run's
 * name ("Writing hooks", "Finding ideas", …; "Thinking" before the run is named). No stage list,
 * no "Simulating your audience" (generation does not simulate), no live preamble.
 *
 * Not drawn on the answer sheet; built from its parts: the answer's text line (15 / 21, the
 * secondary ink) with three 5 px dots in the muted ink that pulse one after another. With reduced
 * motion the dots stand still. The row is a polite live region, so its name is read once when it
 * changes; the dots are hidden from screen readers.
 */
export function WaitingRow({ label }: { label: string }) {
  return (
    <div role="status" aria-live="polite" className="flex h-[21px] items-center gap-2.5 text-ui text-foreground-secondary">
      <span aria-hidden="true" className="flex items-center gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            data-part="dot"
            className="size-[5px] rounded-full bg-foreground-muted motion-safe:animate-pulse"
            style={{ animationDelay: `${i * 160}ms` }}
          />
        ))}
      </span>
      <span>{label}</span>
    </div>
  );
}
