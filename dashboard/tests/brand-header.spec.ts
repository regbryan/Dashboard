import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Brand-page header smoke + a11y.
 *
 * Covers the BrandSectionTitle component and the responsive header
 * row in app/dashboard/brand/[slug]/layout.tsx. Both surfaces shipped
 * in 1eac261 / b16409e and previously had zero coverage.
 *
 * Auth: uses the test-only header bypass wired in proxy.ts +
 * playwright.config.ts. The secret is generated per-run and only
 * the test process knows it; the production server treats the bypass
 * as dead code because DASHBOARD_TEST_SECRET is never set there.
 *
 * Brand fixture: we don't ship a deterministic test brand. The tests
 * pick whatever brand is first in the brands table by visiting
 * /dashboard and clicking the first BrandCard. Skips with a clear
 * message if no brand exists.
 */

async function openFirstBrand(page: import("@playwright/test").Page) {
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  const firstBrand = page.locator('a[href^="/dashboard/brand/"]').first();
  if ((await firstBrand.count()) === 0) {
    test.skip(true, "No brands in database; brand-header tests need at least one.");
  }
  await firstBrand.click();
  await page.waitForURL(/\/dashboard\/brand\/[^/]+(?:\/|$)/);
}

test.describe("Brand page header — desktop", () => {
  test.use({ viewport: { width: 1400, height: 900 } });

  test("Designs tab renders title + subtitle, tabs centered", async ({
    page,
  }) => {
    await openFirstBrand(page);

    const title = page.getByRole("heading", { level: 1 });
    await expect(title).toHaveText("Designs");

    // Subtitle lives inside the BrandSectionTitle wrapper next to the h1.
    const subtitle = page.locator("h1 + p").first();
    await expect(subtitle).toBeVisible();
    await expect(subtitle).toContainText(/post|posts/);

    // Title must be on the left of the row; tabs must be centered.
    const titleBox = await title.boundingBox();
    const tablistBox = await page.getByRole("tablist").boundingBox();
    if (!titleBox || !tablistBox) throw new Error("missing bounding boxes");

    expect(titleBox.x).toBeLessThan(200);
    const tabsCenter = tablistBox.x + tablistBox.width / 2;
    const viewportCenter = 1400 / 2;
    expect(Math.abs(tabsCenter - viewportCenter)).toBeLessThan(50);
  });

  test("Calendar tab swaps the title and subtitle", async ({ page }) => {
    await openFirstBrand(page);
    await page.getByRole("tab", { name: "Calendar" }).click();
    await page.waitForURL(/\/calendar(?:\/|$)/);

    const title = page.getByRole("heading", { level: 1 });
    await expect(title).toHaveText("Calendar");
    await expect(page.locator("h1 + p").first()).toBeVisible();
  });

  test("Brand Kit tab swaps the title", async ({ page }) => {
    await openFirstBrand(page);
    await page.getByRole("tab", { name: "Brand Kit" }).click();
    await page.waitForURL(/\/kit(?:\/|$)/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Brand Kit");
  });

  test("Assets tab swaps the title", async ({ page }) => {
    await openFirstBrand(page);
    await page.getByRole("tab", { name: "Assets" }).click();
    await page.waitForURL(/\/assets(?:\/|$)/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Assets");
  });
});

test.describe("Brand page header — mobile (375px)", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("header stacks vertically, no title/tabs overlap", async ({ page }) => {
    await openFirstBrand(page);

    const title = page.getByRole("heading", { level: 1 });
    const tablist = page.getByRole("tablist");
    const titleBox = await title.boundingBox();
    const tablistBox = await tablist.boundingBox();
    if (!titleBox || !tablistBox) throw new Error("missing bounding boxes");

    // Stacked: tabs start below the title's bottom edge with positive gap.
    expect(tablistBox.y).toBeGreaterThan(titleBox.y + titleBox.height);
  });
});

test.describe("Brand pages — axe a11y", () => {
  test.use({ viewport: { width: 1400, height: 900 } });

  for (const tab of [
    { suffix: "", label: "Designs" },
    { suffix: "/calendar", label: "Calendar" },
    { suffix: "/kit", label: "Brand Kit" },
    { suffix: "/assets", label: "Assets" },
  ]) {
    test(`${tab.label} tab has no WCAG 2.1 AA violations`, async ({ page }) => {
      await openFirstBrand(page);
      if (tab.suffix) {
        await page.getByRole("tab", { name: tab.label }).click();
        await page.waitForURL(new RegExp(`${tab.suffix}(?:/|$)`));
      }
      const { violations } = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      expect(
        violations,
        `axe violations on ${tab.label}:\n${violations
          .map((v) => `  ${v.id}: ${v.description}`)
          .join("\n")}`
      ).toEqual([]);
    });
  }
});
