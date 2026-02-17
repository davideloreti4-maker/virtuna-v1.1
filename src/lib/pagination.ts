/**
 * Cursor-based pagination utilities (API-12)
 *
 * Cursor format: base64url-encoded `created_at|id`
 */

export interface PaginationParams {
  cursor?: string;
  limit: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  next_cursor: string | null;
  has_more: boolean;
}

export function encodeCursor(createdAt: string, id: string): string {
  return Buffer.from(`${createdAt}|${id}`).toString("base64url");
}

export function decodeCursor(cursor: string): {
  created_at: string;
  id: string;
} | null {
  try {
    const decoded = Buffer.from(cursor, "base64url").toString("utf-8");
    const [created_at, id] = decoded.split("|");
    if (!created_at || !id) return null;
    return { created_at, id };
  } catch {
    return null;
  }
}

export function parsePaginationParams(
  searchParams: URLSearchParams
): PaginationParams {
  const cursor = searchParams.get("cursor") ?? undefined;
  const limit = Math.min(
    Math.max(parseInt(searchParams.get("limit") ?? "12", 10) || 12, 1),
    100
  );
  return { cursor, limit };
}
