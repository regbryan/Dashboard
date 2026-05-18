/**
 * Per-request correlation ID, available anywhere inside a handler
 * that opts in via `withRequestContext()`.
 *
 * Why this exists: a single user click can spider out into a Supabase
 * read, a Stripe call, a Gemini generation, and an email send — each
 * emitting log lines. Without a shared ID, the only thing tying those
 * lines together is the timestamp, which is unreliable at any scale.
 *
 * How it's wired:
 *
 *   middleware (proxy.ts)
 *     ├─ reads x-vercel-id (Vercel auto-sets it per request)
 *     ├─ falls back to crypto.randomUUID() for local dev
 *     ├─ sets x-request-id on the rewritten request headers (so route
 *     │  handlers can read it)
 *     └─ sets x-request-id on the response (so clients can echo it
 *        back when reporting bugs)
 *
 *   route handler
 *     export async function POST(req) {
 *       return withRequestContext(req, async () => {
 *         // handler body — every logger.* call here auto-tags the ID
 *       });
 *     }
 *
 *   logger.{info,warn,error}
 *     calls getRequestId() before emitting; tags the entry when set
 *
 * Edge runtime (middleware) doesn't support AsyncLocalStorage. That's
 * fine — middleware only TAGS the request header, it doesn't read
 * the ALS store. ALS lives in the Node runtime where route handlers
 * run.
 *
 * Routes that don't wrap themselves still work; the logger just
 * omits the requestId field for those lines.
 */

import { AsyncLocalStorage } from "node:async_hooks";

interface RequestContext {
  requestId: string;
}

const store = new AsyncLocalStorage<RequestContext>();

/**
 * Read the current request's correlation ID. Returns undefined when
 * called outside a `withRequestContext()` block.
 */
export function getRequestId(): string | undefined {
  return store.getStore()?.requestId;
}

/**
 * Wrap a handler body so every nested `logger.*` call picks up the
 * request's correlation ID automatically.
 *
 * Looks up the ID in this priority order:
 *   1. `x-request-id` header (set by our middleware, possibly seeded
 *      from x-vercel-id upstream)
 *   2. `x-vercel-id` directly (if middleware didn't run, e.g. for a
 *      route the matcher excludes)
 *   3. `crypto.randomUUID()` as a last resort so every request still
 *      gets a unique ID, just one we generated locally
 */
export async function withRequestContext<T>(
  request: Request,
  fn: () => Promise<T> | T
): Promise<T> {
  const requestId =
    request.headers.get("x-request-id") ??
    request.headers.get("x-vercel-id") ??
    crypto.randomUUID();
  return store.run({ requestId }, async () => fn());
}
