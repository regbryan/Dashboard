# System architecture

How the Dashboard, marketing site, and external services hang together.

## Component map

```mermaid
flowchart TB
    subgraph Customer["👤 Customer / Reviewer"]
        Browser["Browser"]
    end

    subgraph Vercel["▲ Vercel (regbryans-projects)"]
        subgraph Marketing["socialpulse.media"]
            Pricing["Pricing page<br/>POST /api/stripe/checkout"]
        end
        subgraph Dashboard["dashboard-eight-theta-24.vercel.app"]
            Pages["App pages<br/>/login /onboarding /dashboard<br/>/dashboard/brand/[slug]/*<br/>/client/[brand]/*"]
            APIRoutes["API routes (~38)"]
            Proxy["proxy.ts<br/>auth middleware"]
            Crons["6 cron jobs<br/>daily (Hobby tier)"]
        end
    end

    subgraph Supabase["🐘 Supabase"]
        Auth["Auth (Google OAuth)"]
        DB["Postgres<br/>13 tables · RLS on"]
        Storage["Storage<br/>post-images bucket"]
    end

    subgraph External["External services"]
        Stripe["💳 Stripe<br/>checkout + portal + webhooks"]
        Gemini["🤖 Google Gemini<br/>image + text generation"]
        Resend["✉️ Resend<br/>transactional email"]
        SocialPilot["📅 SocialPilot<br/>(parked — Enterprise required)"]
        Postiz["📅 Postiz<br/>(parked — future option)"]
    end

    Browser --> Pricing
    Browser --> Pages

    Pricing -- "POST /api/stripe/checkout" --> Stripe
    Stripe -- "redirect to claim" --> APIRoutes
    Stripe -- "webhook<br/>checkout.session.completed<br/>subscription.*<br/>invoice.*" --> APIRoutes

    Pages --> Proxy
    APIRoutes --> Proxy
    Proxy -- "JWT cookie" --> Auth

    APIRoutes --> DB
    APIRoutes --> Storage
    APIRoutes -- "Gemini Vision +<br/>image generation" --> Gemini
    APIRoutes -- "send digest /<br/>approval / welcome" --> Resend

    Crons -- "autopilot-generate<br/>(daily 12:00 UTC)" --> APIRoutes
    Crons -- "client-digest<br/>(13:00)" --> APIRoutes
    Crons -- "changes-digest<br/>(14:00)" --> APIRoutes
    Crons -- "refresh-brand-kits<br/>(15:00)" --> APIRoutes
    Crons -- "socialpilot-refresh<br/>(06:00 — dormant)" --> APIRoutes
    Crons -- "socialpilot-retry<br/>(08:00 — dormant)" --> APIRoutes

    APIRoutes -.- "future" .-> SocialPilot
    APIRoutes -.- "future" .-> Postiz

    style SocialPilot stroke-dasharray: 4 4,color:#888
    style Postiz stroke-dasharray: 4 4,color:#888
```

## Service-by-service notes

| Service | Used for | Where in code |
|---|---|---|
| **Supabase Auth** | Google OAuth sign-in, JWT cookie session | `lib/api-auth.ts`, `proxy.ts`, `lib/supabase-server.ts` |
| **Supabase Postgres** | 13 tables, all RLS-enabled | `lib/supabase-admin.ts` (service role), `lib/supabase.ts` (anon) |
| **Supabase Storage** | `post-images` bucket — generated images, brand logos, overlays | `lib/image-url.ts`, `lib/overlay-{logo,footer}.ts` |
| **Stripe** | Subscription checkout, customer portal, webhook lifecycle | `app/api/stripe/*`, `lib/stripe.ts` |
| **Google Gemini** | Image generation (Imagen 4 via Gemini), text generation, brand-kit derivation | `lib/autopilot/gemini.ts`, `lib/autopilot/derive-{kit,visuals}.ts` |
| **Resend** | Welcome email, post-ready notifications, daily digests | `lib/send-email.ts`, `lib/emails/welcome.ts`, `lib/digest.ts`, `lib/client-notify.ts` |
| **Vercel Cron** | 6 daily cron jobs (Hobby tier limits multi-hour schedules) | `vercel.json`, `app/api/cron/*` |
| **SocialPilot** | Auto-publish to Instagram (parked) | `lib/socialpilot.ts`, `app/api/socialpilot/*` |

## Boundary contracts

### Auth boundary

Every page under `/dashboard/**` and every `/api/**` route (except the public routes below) goes through `proxy.ts`. The proxy:
1. Calls `supabase.auth.getUser()` to verify the JWT cookie
2. Redirects unauth'd page requests to `/login?next=<original>`
3. Returns `401 {error: "unauthorized"}` for unauth'd API requests
4. Checks admin-only routes via `isAdminEmail()` (env-driven allowlist)
5. Checks brand access on `/client/[brand]/*` via `user_brand_access` lookup

**Public routes (intentionally outside the auth gate):**
- `/login`, `/auth/callback`, `/auth/error`
- `/api/cron/*` (gated by `CRON_SECRET` Bearer)
- `/api/stripe/webhook` (gated by Stripe HMAC signature)
- `/api/stripe/checkout` (unauthenticated buyers from marketing site, CORS-gated)
- `/api/socialpilot/callback` (OAuth bounce — admin-gated inside the handler)
- `/robots.txt`, `/sitemap.xml`, `/favicon.ico`, static images

### Stripe boundary

The Dashboard never holds card info. Stripe Checkout (hosted page) + Stripe Customer Portal (hosted page) carry payment. The Dashboard only sees:
- `pending_signups` rows from the `checkout.session.completed` webhook
- `brands.stripe_customer_id` + `subscription_*` columns synced from webhook events

### Gemini boundary

Every brand-context-aware prompt goes through `lib/autopilot/brand-prompt.ts` which composes the brand_kit (positioning, tone, do/donts, archetype, palette, photography direction) with the post's concept + visual_direction. Responses are validated as structured JSON before writing to `posts`.

## Frontend conventions

A handful of patterns established on the brand-page surfaces — note them when extending those pages.

### Liquid-glass surface

`.lg-surface--card` (in `app/globals.css`) handles the static glass styling (gradient bg, inset specular, border, hover glow). Backdrop blur lives in `lib/glass-style.ts` as `cardBackdropFilter` and is applied inline via `style={{ ...cardBackdropFilter }}`. The blur **must** be inline because Tailwind v4 + LightningCSS strips the standard `backdrop-filter` property from the class rule when Safari is in browserslist, leaving only `-webkit-backdrop-filter` which Chromium 146+ no longer accepts. See [feedback memory](../../../../.claude/projects/C--Users-reggi-OneDrive-Documents-Instagram-Automation/memory/feedback_tailwind_v4_backdrop_filter.md) for the full trace.

### Brand page header

`/dashboard/brand/[slug]/layout.tsx` owns the sticky header. The active section title + subtitle render via the client component `BrandSectionTitle` (reads `usePathname()` to pick the active section, gets subtitle text from a prop passed by the server-rendered layout). Subtitle data comes from cached fetchers in `lib/brand-data.ts` — `getBrand`, `getBrandPosts`, and `getBrandLogoCount` are wrapped in React's `cache()` so the layout and the Designs/Calendar pages share one round-trip per brand_id within a single render.

The header row is responsive: stacked column below the `md` Tailwind breakpoint, side-by-side (title absolute-left, tabs centered) at md and up.

### Empty states

All four brand tabs use the shared `<EmptyState>` component for "nothing here yet" surfaces — same `.lg-surface--card` treatment, same 60×24 padding, same muted color. Replaces what were four ad-hoc inline style blocks.

### Tab focus ring

`.brand-tab:focus-visible` (in `app/globals.css`) adds a violet outline ring when keyboard users land on a tab. Mouse-only interaction never sees it; the violet matches the active-tab border.

## Dev-docs route group

Admin-only system documentation lives under `/dev/*` (`app/dev/layout.tsx`). Four routes today:

| Route | Source | Purpose |
|---|---|---|
| `/dev/architecture` | this file | Component map + service notes + boundary contracts |
| `/dev/schema` | `docs/schema/README.md` | Mermaid ER diagram + table-by-table prose |
| `/dev/flows` | every `.md` in `docs/flows/` | User-journey flow diagrams |
| `/dev/app-map` | `docs/app-map/index.html` (iframe srcDoc) | Interactive LiteGraph viewer; node click opens side panel with role/owner/breaks |

Gated to admin emails by `proxy.ts` + a defense-in-depth check in `app/dev/layout.tsx`. Add new flows by dropping a `.md` into `docs/flows/` — `/dev/flows` picks them up automatically.
