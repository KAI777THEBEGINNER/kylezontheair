import { test, expect } from "@playwright/test";

test.describe("Kai Digital Twin Website", () => {
  test("full page screenshot - initial load", async ({ page }) => {
    await page.goto("http://localhost:3000");
    // Use domcontentloaded instead of networkidle: the site continuously
    // loads background frames, so network is never idle.
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000);
    await page.screenshot({
      path: "e2e/screenshots/01-initial-load.png",
      fullPage: true,
    });
  });

  test("full page screenshot - scrolled mid-page", async ({ page }) => {
    await page.goto("http://localhost:3000");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000);
    // Scroll to ~30% of the page height (hero section text area)
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.3));
    await page.waitForTimeout(800);
    await page.screenshot({
      path: "e2e/screenshots/02-scrolled-to-text1.png",
      fullPage: true,
    });
  });

  test("chat input and send", async ({ page }) => {
    await page.goto("http://localhost:3000");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000);

    // Scroll to bottom to reveal chat area
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000);

    // Type and send — placeholder is "问 Kyle 任何问题…" (zh) or "Ask Kyle anything…" (en)
    const textarea = page.locator("textarea");
    await textarea.fill("test");
    await page.keyboard.press("Enter");

    // Wait for AI response
    await page.waitForTimeout(8000);

    await page.screenshot({
      path: "e2e/screenshots/03-chat-response.png",
      fullPage: true,
    });
  });
});
