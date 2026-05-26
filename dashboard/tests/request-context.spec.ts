import { test, expect } from "@playwright/test";
import {
  getRequestId,
  withRequestContext,
} from "../lib/request-context";

/**
 * AsyncLocalStorage round-trip for the per-request correlation ID.
 * No browser; pure-function tests via the Playwright runner.
 */

test.describe("request-context", () => {
  test("getRequestId returns undefined outside withRequestContext", () => {
    expect(getRequestId()).toBeUndefined();
  });

  test("getRequestId returns the id set by withRequestContext", async () => {
    const request = new Request("http://localhost/", {
      headers: { "x-request-id": "fixture-abc-123" },
    });
    const result = await withRequestContext(request, () => getRequestId());
    expect(result).toBe("fixture-abc-123");
  });

  test("falls back to x-vercel-id when x-request-id is missing", async () => {
    const request = new Request("http://localhost/", {
      headers: { "x-vercel-id": "iad1::abc::xyz" },
    });
    const result = await withRequestContext(request, () => getRequestId());
    expect(result).toBe("iad1::abc::xyz");
  });

  test("generates a UUID when both headers are missing", async () => {
    const request = new Request("http://localhost/");
    const result = await withRequestContext(request, () => getRequestId());
    // crypto.randomUUID() shape: 8-4-4-4-12 hex chars
    expect(result).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
  });

  test("isolates concurrent requests", async () => {
    const reqA = new Request("http://localhost/", {
      headers: { "x-request-id": "A" },
    });
    const reqB = new Request("http://localhost/", {
      headers: { "x-request-id": "B" },
    });
    const [a, b] = await Promise.all([
      withRequestContext(reqA, async () => {
        // Yield once so the two contexts interleave.
        await new Promise((r) => setTimeout(r, 0));
        return getRequestId();
      }),
      withRequestContext(reqB, async () => {
        await new Promise((r) => setTimeout(r, 0));
        return getRequestId();
      }),
    ]);
    expect(a).toBe("A");
    expect(b).toBe("B");
  });

  test("propagates through nested async calls", async () => {
    const request = new Request("http://localhost/", {
      headers: { "x-request-id": "nested-test" },
    });
    async function deep() {
      await new Promise((r) => setTimeout(r, 1));
      return getRequestId();
    }
    const result = await withRequestContext(request, async () => {
      return deep();
    });
    expect(result).toBe("nested-test");
  });
});
