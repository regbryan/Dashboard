import { test, expect, request } from "@playwright/test";

/**
 * API contract probes — locks in the unauthenticated behavior of every
 * sensitive endpoint. These ran by hand during the /app-review pipeline;
 * codifying them so regressions surface on every `npm test`.
 *
 * No DB writes, no auth state — pure contract.
 */

test.describe("public pages", () => {
  test("GET /login renders 200", async ({ baseURL }) => {
    const api = await request.newContext();
    const res = await api.get(`${baseURL}/login`);
    expect(res.status()).toBe(200);
    expect(await res.text()).toContain("Continue with Google");
  });
});

test.describe("auth-gated pages redirect to /login", () => {
  for (const path of [
    "/",
    "/dashboard",
    "/dashboard/brand/iec",
    "/dashboard/brand/iec/kit",
    "/dashboard/brand/iec/calendar",
    "/client/iec",
    "/onboarding",
    "/no-access",
  ]) {
    test(`GET ${path} → 307`, async ({ baseURL }) => {
      const api = await request.newContext();
      const res = await api.get(`${baseURL}${path}`, {
        maxRedirects: 0,
      });
      expect(res.status()).toBe(307);
      expect(res.headers().location).toContain("/login");
    });
  }
});

test.describe("auth-gated API returns 401", () => {
  for (const probe of [
    { method: "GET", path: "/api/brands" },
    { method: "POST", path: "/api/onboarding/create" },
    { method: "POST", path: "/api/stripe/portal" },
  ] as const) {
    test(`${probe.method} ${probe.path} → 401`, async ({ baseURL }) => {
      const api = await request.newContext();
      const res = await api.fetch(`${baseURL}${probe.path}`, {
        method: probe.method,
        data: probe.method === "POST" ? { slug: "x", name: "x" } : undefined,
        maxRedirects: 0,
      });
      expect(res.status()).toBe(401);
      const body = await res.json();
      expect(body.error).toBe("unauthorized");
    });
  }
});

test.describe("cron routes require CRON_SECRET", () => {
  for (const path of [
    "/api/cron/autopilot-generate",
    "/api/cron/client-digest",
    "/api/cron/changes-digest",
    "/api/cron/refresh-brand-kits",
  ]) {
    test(`GET ${path} (no secret) → 401`, async ({ baseURL }) => {
      const api = await request.newContext();
      const res = await api.get(`${baseURL}${path}`, { maxRedirects: 0 });
      expect(res.status()).toBe(401);
    });
  }
});

test.describe("Stripe checkout contract", () => {
  test("rejects malformed JSON with 400", async ({ baseURL }) => {
    const api = await request.newContext();
    // Send raw bytes via Buffer so Playwright doesn't re-stringify
    // our payload into valid JSON. Plain `data: "{not json"` would be
    // sent as `"\"{not json\""` (a valid JSON string).
    const res = await api.post(`${baseURL}/api/stripe/checkout`, {
      headers: { "content-type": "application/json", origin: "https://socialpulse.media" },
      data: Buffer.from("{not json", "utf-8"),
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).error).toBe("invalid_json");
  });

  test("rejects unknown tier with 400", async ({ baseURL }) => {
    const api = await request.newContext();
    const res = await api.post(`${baseURL}/api/stripe/checkout`, {
      headers: { "content-type": "application/json", origin: "https://socialpulse.media" },
      data: { tier: "enterprise" },
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).error).toMatch(/tier must be one of/);
  });

  test("CORS preflight from socialpulse.media → ACAO=socialpulse", async ({ baseURL }) => {
    const api = await request.newContext();
    const res = await api.fetch(`${baseURL}/api/stripe/checkout`, {
      method: "OPTIONS",
      headers: {
        origin: "https://socialpulse.media",
        "access-control-request-method": "POST",
      },
    });
    expect(res.status()).toBe(204);
    expect(res.headers()["access-control-allow-origin"]).toBe(
      "https://socialpulse.media"
    );
  });
});

test.describe("Stripe webhook rejects unsigned requests", () => {
  test("missing signature → 400, handler never invoked", async ({ baseURL }) => {
    const api = await request.newContext();
    const res = await api.post(`${baseURL}/api/stripe/webhook`, {
      headers: { "content-type": "application/json" },
      data: { type: "checkout.session.completed", data: { object: {} } },
    });
    // 400 whether webhook secret is configured (signature missing) or
    // unconfigured (env missing) — never 5xx (which would trigger
    // Stripe's 3-day retry storm) and never 200 (which would mean the
    // handler ran without verifying).
    expect(res.status()).toBe(400);
  });
});
