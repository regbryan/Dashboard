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

## Install plan: Sentry

Sentry is the path of least resistance for a Next.js app — first-party SDK, free tier covers a single-tenant dashboard like this, ~10 minutes to wire up.

```bash
cd dashboard
npx @sentry/wizard@latest -i nextjs
# wizard creates sentry.client.config.ts, sentry.server.config.ts, sentry.edge.config.ts
# and adds @sentry/nextjs to package.json, plus middleware integration
```

After the wizard:

1. **Add env vars** to Vercel (Project → Settings → Environment Variables):
   - `NEXT_PUBLIC_SENTRY_DSN` — public DSN from your Sentry project
   - `SENTRY_AUTH_TOKEN` — for source-map upload during build
   - `SENTRY_ORG`, `SENTRY_PROJECT` — for source-map upload
2. **Set release tagging** — Sentry's webpack plugin auto-tags releases with `VERCEL_GIT_COMMIT_SHA`. Verify the first deploy after install shows up under that commit in the Sentry "Releases" tab.
3. **Add a smoke test** — push a commit that includes `throw new Error("sentry smoke test")` in a low-traffic route, deploy, verify it shows up in Sentry within 60 seconds, then revert.
4. **Configure alerts** in Sentry → Alerts. Minimum: notify on any new issue in production, notify on error rate > 1% over 5 minutes.

## Logging hygiene (before adding Sentry)

A few things to clean up so Sentry breadcrumbs are useful:

- Replace ad-hoc `console.log` in API routes with a thin structured logger (one function, accepts `{event, ...context}`) so every log line is filterable.
- Strip PII from logs at the source — never log full user email, full session tokens, or Supabase user IDs in plaintext.
- Tag every request with a request-id (Vercel provides `x-vercel-id`) so a single user complaint maps to a single trace.

## What "good" looks like

When this is done, the answer to "did the deploy break anything?" becomes a Sentry query:

```
release:<git_sha> AND environment:production AND level:error
```

If that returns zero, the deploy is healthy. If it returns hits, you triage them by issue count + affected-user count before deciding whether to roll back per [docs/rollback.md](rollback.md).

## Status

| Task | Owner | Status |
|---|---|---|
| Sentry SDK install (`@sentry/nextjs`) | _(open)_ | Not started |
| Sentry env vars in Vercel | _(open)_ | Not started |
| First alert rule configured | _(open)_ | Not started |
| Smoke test (deliberate error → verify in Sentry) | _(open)_ | Not started |
| Replace `console.*` with structured logger | _(open)_ | Not started |

When all five rows flip to "done," delete this Status table and replace this doc with operational runbooks (querying issues, common triage paths, etc.).
