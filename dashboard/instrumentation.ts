/**
 * Next.js instrumentation hook — runs once per server process at
 * startup, before any route handlers fire. We use it to register
 * Sentry on both the Node runtime and the Edge runtime.
 *
 * Sentry stays a no-op when NEXT_PUBLIC_SENTRY_DSN is unset, so
 * local dev and preview deploys without DSN configured won't ship
 * events. Set the env in Vercel production + preview to turn it on.
 *
 * See: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

/**
 * `onRequestError` is Next.js's hook for capturing server-component +
 * server-action errors that don't pass through a route handler.
 * Forward them to Sentry so they show up in the same project.
 */
export async function onRequestError(
  error: unknown,
  request: { path: string; method: string; headers: { [key: string]: string } },
  context: {
    routerKind: "Pages Router" | "App Router";
    routePath: string;
    routeType: "render" | "route" | "action" | "middleware";
  }
) {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;
  const Sentry = await import("@sentry/nextjs");
  Sentry.captureRequestError(error, request, context);
}
