import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/types/database.types";

/**
 * Creates a Supabase client using the service role key.
 * Bypasses RLS — use ONLY in server-side routes (cron, webhooks, admin).
 * NEVER import this in client components or browser-side code.
 */
export function createServiceClient() {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll: () => [],
        setAll: () => {},
      },
    }
  );
}
