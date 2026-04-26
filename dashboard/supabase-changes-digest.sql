-- Debounced changes-requested digest.
-- Add a notified_at column to approvals; the cron flips it to now() once a row
-- has been included in a digest email.
--
-- Idempotent: safe to re-run.

alter table public.approvals
  add column if not exists notified_at timestamptz;

create index if not exists approvals_pending_digest_idx
  on public.approvals (status, notified_at, created_at)
  where status = 'changes_requested' and notified_at is null;
