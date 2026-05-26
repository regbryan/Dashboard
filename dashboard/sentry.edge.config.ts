/**
 * Sentry config for the Edge runtime — proxy.ts middleware, any
 * route handlers with `export const runtime = "edge"`. Initialized
 * once per process from instrumentation.ts:register().
 *
 * Slimmer than the Node config: Edge runtime can't load all Sentry
 * integrations (no Node fs, no AsyncLocalStorage prior to recent
 * versions). The SDK auto-picks the supported subset.
 */
import * as Sentry from "@sentry/nextjs";

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    release: process.env.VERCEL_GIT_COMMIT_SHA,
    environment: process.env.VERCEL_ENV ?? "development",
    tracesSampleRate: 1.0,
  });
}
