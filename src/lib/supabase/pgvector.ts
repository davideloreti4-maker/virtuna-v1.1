/**
 * Serializes a pgvector embedding for storage in Supabase.
 *
 * Supabase pgvector columns expect the vector as a JSON array string
 * (e.g. "[0.1,0.2,...]"). Centralises the cast so callers don't inline
 * JSON.stringify with null guards.
 *
 * Closes VERIF-04 sub-item IN-02 (per .planning/phases/18-.../18-CONTEXT.md D-08).
 */
export function serializeVector(v: number[] | null | undefined): string | null {
  return v ? JSON.stringify(v) : null;
}
