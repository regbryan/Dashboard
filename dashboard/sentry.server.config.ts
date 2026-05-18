/**
 * Sentry config for the Node.js runtime — server components, API
 * route handlers, server actions, instrumentation. Initialized once
 * per process from instrumentation.ts:register().
 *
 * No-op when NEXT_PUBLIC_SENTRY_DSN is unset (dev / unconfigured
 * previews). Once the env is set in Vercel, every uncaught error
 * on the server side ships to Sentry tagged with the release SHA.
 */
import * as Sentry from "@sentry/nextjs";

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    // Tag every event with the Vercel commit SHA so the Sentry UI's
    // "Releases" tab can correlate a spike to a deploy.
    release: process.env.VERCEL_GIT_COMMIT_SHA,
    environment: process.env.VERCEL_ENV ?? "development",
    // Sample everything at 100% until volume grows. Drop to 0.1 when
    // we have >100 events/day.
    tracesSampleRate: 1.0,
    // Cuts the bundle size — turn back on if we need stack-local
    // variable values for hard-to-debug server crashes.
    includeLocalVariables: false,
  });
}
