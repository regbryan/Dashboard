# Observability

Current state: minimal. This doc exists to flag the gap and capture the install plan for whoever does it next.

## What we have today

- **Server logs:** `console.log` / `console.error` in route handlers and server components. Visible in Vercel → Project → Logs. Not queryable, not aggregated, no alerting.
- **Vercel platform metrics:** Vercel surfaces request latency, error rate, and bandwidth at the project level. Decent for spotting an outage, useless for diagnosing one.
- **Stripe webhook logs:** Stripe dashboard → Developers → Events. Authoritative for payment-flow debugging.
- **Supabase logs:** Supabase dashboard → Logs. Authoritative for DB-level issues; supports SQL filtering.

## What we're missing

No application-level error tracking. A client-side `TypeError` in a React component or an unhandled promise rejection in a server action will:

- Not page anyone.
- Not aggregate across users so you can see "this affected 30 people, not just the one who complained."
- Not capture stack traces, breadcrumbs, or user context.
- Not provide release tagging so you can see "the new error started right after commit X shipped."

This is the single biggest observability gap. Until it's fixed, "is the dashboard healthy?" can only be answered by clicking around.

## Sentry — installed, env-gated

The SDK is wired (`@sentry/nextjs ^10.53`). All Sentry behavior is gated by `NEXT_PUBLIC_SENTRY_DSN` — when unset (current state), the SDK is a complete no-op. No events ship, no source-maps upload, no build slowdown.

**To turn it on, set these env vars in Vercel** (Project → Settings → Environment Variables):

| Var | Where | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SENTRY_DSN` | Production + Preview | Public DSN; toggles the SDK on |
| `SENTRY_AUTH_TOKEN` | Production + Preview (build-time only) | Source-map upload to Sentry |
| `SENTRY_ORG` | Production + Preview | Org slug (e.g. `socialpulse`) |
| `SENTRY_PROJECT` | Production + Preview | Project slug (e.g. `dashboard`) |

Once the DSN is set:

1. **Release tagging is automatic.** `withSentryConfig` reads `VERCEL_GIT_COMMIT_SHA` and tags every event so the Sentry "Releases" tab maps spikes to deploys.
2. **Verify with the smoke route:** sign in as admin and hit `GET /api/dev/sentry-smoke` once. It throws deliberately; the error should land in Sentry within ~60 seconds. Delete the route or leave it as a passive health probe.
3. **Configure alerts** in Sentry → Alerts. Minimum: notify on any new issue in production, notify on error rate > 1% over 5 minutes.

**Files added by the install:**

- `sentry.server.config.ts` — Node runtime SDK init
- `sentry.edge.config.ts` — Edge runtime SDK init (proxy.ts + edge routes)
- `instrumentation.ts` — Next.js entrypoint that loads the configs per runtime + forwards server-component errors via `onRequestError`
- `instrumentation-client.ts` — Browser SDK init + router-transition trace hook
- `app/api/dev/sentry-smoke/route.ts` — Admin-only deliberate-throw for verification
- `next.config.ts` — Wrapped with `withSentryConfig` (source-map upload, tunnel route, release injection)

## Logging hygiene

- ✅ **Structured logger wired** — `lib/logger.ts` exports `logger.{debug,info,warn,error}(scope, msg, context?)`. Production emits single-line JSON to stdout (filterable in Vercel Logs); development emits pretty key=value. Every API route + cron + auth callback in `app/` and `lib/` uses it; `console.*` is banned outside `lib/logger.ts` itself.
- ✅ **PII scrubbing at the source** — the logger redacts known credential keys (`password`, `token`, `secret`, `cookie`, `service_role_key`, etc.) at any nesting depth, masks any field whose name ends in `email` (`alice@example.com` → `a***@example.com`), and expands `Error` instances to `{name, message, stack}` so you don't have to remember to call `.stack` manually. Unit tested in `tests/logger.spec.ts`.
- ✅ **Per-request correlation ID wired.** Every request gets a stable `x-request-id` value (sourced from `x-vercel-id` in production, generated via `crypto.randomUUID()` locally). The middleware sets it on the rewritten request headers (so downstream handlers can read it) and on the response (so clients can quote it when reporting bugs). Handlers wrapped in `withRequestContext()` (lib/request-context.ts) propagate the ID through AsyncLocalStorage; every `logger.*` call auto-tags entries with `requestId`. Wrapped: every route handler under `app/api/**` (40 files) + `app/auth/callback`. No-arg handlers (e.g. `export async function GET()`) use the `withRequestContextFromHeaders()` variant, which reads the ID from `next/headers` instead of a passed-in Request. Pattern for adding correlation to a new route:

  ```ts
  import { withRequestContext } from "@/lib/request-context";

  export async function POST(req: Request) {
    return withRequestContext(req, () => handlePOST(req));
  }

  async function handlePOST(req: Request) {
    // existing handler body — every logger.* call here gets requestId
  }
  ```

## What "good" looks like

When this is done, the answer to "did the deploy break anything?" becomes a Sentry query:

```
release:<git_sha> AND environment:production AND level:error
```

If that returns zero, the deploy is healthy. If it returns hits, you triage them by issue count + affected-user count before deciding whether to roll back per [docs/rollback.md](rollback.md).

## Status

| Task | Owner | Status |
|---|---|---|
| Sentry SDK install (`@sentry/nextjs`) | Branch `claude/angry-nash-94318d` | ✅ Done — env-gated no-op until DSN is set |
| Sentry env vars in Vercel | Reggie | Pending |
| First alert rule configured | Reggie | Pending |
| Smoke test route exists | Branch `claude/angry-nash-94318d` | ✅ `/api/dev/sentry-smoke` |
| Smoke test executed against a real DSN | Reggie | Pending (after env vars are set) |
| Replace `console.*` with structured logger | Branch `claude/angry-nash-94318d` | ✅ Done — `lib/logger.ts`, 34 call sites migrated, PII scrubbing + Error expansion built in, unit-tested |

When all rows flip to "done," delete this Status table and replace this doc with operational runbooks (querying issues, common triage paths, etc.).
