# Onboarding → Autopilot → Approval → (future) Publish

The end-to-end customer journey from a Stripe checkout to a published post. Includes happy path, branch conditions, and failure recovery paths.

## Sequence

```mermaid
sequenceDiagram
    autonumber
    actor Customer
    participant Marketing as Marketing site<br/>(socialpulse.media)
    participant Stripe
    participant Dashboard as Dashboard API
    participant Supabase as Supabase<br/>(Auth + DB + Storage)
    participant Cron as Vercel Cron
    participant Gemini
    participant Resend
    actor Reviewer as Client reviewer

    Customer->>Marketing: visits /pricing
    Customer->>Marketing: clicks "Subscribe — Growth"
    Marketing->>Dashboard: POST /api/stripe/checkout {tier}
    Dashboard->>Stripe: create Checkout Session
    Stripe-->>Customer: redirect to hosted checkout
    Customer->>Stripe: enters card, completes payment

    Stripe->>Dashboard: webhook checkout.session.completed<br/>(HMAC-signed raw body)
    Dashboard->>Supabase: upsert pending_signups<br/>{email, tier, stripe_*}

    Stripe-->>Customer: redirect /api/onboarding/claim?session_id=...
    Dashboard->>Supabase: getUser()
    alt Not signed in
        Dashboard-->>Customer: redirect /login?next=...claim
        Customer->>Supabase: Google OAuth
        Supabase-->>Customer: JWT cookie set
        Customer->>Dashboard: GET /api/onboarding/claim?session_id=...
    end
    Dashboard->>Supabase: claim pending_signups row<br/>by session_id + user_id
    Dashboard-->>Customer: redirect /onboarding

    Customer->>Customer: fills brand setup form
    Customer->>Dashboard: POST /api/onboarding/create
    Dashboard->>Supabase: RPC provision_brand()<br/>(atomic: brands + brand_kits<br/>+ user_brand_access)
    Dashboard->>Supabase: seedFirstBatch()<br/>(~14 posts at brand cadence)
    Dashboard-->>Customer: redirect /dashboard/brand/{slug}

    Note over Dashboard: after() — non-blocking
    Dashboard->>Gemini: generate first 2 posts<br/>(image + caption)
    Gemini-->>Supabase: write image to Storage
    Dashboard->>Supabase: update posts.file_path
    Dashboard->>Resend: send welcome email

    loop Every day at 12:00 UTC
        Cron->>Dashboard: GET /api/cron/autopilot-generate<br/>(Bearer CRON_SECRET)
        Dashboard->>Supabase: pick not_started posts (≤3/brand)
        Dashboard->>Gemini: generate image + caption
        Dashboard->>Supabase: update posts.status="in_review"
    end

    loop Every day at 13:00 UTC
        Cron->>Dashboard: GET /api/cron/client-digest
        Dashboard->>Supabase: SELECT posts WHERE status="in_review"<br/>AND client_notified_at IS NULL
        Dashboard->>Resend: send digest to brand's reviewers
        Dashboard->>Supabase: set client_notified_at = now()
    end

    Reviewer->>Dashboard: clicks link in digest<br/>→ /client/{brand}/post/{id}
    Reviewer->>Reviewer: reviews image + caption
    alt Approves
        Reviewer->>Dashboard: POST /api/approve {approved}
        Dashboard->>Supabase: insert approvals row<br/>+ update posts.status="approved"
        Dashboard->>Resend: confirmation email to reviewer
        Note right of Dashboard: (future) auto-queue to publisher
        Dashboard->>Dashboard: autoQueueApprovedPost()<br/>via after()
    else Requests changes
        Reviewer->>Dashboard: POST /api/approve {changes_requested, comment}
        Dashboard->>Supabase: insert approvals row<br/>+ update posts.status="generating"
        Dashboard->>Resend: confirmation email to reviewer
    end

    loop Every day at 14:00 UTC
        Cron->>Dashboard: GET /api/cron/changes-digest
        Dashboard->>Supabase: SELECT recent approvals (last 24h)
        Dashboard->>Resend: send owner digest of approved + changes_requested
    end
```

## Branch conditions called out

| Branch | Condition | What the customer sees |
|---|---|---|
| **Stripe webhook delayed** | Customer redirects to `/api/onboarding/claim` before the webhook has upserted `pending_signups` | Page polls every 2s and shows "Stripe's confirmation is still processing." Form is still fillable; the link happens when the webhook lands. |
| **Existing brand owned by this user** | `/onboarding` finds an existing `user_brand_access` row for the signed-in user | Redirect to `/dashboard/brand/{slug}` — the onboarding form is a one-shot wizard, not re-runnable. |
| **Slug already taken** | The `provision_brand` RPC's existence check inside the transaction finds a duplicate `brands.id` | 409 returned with a friendly message: `"The slug \"{slug}\" is already taken. Pick a different one."` |
| **Gemini generation fails** | The `after()`-wrapped autopilot call throws | Posts stay `status="not_started"`; the daily cron will retry. Welcome email still sends. |
| **No reviewers configured for the brand** | `client-digest` cron finds posts but `getBrandClientEmails()` is empty | Skipped with `status="skipped:no_recipients"`. Operator sees in logs. |
| **Past-date post auto-queued** | `autoQueueApprovedPost` sees a date ≤ now() | Returns `skipped: "past_date"`, writes `queue_status="failed"` + reason. Operator publishes manually. |
| **SocialPilot refresh-token dead** | `getValidAccessToken()` throws `SocialPilotAuthError` | `socialpilot_credentials.last_error` populated. UI shows "Reconnect SocialPilot" banner. Auto-queue marks the post `failed`; retry cron picks it up. (Currently dormant — SP integration parked.) |

## Recovery paths

| Error | Recovery |
|---|---|
| Stripe webhook signature mismatch | 400 returned. Stripe retries with exponential backoff (won't retry past 3 days). Operator gets alert via Vercel cron failure visibility. |
| Provision RPC fails mid-transaction | Postgres rolls back automatically — no partial brand state. User sees error, can retry the onboarding form. |
| Gemini outage during cron | Cron marks each failing post `generation_failed` with error message. Next cron tick retries. After 5 failures the post stays manual until operator investigates. |
| Resend rate limit | Email send returns failure; logged. Digest cron is idempotent on `client_notified_at` — next day's tick re-attempts the un-notified posts. |
| Approval comes in during regeneration | Approval row inserted normally. Post status flips to `approved` even though regeneration was in flight — the in-flight gen completes but its result is dropped. (Edge case; rare in practice.) |
| Customer cancels Stripe sub | Webhook `customer.subscription.deleted` fires → `brands.subscription_status="canceled"`. Autopilot gate (not yet implemented) would block further generation for that brand. |

## Hand-offs to humans

- **Operator manual publishing**: until Postiz/SocialPilot integration ships, "publish" is a human step. The reviewer approves; operator opens the post detail page; copies caption; downloads image; posts to Instagram by hand.
- **Refund / billing disputes**: operator handles via Stripe Dashboard. Customer Portal (link in dashboard's billing block) covers self-service cancellation but not refund issuance.
- **Support escalation**: no formal queue. Customer emails the operator directly. (Future: a `support_requests` table tied to brand_id.)

## Analytics events emitted

Currently none — the app doesn't have a frontend analytics pipeline yet. The DB itself is the source of truth for funnel reporting:
- Sign-ups → `auth.users` row count
- Active subs → `brands` WHERE `subscription_status = 'active'`
- Posts generated → `posts` WHERE `file_path IS NOT NULL`
- Posts approved → `approvals` WHERE `status = 'approved'`
- Time-to-first-approval → `MIN(approvals.created_at) - brands.created_at`
