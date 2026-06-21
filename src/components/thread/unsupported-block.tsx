'use client';

/**
 * UnsupportedBlock — static placeholder for unknown or invalid block types.
 *
 * NEVER reads block.props as executable content (THREAD-04 / D-14).
 * Receives NO props — intentionally stateless so model-supplied prop values
 * cannot influence the rendered output.
 */
export function UnsupportedBlock() {
  return (
    <div
      role="note"
      aria-label="Unsupported content block"
      className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm text-muted"
    >
      Unsupported content
    </div>
  );
}
