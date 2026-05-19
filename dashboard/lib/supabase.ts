import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Lazy anon Supabase client.
 *
 * Why lazy: every route/server-component that uses `supabase` imports
 * this module at module-load time. If the client were instantiated
 * eagerly with `process.env.X!`, `next build` would throw during
 * "Collecting page data" whenever the env vars are missing — which is
 * the default state in CI before secrets are configured, and the
 * default state of any fresh clone.
 *
 * The Proxy below preserves the export-name + call ergonomics
 * (`supabase.from(...)`) so callers don't change, while deferring the
 * real `createClient` call until the first property access. That
 * access only ever happens at request time, by which point the env
 * vars are set in production. Builds with missing envs now succeed.
 *
 * If the envs are still missing at request time, the throw surfaces
 * there with a clear message — same observable behavior as before
 * for prod, but no more build-time landmine.
 */

let _client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (_client) return _client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase anon client requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }
  _client = createClient(url, key);
  return _client;
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    return Reflect.get(getClient(), prop, receiver);
  },
});
