import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Accessibility smoke on the surfaces we can reach without auth.
 *
 * Authenticated pages (dashboard, kit, calendar) need a Google OAuth
 * fixture — covered in a follow-up. For now we lock in the login
 * surface against WCAG 2.1 AA violations since that's the door
 * everyone walks through.
 */

test.describe("axe a11y on public surfaces", () => {
  test("/login has no WCAG 2.1 AA violations", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");
    const { violations } = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(
      violations,
      `axe violations:\n${violations
        .map((v) => `  ${v.id}: ${v.description}`)
        .join("\n")}`
    ).toEqual([]);
  });
});
