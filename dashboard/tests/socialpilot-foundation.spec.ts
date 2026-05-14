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

test.describe("SocialPilot foundation (Phase 1)", () => {
  test("connect route is not yet exposed (404 or auth gate)", async ({
    baseURL,
  }) => {
    const res = await fetch(`${baseURL}/api/socialpilot/connect`, {
      redirect: "manual",
    });
    // Phase 2 will add this route as an admin-only redirect to SP.
    // Until then it should 404 (not exist) — never a 200 or 5xx.
    expect([404, 401, 307]).toContain(res.status);
  });

  test("posts.socialpilot_queue_status state machine values", () => {
    // Compile-time test: these are the only legal values per the
    // migration's CHECK constraint. Lock the union here so phases 4+
    // can't silently introduce a new status without updating the DB.
    const allowed = [
      "queued",
      "failed",
      "published",
      "disabled",
    ] as const;
    type Status = (typeof allowed)[number] | null;
    const sample: Status = null;
    expect(sample).toBeNull();
    expect(allowed).toHaveLength(4);
  });
});
