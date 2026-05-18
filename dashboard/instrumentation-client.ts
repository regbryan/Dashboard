/**
 * Sentry config for the browser. Next.js auto-imports this file as
 * the client-side counterpart to instrumentation.ts on the server.
 *
 * No-op when NEXT_PUBLIC_SENTRY_DSN is unset. Browser-side errors
 * (React render crashes, unhandled promise rejections in client
 * components, etc.) ship to the same Sentry project with the same
 * release tag as the server.
 */
import * as Sentry from "@sentry/nextjs";

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? "development",
    // Browser traces: 10% by default — full sampling on the client
    // can pile up costs once the user base grows. Easy to bump.
    tracesSampleRate: 0.1,
    // Replay session on errors only. Privacy-safe defaults (mask all
    // text and media); enable selectively per-route if useful later.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
  });
}

// Required by Next.js to forward router transitions to Sentry's
// performance traces. No-op when Sentry is unconfigured.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
