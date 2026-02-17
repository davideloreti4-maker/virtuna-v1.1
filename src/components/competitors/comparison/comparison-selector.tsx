"use client";

interface ComparisonSelectorProps {
  competitors: {
    handle: string;
    displayName: string | null;
    avatarUrl: string | null;
  }[];
  value: string | undefined;
  onChange: (handle: string) => void;
  label: string;
  showSelfOption: boolean;
  selfHandle: string | null;
}

/**
 * Dropdown selector for picking a competitor or "Compare with me".
 *
 * Styled with Raycast input conventions: dark bg, subtle border, 42px height.
 */
export function ComparisonSelector({
  competitors,
  value,
  onChange,
  label,
  showSelfOption,
  selfHandle,
}: ComparisonSelectorProps) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs text-foreground-muted">{label}</label>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-white/[0.05] border border-white/[0.05] rounded-lg h-[42px] px-3 text-sm text-foreground appearance-none cursor-pointer focus:outline-none focus:border-white/[0.1]"
      >
        <option value="">Select competitor...</option>
        {showSelfOption && selfHandle && (
          <option value="me">You (@{selfHandle})</option>
        )}
        {competitors.map((c) => (
          <option key={c.handle} value={c.handle}>
            @{c.handle}
            {c.displayName ? ` (${c.displayName})` : ""}
          </option>
        ))}
      </select>
    </div>
  );
}
