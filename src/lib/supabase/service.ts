import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

/**
 * Creates a Supabase client with the service role key.
 * Bypasses RLS — use ONLY in server-side contexts:
 * webhook handlers, cron routes, background jobs.
 *
 * NEVER import this in client components or expose the key.
 */
export function createServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
