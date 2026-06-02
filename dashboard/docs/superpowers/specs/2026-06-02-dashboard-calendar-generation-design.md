# Design: Generate calendar + multi-select generate designs

**Date:** 2026-06-02
**Status:** Approved (design); pending spec review
**Surface:** Dashboard brand Designs tab (`/dashboard/brand/[slug]`), admin-only

## Problem

Today there is no way for an admin to create a brand's content calendar or
generate its designs from the dashboard UI. The pieces exist but aren't
connected:

- The autopilot cron (`/api/cron/autopilot-generate`) generates **images** for
  posts that already have a `concept`/`visual_direction`, dripping 3/brand/tick.
  It never authors the calendar text, and there's no UI trigger.
- `lib/autopilot/seed-first-batch.ts` plans ~14 days of bare date/type/pillar
  rows at onboarding, bails if any posts exist, and writes no concept text.
- Per-post image regeneration exists at `POST /api/posts/[id]/regenerate`, but
  only one post at a time via the post detail page.

As of 2026-06-02 there was no June content for any of the 8 brands — the
calendar simply hadn't been created. Authoring it by hand (raw SQL) doesn't
scale. The admin needs to drive both steps from the dashboard.

## Goals

1. A **Generate calendar** control on a brand's Designs tab that authors a
   chosen month of draft posts (text only: concept, caption, visual_direction,
   hashtags, post_type, content_pillar), on-brand, at the brand's cadence.
2. A **multi-select** mechanism on the Designs tab letting the admin pick one
   post, several, or all, and **Generate designs** (images) for exactly that
   selection, with live progress.

## Non-goals

- No image generation during calendar authoring (kept a separate, explicit
  step so no credits are spent on unreviewed content).
- No global/all-brands controls — per-brand only.
- No publishing changes. Output is drafts/in-review; SocialPilot stays dormant.
- No new queue/background-worker infrastructure.

## Decisions (locked during brainstorming)

- **Output of "generate calendar"** = written calendar only.
- **Time range** = a month the admin picks (month picker, defaults to the
  current calendar month).
- **Scope** = per-brand only (both controls live on the brand Designs tab).
- **Overwrite** = idempotent; skip any date that already has a post (never
  double-book). Re-running a partially-seeded month only fills the gaps.
- **Bulk image generation** = client-orchestrated batching against the existing
  per-post route (see Approaches).

## End-to-end flow

1. Admin opens a brand's Designs tab → clicks **Generate calendar** → picks a
   target month → confirm dialog → server authors that month's posts as drafts
   → page revalidates, new "Approval Not Started" tiles appear with no image.
2. Each tile shows a **checkbox** (admin only). A toolbar offers **Select all**
   and **Select all needing generation** (posts with no `file_path`).
3. Admin clicks **Generate designs (N)** → confirm dialog states N images will
   be generated → browser calls the per-post regenerate endpoint in small
   concurrent batches → progress bar ("6 of 13…") → each tile flips to
   in-review with its image as it completes; per-post failures surface on the
   tile and do not stop the rest.

## Backend

### (a) Calendar authoring

**New lib:** `lib/autopilot/generate-calendar.ts`

```
generateCalendar(brandSlug: string, opts: { year: number; month: number })
  : Promise<GenerateCalendarSummary>
```

- Reads cadence from `brands.cadence` and pillars/platform from `brand_kits`
  (reuse the parsing helpers from `seed-first-batch.ts` — extract the shared
  cadence/date/type/pillar logic so both call sites use one implementation).
- Plans the dates **within the target month** at the brand's cadence (not a
  rolling 14-day horizon).
- Queries existing posts for that brand in the month; **skips** any planned date
  already occupied (idempotent).
- For each new slot, calls the Gemini text model (reuse the request/parse
  pattern from `derive-kit.ts` `callGeminiForDerivation`: `GEMINI_TEXT_MODEL`,
  `responseMimeType: "application/json"`) with brand-kit context (positioning,
  tone keywords/vocab, pillar for the slot, post_type, month/season hooks) to
  author `concept`, `caption`, `visual_direction`, `hashtags`. Batch the slots
  into one or few model calls returning a JSON array to stay within runtime.
- Inserts rows with `status='not_started'`, correct `post_number` (continue from
  the brand's current max), `created_at`/`updated_at` set explicitly
  (`created_at` is NOT NULL with no default).
- Returns `{ brandSlug, month, created, skipped, dates }`.

**New route:** `POST /api/brands/[brandId]/generate-calendar`

- Mirrors `refresh-kit/route.ts`: `requireAdmin()`, `withRequestContext`,
  `maxDuration = 120`, body `{ year, month }`, returns the summary JSON.

### (b) Bulk design generation

**No new route.** The browser calls the existing
`POST /api/posts/[id]/regenerate` once per selected post.

- That route already: admin-gates, loads the post, calls
  `generateBrandPost(post, { regenerate: true })`, returns `{ ok, ... }`.
- `generateBrandPost` requires a `concept` or `visual_direction` — guaranteed by
  step (a), so generation won't no-op.

## Approaches considered (bulk generation)

| Approach | Trade-off | Verdict |
|---|---|---|
| **Client-batched** | Reuses a proven endpoint; 1 image/request stays under the function time cap; progress + partial success natural; zero new infra. | **Chosen** |
| Server-side batch route | One click, but a full month exceeds Vercel runtime; needs a queue/background worker — major new infra on Hobby tier. | Rejected (YAGNI) |

## Frontend

- **`SelectableDesignsGrid`** (new client component): wraps the tile grid, holds
  selection state, renders the selection toolbar (Select all / Select all
  needing generation / Clear / **Generate designs (N)** / progress bar).
  Concurrency limit ~2–3 in-flight generations; updates each tile on completion.
- **`PostCard`**: optional `selectable` + `selected` + `onToggle` props for an
  admin-only checkbox overlay. Non-admin and client surfaces unchanged.
- **`GenerateCalendarButton`** (new client component): month picker (defaults to
  the current calendar month) + confirm dialog near the top of the Designs tab;
  POSTs to the new route; triggers a router refresh on success.
- **`page.tsx`** stays the server data source (via `getBrandPosts`) and passes
  posts into `SelectableDesignsGrid`. The existing `filter=needs_generation`
  pill is retained and pairs with "Select all needing generation."

## Data model

No schema changes. Uses existing `posts` columns: `brand_id`, `post_number`,
`date`, `day`, `post_type`, `content_pillar`, `concept`, `caption`,
`hashtags`, `visual_direction`, `status`, `file_path`, `created_at`,
`updated_at`.

## Guardrails & error handling

- Both new actions are **admin-only** (`requireAdmin`), matching existing routes.
- **Credit safety:** the Generate-designs confirm dialog states the exact count
  before any image call. Calendar authoring spends only cheap text-model calls.
- **Per-post resilience:** a failed generation is caught, shown on that tile,
  and does not abort the batch.
- **Idempotency:** re-running calendar generation for a month only fills empty
  dates; never duplicates.
- **Nothing auto-publishes.**

## Testing

- Unit: date-planning + idempotency (skip-occupied-dates) logic; cadence parsing
  (shared helper) keeps `seed-first-batch` behavior unchanged.
- Unit: calendar-authoring lib with the Gemini text call mocked (asserts insert
  payload shape, post_number continuation, status).
- Playwright: select-all + Generate designs drives the progress UI against a
  mocked regenerate route (no real Gemini calls / credits in tests).

## Rollout notes

- Ships behind the existing admin gate; no env or schema migration required.
- IEC already has 8 hand-authored June drafts (ids 89–96); the idempotent
  skip-occupied behavior means generating IEC's June via this feature will skip
  those dates rather than duplicate them.
