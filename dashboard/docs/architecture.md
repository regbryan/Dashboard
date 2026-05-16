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
