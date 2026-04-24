import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cached: SupabaseClient<any, any, any> | null = null;

/**
 * Server-only Supabase client using the service role key.
 * NEVER import from client components. Used for privileged ops
 * (script_runs inserts) where the anon key is correctly RLS-blocked.
 */
export function supabaseAdmin() {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "supabaseAdmin requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
    );
  }
  if (!cached) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cached = createClient<any, any, any>(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cached;
}
