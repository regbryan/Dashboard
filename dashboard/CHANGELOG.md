# Changelog

All notable changes to the SocialPulse dashboard are recorded here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html) loosely (we cut on each merge to `main`, not on tagged releases).

## [Unreleased]

### Added

- **CI workflow** at `.github/workflows/ci.yml`. Two jobs gated by PR + push to `main`:
  - `audit` — runs `npm run audit` (biome + knip + madge + tsc). No secrets required; works on first push.
  - `test` — installs Chromium, builds, runs the full Playwright suite. Requires repo secrets: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `STRIPE_WEBHOOK_SECRET`. Uploads the Playwright HTML report as an artifact on failure. Concurrency group cancels in-flight runs when a new commit lands on the same PR.
- **Per-request correlation ID** via `x-request-id` header + AsyncLocalStorage. Middleware seeds the ID from `x-vercel-id` (or generates a UUID for local dev), sets it on the rewritten request headers and the response. Routes wrapped in `withRequestContext()` (lib/request-context.ts) propagate the ID through ALS — every `logger.*` call inside auto-tags entries. Wired today on /api/stripe/webhook, /api/approve, /api/onboarding/create, /api/render-reel, /api/socialpilot/callback, /auth/callback. Other routes still work; their logs just omit the field. 6 new tests in `tests/request-context.spec.ts` covering the ALS round-trip + concurrent isolation. See [docs/observability.md](docs/observability.md) for the pattern.
- **Structured server logger** at `lib/logger.ts` replacing 34 ad-hoc `console.*` call sites across API routes, crons, and lib helpers. Production emits single-line JSON to stdout (filterable in Vercel Logs); dev emits pretty key=value. PII scrubbing redacts known credential keys at any depth and masks email-shaped fields. `Error` instances auto-expand to `{name, message, stack}`. Unit-tested in `tests/logger.spec.ts` (8 cases). Closes the last open observability gap in `docs/observability.md`.
- **Sentry error tracking — installed, env-gated.** `@sentry/nextjs ^10.53` wired through `instrumentation.ts`, `instrumentation-client.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`, and `withSentryConfig` in `next.config.ts`. Complete no-op until `NEXT_PUBLIC_SENTRY_DSN` is set in Vercel. New admin-only `GET /api/dev/sentry-smoke` route deliberately throws so the pipeline can be verified end-to-end after the DSN lands. See [docs/observability.md](docs/observability.md) for env-var checklist and alert config.
- **Local-first lint + dep audit pipeline.** `npm run audit` runs biome (correctness/security/suspicious rules), knip (dead exports + unused deps), madge (circular deps), and `tsc --noEmit`. Configured in `biome.json` + `knip.json`. Pipeline exits 0 today; knip surfaces 14 unused exports and ~11 biome warnings as backlog.
- **Interactive app map at `/dev/app-map`.** LiteGraph.js viewer with 12 nodes (User → Vercel → Middleware → Pages/API → Supabase DB/Storage/Stripe/Gemini/SocialPilot/Resend/Remotion). Each node opens a side panel with role/owner/summary/breaks. Auth-gated through the dev layout.
- **Brand-page experience flow** at `docs/flows/brand-page-experience.md` — entry points, branches, error states, empty states, and notifications for the four brand tabs. `/dev/flows` now auto-includes every `.md` in `docs/flows/`.
- **`<EmptyState>` component** + `lib/glass-style.ts` — shared surface used by the four brand tabs' empty states. Replaces four ad-hoc inline style blocks.
- **Playwright `brand-header.spec.ts`** — 9 tests covering title/subtitle swap across tabs, mobile responsive stack, and per-tab axe a11y. Opt-in via `DASHBOARD_TEST_SECRET` env var; skips silently in CI without the secret.
- **Test-only auth bypass** in `proxy.ts` — checks an `X-Dashboard-Test-Auth` header against a per-run secret. Dead code unless `DASHBOARD_TEST_SECRET` is set on the server.

- **Brand page header now shows the active section title + subtitle.** A new client component `BrandSectionTitle` derives the title from the pathname and reads pre-computed subtitles from the brand layout — one batched Supabase round-trip (`Promise.all` over `brands`, `posts`, `brand_logos`) per request instead of four per-tab queries.
- **Liquid-glass surface treatment on StatTiles and BrandCards.** Inline `backdropFilter` paired with `.lg-surface--card` because LightningCSS collapses the standard `backdrop-filter` away when Safari is in browserslist (Chromium 146+ no longer accepts the `-webkit-` prefix on its own).
- **Responsive header layout on brand pages.** Tailwind utilities switch the title/tabs row from stacked column (mobile) to side-by-side (md and up). Replaces the absolute-positioning approach that collided with the tab pill at 375px.
- **Dev docs served as in-app routes** at `/dev/architecture`, `/dev/schema`, `/dev/flows` (commit `c620d99`).
- **Local Remotion video pipeline scaffold** under `dashboard/remotion/` (commit `36b1571`).

### Changed

- **Brand Kit panel:** Visual identity is now the first content section (was second, after Positioning).
- **QuickActions** sits directly under the "Content Overview" heading on `/dashboard`, above the stats row.
- **All four brand tabs** (Designs/Calendar/Brand Kit/Assets) now share the same wrapper padding (`28px 0 48px`) and empty-state treatment (`.lg-surface--card`, `60px 24px`). Horizontal gutter is owned by the layout — pages no longer double-pad.
- **Calendar week-row headers** bumped from `<h3>` to `<h2>` to keep the heading outline contiguous after `BrandSectionTitle` became the page H1.
- **User-facing copy** swept of em dashes (commits `14d9dc1`, `9ddc9a9`).

### Fixed

- **Tech-debt sweep: biome + knip backlog cleared.**
  - Wrapped `refreshSnapshotState` in `useCallback` so FooterOverlayPanel + LogoOverlayPanel pass `useExhaustiveDependencies` without lint-disable.
  - Documented why DocViewer keeps `markdown` in deps + the intentional `dangerouslySetInnerHTML` (admin-only, trusted-source markdown) with biome-ignore comments.
  - Replaced index-based React keys in BrandKitPanel (pillars, audiences, rules) with content-derived stable keys.
  - Replaced `(byDate[p.date] ??= []).push(p)` with an explicit init+push to clear `noAssignInExpressions`.
  - Removed dead `StatusKey` type alias from ClientPostCard.
  - De-exported internal-only `buildClaudeRevisionPrompt`, `TIER_TO_PRICE_ENV`, and `Tier` (never imported from another module). Deleted dead `postImagePath`.
  - Configured knip to ignore types that are self-referenced inside their declaring file (`ignoreExportsUsedInFile: { type: true }`) — these are domain primitives kept for readability, not waste.
- **Vercel build broken since the Remotion scaffold landed.** Externalized `@remotion/*` + `esbuild` via `serverExternalPackages` so Turbopack stops trying to bundle platform-specific binaries (macOS compositor on a Linux build host) and stops parsing `@esbuild/linux-x64/README.md` as a module. Local `npm run build` now succeeds.
- Removed dead `TAB_CARD_BG` export from `BrandTabs.tsx` + matching import in the brand layout (Phase 1 audit finding).
- Liquid-glass `.lg-surface--card` blur now visible — the standard `backdrop-filter` property was being stripped by the Tailwind v4 + LightningCSS pipeline, leaving only `-webkit-backdrop-filter` which Chromium 146+ no longer accepts. Backdrop blur applied inline as a workaround until LightningCSS targeting changes.
- All `app-review` Phase 3 BLOCKERs cleared (axe-core 0 violations across the modified routes, mobile header no longer collides with the tab pill).

### Known issues

- ~~Knip backlog~~ ✅ Cleared. `npm run audit` reports 0 unused exports.
- ~~Biome backlog~~ ✅ Cleared. `npm run audit` reports 0 warnings.
- **Sentry installed but unconfigured.** SDK is wired and no-ops until `NEXT_PUBLIC_SENTRY_DSN` + `SENTRY_AUTH_TOKEN` + `SENTRY_ORG` + `SENTRY_PROJECT` are set in Vercel. Smoke route at `/api/dev/sentry-smoke` is ready to verify the pipeline once envs land.
- **No rollback drill** has been performed against the current Vercel deploy. See [docs/rollback.md](docs/rollback.md) for the documented procedure; the drill is open.

---

## Format guidance

When you ship something, add a bullet under `## [Unreleased]` in the appropriate subsection:

- **Added** — new functionality visible to users or operators
- **Changed** — modifications to existing functionality
- **Deprecated** — soon-to-be-removed functionality
- **Removed** — deletions
- **Fixed** — bug fixes
- **Security** — security-relevant changes
- **Known issues** — bugs you know about but haven't fixed

Keep entries concise — link to the PR or commit for detail. Don't list every commit; list every *user-visible change*.
