import { test, expect } from "@playwright/test";
import { __test_only__ } from "../lib/logger";

const { scrub } = __test_only__;

/**
 * Logger unit tests — exercises just the scrub() pass since the
 * emit() side just delegates to console.*. The Playwright runner is
 * fine for pure-function tests; no browser context needed.
 */

test.describe("logger scrub", () => {
  test("redacts known credential keys at top level", () => {
    const out = scrub({
      password: "hunter2",
      token: "abc",
      apiKey: "xyz",
      authorization: "Bearer foo",
      safe: "keep me",
    }) as Record<string, unknown>;
    expect(out.password).toBe("[redacted]");
    expect(out.token).toBe("[redacted]");
    expect(out.apiKey).toBe("[redacted]");
    expect(out.authorization).toBe("[redacted]");
    expect(out.safe).toBe("keep me");
  });

  test("redacts known credential keys nested", () => {
    const out = scrub({
      brand: { id: "x", supabase_service_role_key: "secret" },
    }) as { brand: Record<string, unknown> };
    expect(out.brand.id).toBe("x");
    expect(out.brand.supabase_service_role_key).toBe("[redacted]");
  });

  test("masks email-like fields, keeping first char + domain", () => {
    const out = scrub({
      userEmail: "alice@example.com",
      clientEmail: "bob@workbyccmarketing.com",
      notes: "should@stay.com", // not an *email key
    }) as Record<string, unknown>;
    expect(out.userEmail).toBe("a***@example.com");
    expect(out.clientEmail).toBe("b***@workbyccmarketing.com");
    expect(out.notes).toBe("should@stay.com");
  });

  test("masks each entry in *emails arrays", () => {
    const out = scrub({
      emails: ["foo@bar.com", "baz@qux.io"],
    }) as { emails: string[] };
    expect(out.emails).toEqual(["f***@bar.com", "b***@qux.io"]);
  });

  test("expands Error instances to {name, message, stack}", () => {
    const err = new Error("boom");
    const out = scrub({ err }) as { err: { name: string; message: string; stack?: string } };
    expect(out.err.name).toBe("Error");
    expect(out.err.message).toBe("boom");
    expect(typeof out.err.stack).toBe("string");
  });

  test("expands top-level Error via the 'err' / 'error' key path", () => {
    const e = new TypeError("nope");
    const wrapped = scrub({ error: e }) as { error: { name: string; message: string } };
    expect(wrapped.error.name).toBe("TypeError");
    expect(wrapped.error.message).toBe("nope");
  });

  test("truncates at depth 6 to avoid pathological nesting blowups", () => {
    let nested: Record<string, unknown> = { leaf: "v" };
    for (let i = 0; i < 10; i++) nested = { next: nested };
    const out = scrub(nested) as Record<string, unknown>;
    // scrub recurses with depth 0..6 (inclusive); depth 7 short-circuits.
    // So 7 `.next` hops should land on "[truncated]".
    let cursor: unknown = out;
    for (let i = 0; i < 7; i++) {
      cursor = (cursor as Record<string, unknown>).next;
    }
    expect(cursor).toBe("[truncated]");
  });

  test("passes through primitives untouched", () => {
    expect(scrub(42)).toBe(42);
    expect(scrub("hello")).toBe("hello");
    expect(scrub(null)).toBe(null);
    expect(scrub(undefined)).toBe(undefined);
    expect(scrub(true)).toBe(true);
  });
});
