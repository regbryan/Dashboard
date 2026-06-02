import { test, expect } from "@playwright/test";
import {
  parsePostsPerWeek,
  parseWeekdayTokens,
  planMonthDates,
} from "../lib/autopilot/calendar-plan";

/**
 * Pure-logic tests for calendar planning. No server/browser needed — run with
 * BASE_URL set so Playwright skips the webServer:
 *   BASE_URL=http://x npx playwright test tests/calendar-plan.spec.ts
 */

test.describe("parseWeekdayTokens", () => {
  test("parses explicit weekday hints from cadence strings", () => {
    expect(parseWeekdayTokens("2x/week (Tu/Th)")).toEqual([2, 4]);
    expect(parseWeekdayTokens("3x/week (M/W/F)")).toEqual([1, 3, 5]);
    expect(parseWeekdayTokens("3x/week (Tu/Th/Sa)")).toEqual([2, 4, 6]);
    expect(parseWeekdayTokens("2x/week (W/Sa)")).toEqual([3, 6]);
    expect(parseWeekdayTokens("2x/week (M/Th)")).toEqual([1, 4]);
  });

  test("returns empty when no weekday hint is present", () => {
    expect(parseWeekdayTokens("2x/month")).toEqual([]);
    expect(parseWeekdayTokens("weekly")).toEqual([]);
    expect(parseWeekdayTokens(null)).toEqual([]);
  });

  test("does not misread two-letter days as single letters", () => {
    // "Th" must not register as a stray match that also adds other days.
    expect(parseWeekdayTokens("(Th)")).toEqual([4]);
    expect(parseWeekdayTokens("(Su)")).toEqual([0]);
  });
});

test.describe("parsePostsPerWeek", () => {
  test("handles weekly variants", () => {
    expect(parsePostsPerWeek("3x/week (M/W/F)")).toBe(3);
    expect(parsePostsPerWeek("weekly")).toBe(1);
    expect(parsePostsPerWeek("biweekly")).toBe(0.5);
    expect(parsePostsPerWeek("twice a week")).toBe(2);
  });

  test("treats x/month as a monthly rate, not weekly", () => {
    // 2/month ≈ 0.46/week — must be well under 1, not 2.
    const rate = parsePostsPerWeek("2x/month");
    expect(rate).toBeGreaterThan(0.3);
    expect(rate).toBeLessThan(0.6);
  });

  test("falls back for unparseable input", () => {
    expect(parsePostsPerWeek(undefined)).toBe(3);
    expect(parsePostsPerWeek("whenever")).toBe(3);
  });
});

test.describe("planMonthDates — June 2026 (month index 5)", () => {
  test("weekday cadence lands on every matching day", () => {
    // Tu/Th in June 2026: Tue 2,9,16,23,30 + Thu 4,11,18,25
    const dates = planMonthDates(2026, 5, "2x/week (Tu/Th)");
    expect(dates).toEqual([
      "2026-06-02",
      "2026-06-04",
      "2026-06-09",
      "2026-06-11",
      "2026-06-16",
      "2026-06-18",
      "2026-06-23",
      "2026-06-25",
      "2026-06-30",
    ]);
  });

  test("notBefore drops days already past in the current month", () => {
    const dates = planMonthDates(2026, 5, "2x/week (Tu/Th)", "2026-06-03");
    expect(dates).not.toContain("2026-06-02");
    expect(dates[0]).toBe("2026-06-04");
    expect(dates).toHaveLength(8);
  });

  test("M/W/F cadence yields 13 dates in June 2026", () => {
    const dates = planMonthDates(2026, 5, "3x/week (M/W/F)");
    expect(dates).toHaveLength(13);
    // All must be Mon/Wed/Fri.
    for (const iso of dates) {
      const dow = new Date(`${iso}T12:00:00Z`).getUTCDay();
      expect([1, 3, 5]).toContain(dow);
    }
  });

  test("monthly cadence spreads a small count across the month", () => {
    const dates = planMonthDates(2026, 5, "2x/month");
    expect(dates).toHaveLength(2);
    // Spread, not clustered at the start.
    expect(dates[0] < dates[1]).toBe(true);
    expect(Number(dates[0].slice(8))).toBeGreaterThan(1);
  });

  test("every planned date falls within the target month", () => {
    const dates = planMonthDates(2026, 5, "3x/week (Tu/Th/Sa)");
    for (const iso of dates) expect(iso.startsWith("2026-06-")).toBe(true);
  });
});
