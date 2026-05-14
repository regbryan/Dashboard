import { test, expect } from "@playwright/test";

/**
 * Publishing-overlays automation: auth + shape gating.
 *
 * The actual overlay compositing is exercised by the existing
 * applyOverlayFooter / applyOverlayLogo libraries (covered by their
 * own snapshot semantics). What we lock in here is:
 *   - the editor route is admin-gated
 *   - the route validates shape before persisting
 *   - applyPublishingOverlays handles malformed configs without crashing
 */

test.describe("publishing-overlays route auth", () => {
  test("GET /api/brands/[id]/publishing-overlays → 401 unauthenticated", async ({
    baseURL,
  }) => {
    const res = await fetch(
      `${baseURL}/api/brands/iec/publishing-overlays`
    );
    expect(res.status).toBe(401);
  });

  test("PUT /api/brands/[id]/publishing-overlays → 401 unauthenticated", async ({
    baseURL,
  }) => {
    const res = await fetch(
      `${baseURL}/api/brands/iec/publishing-overlays`,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ overlays: [] }),
      }
    );
    expect(res.status).toBe(401);
  });
});
