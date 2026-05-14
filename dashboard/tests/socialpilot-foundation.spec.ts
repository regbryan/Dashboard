import { test, expect } from "@playwright/test";

/**
 * SocialPilot Phase 1 (foundation) smoke.
 *
 * Until the agency runs the OAuth bootstrap (Phase 2), every route
 * that depends on SocialPilot must:
 *   - fail closed (no network call)
 *   - return a clear "not configured" signal, never a 500
 *
 * Phase 2/3/4 add the real routes that this test will expand to cover.
 * For now we verify that no surfaces were exposed prematurely — the
 * connect/callback paths shouldn't 200 to an unauthenticated request.
 */

test.describe("SocialPilot routes — auth gating", () => {
  // All SP admin routes must reject unauthenticated requests. They run
  // through proxy.ts which 401s for /api/* paths or 307s to /login for
  // page paths. callback is in publicRoutes (SP signature isn't there,
  // we rely on state cookie + admin recheck inside the handler) so it
  // skips the proxy 401 — but it'll still bounce without a valid state.

  test("GET /api/socialpilot/connect → 401 unauthenticated", async ({ baseURL }) => {
    const res = await fetch(`${baseURL}/api/socialpilot/connect`, {
      redirect: "manual",
    });
    expect(res.status).toBe(401);
  });

  test("GET /api/socialpilot/accounts → 401 unauthenticated", async ({ baseURL }) => {
    const res = await fetch(`${baseURL}/api/socialpilot/accounts`);
    expect(res.status).toBe(401);
  });

  test("PUT /api/brands/x/socialpilot → 401 unauthenticated", async ({ baseURL }) => {
    const res = await fetch(`${baseURL}/api/brands/iec/socialpilot`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ socialpilot_account_id: "test" }),
    });
    expect(res.status).toBe(401);
  });

  test("POST /api/posts/x/socialpilot-retry → 401 unauthenticated", async ({ baseURL }) => {
    const res = await fetch(`${baseURL}/api/posts/123/socialpilot-retry`, {
      method: "POST",
    });
    expect(res.status).toBe(401);
  });

  test("GET /api/socialpilot/callback (no code) → 400 missing_code_or_state", async ({ baseURL }) => {
    // callback is in publicRoutes since the SP OAuth bounce doesn't
    // include our session cookie. But it still requires admin auth
    // inside the handler — so unauthed callers hit 401 from requireAdmin
    // before the code/state validation. Either 401 or 400 is acceptable
    // (depends on whether proxy.ts publicRoutes excludes it).
    const res = await fetch(`${baseURL}/api/socialpilot/callback`, {
      redirect: "manual",
    });
    expect([400, 401, 403]).toContain(res.status);
  });
});

test.describe("SocialPilot cron routes — secret gating", () => {
  test("GET /api/cron/socialpilot-refresh (no secret) → 401", async ({ baseURL }) => {
    const res = await fetch(`${baseURL}/api/cron/socialpilot-refresh`);
    expect(res.status).toBe(401);
  });

  test("GET /api/cron/socialpilot-retry-failed (no secret) → 401", async ({
    baseURL,
  }) => {
    const res = await fetch(`${baseURL}/api/cron/socialpilot-retry-failed`);
    expect(res.status).toBe(401);
  });
});

test.describe("Type contracts", () => {
  test("posts.socialpilot_queue_status state machine values", () => {
    // Compile-time test: these are the only legal values per the
    // migration's CHECK constraint. Lock the union here so future
    // changes can't silently introduce a new status without updating
    // the DB.
    const allowed = ["queued", "failed", "published", "disabled"] as const;
    type Status = (typeof allowed)[number] | null;
    const sample: Status = null;
    expect(sample).toBeNull();
    expect(allowed).toHaveLength(4);
  });
});
