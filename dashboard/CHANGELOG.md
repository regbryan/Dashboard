# Changelog

All notable changes to the SocialPulse dashboard are recorded here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html) loosely (we cut on each merge to `main`, not on tagged releases).

## [Unreleased]

### Added

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

- Liquid-glass `.lg-surface--card` blur now visible — the standard `backdrop-filter` property was being stripped by the Tailwind v4 + LightningCSS pipeline, leaving only `-webkit-backdrop-filter` which Chromium 146+ no longer accepts. Backdrop blur applied inline as a workaround until LightningCSS targeting changes.
- All `app-review` Phase 3 BLOCKERs cleared (axe-core 0 violations across the modified routes, mobile header no longer collides with the tab pill).

### Known issues

- **Hydration mismatch in `ClientReviewLink.tsx`** — uses `typeof window !== "undefined"` to render `${window.location.origin}${path}`. Predates this release; fix tracked separately.
- **No error-tracking SDK** installed yet (Sentry/Datadog gap). See [docs/observability.md](docs/observability.md).
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
