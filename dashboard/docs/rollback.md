# Rollback runbook

If something breaks on the SocialPulse dashboard after a deploy, this is the decision tree and the exact commands.

## Decision tree

Ask three questions in order. Each one narrows what you do.

1. **Is the failure user-visible right now?** If users can't reach the dashboard at all, or are seeing 500s on a major flow → go to **Path A: emergency Vercel rollback**. If it's a slow degradation (latency, occasional errors), continue.
2. **Did a database migration ship in the bad release?** If yes → go to **Path B: migration rollback**. Migrations are forward-compatible by convention, so this should be rare; if you're unsure, check `dashboard/supabase-*.sql` files in the offending commit range.
3. **Is it a Stripe / SocialPilot / Supabase webhook misconfiguration?** → go to **Path C: third-party config rollback**.

If none apply, treat it as a regular bug — open an incident, do not roll back.

## Path A — emergency Vercel rollback (≤ 2 minutes)

The fastest path. Vercel keeps every deployment forever; we promote the last known good one.

1. Find the last good deployment URL — Vercel dashboard → Deployments → look for the last green one before the bad merge. Note the commit SHA in the deployment list.
2. Promote it: in the Vercel UI, on that deployment card click **⋯ → Promote to Production**. Effect is global within ~30s.

CLI equivalent:

```bash
vercel ls socialpulse                                # list recent deployments
vercel promote <deployment-url> --scope=<team>       # promote a known good build
```

After promoting:
- Verify in browser: hit `/dashboard` and confirm the version matches the rolled-back SHA (check the commit footer if present, or `view-source` for a build ID).
- Open the offending PR and add a comment: `Reverted in prod via Vercel promote — investigating before re-deploy.`
- File a Linear/issue ticket for the bug. The bad commit stays on `main` until the fix lands; do **not** force-push to clean it up.

## Path B — migration rollback

Only applies if `dashboard/supabase-*.sql` changed in the bad release. Supabase migrations are forward-only by default, so this is the messier path.

1. **Stop writes** to the affected tables — disable any cron that touches them via Vercel → Project → Crons → toggle off the relevant entries (`autopilot-generate`, `socialpilot-refresh`, etc.).
2. **Identify the migration** that ran. Check `supabase-*-migration.sql` files added in the offending commit range.
3. **Write a reverse migration** that undoes the change. Apply it via:
   ```bash
   psql "$SUPABASE_DB_URL" -f reverse-migration.sql
   ```
4. **Promote the last-good Vercel deployment** (Path A) so the code that expected the old schema is back in production.
5. **Re-enable crons** once the rollback is verified.

If the migration added a column with a default that backfilled data, the reverse migration needs to drop that column — you'll lose the backfill data. Decide before running whether that's acceptable.

## Path C — third-party config rollback

For Stripe webhook secrets, SocialPilot OAuth credentials, or Supabase keys that drifted:

1. Pull the previous values from 1Password / your secret store (whichever vault holds them).
2. Update via `vercel env rm <KEY>` followed by `vercel env add <KEY>` — Vercel will prompt for the value and rebuild on next deploy.
3. Trigger a redeploy: push an empty commit (`git commit --allow-empty -m "chore: redeploy after env update"`) or click **Redeploy** on the latest deployment in the Vercel UI.

Cron secrets (`CRON_SECRET`): rotating these requires updating `vercel.json` to point at the new value AND coordinating with whoever set the cron headers. Don't rotate during incident response unless the cron secret itself was leaked.

## Rollback drill

A rollback path that hasn't been tested isn't a rollback path. Every quarter, run through Path A in staging:

1. Pick a recent deployment.
2. Deploy a deliberately broken commit (e.g. `throw new Error("rollback drill")` in `app/layout.tsx`).
3. Promote the previous deployment.
4. Time it. Target: under 2 minutes from "noticed" to "fixed."
5. Document the drill in this file under "Drill log" with date + duration + anyone who ran it.

### Drill log

| Date | Duration | Operator | Notes |
|---|---|---|---|
| _(none yet)_ | _ | _ | First drill TBD |

## Contacts during an incident

- **On-call engineer:** (TBD — populate when oncall rotation exists)
- **Stripe / payments:** Reggie
- **Supabase:** Reggie
- **SocialPilot / publishing:** Reggie
- **DNS / Vercel domain:** Reggie

Update this section once there's anyone besides Reggie who can be paged.
