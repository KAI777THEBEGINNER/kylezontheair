import { test, expect } from "@playwright/test";

test("check background rendering and console errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(err.message));

  await page.goto("http://localhost:3000");
  await page.waitForLoadState("domcontentloaded");
  
  // Wait for loading to complete (up to 15s)
  await page.waitForTimeout(8000);

  // Check canvas element
  const canvasInfo = await page.evaluate(() => {
    const canvas = document.querySelector("canvas");
    if (!canvas) return { exists: false };
    const ctx = canvas.getContext("2d");
    return {
      exists: true,
      width: canvas.width,
      height: canvas.height,
      opacity: getComputedStyle(canvas).opacity,
      zIndex: getComputedStyle(canvas).zIndex,
      parentClass: canvas.parentElement?.className,
    };
  });
  console.log("Canvas info:", JSON.stringify(canvasInfo, null, 2));

  // Check if poster image exists
  const posterInfo = await page.evaluate(() => {
    const poster = document.querySelector('img[src*="poster"]');
    if (!poster) return { exists: false };
    return {
      exists: true,
      complete: poster.complete,
      naturalWidth: poster.naturalWidth,
      opacity: getComputedStyle(poster).opacity,
    };
  });
  console.log("Poster info:", JSON.stringify(posterInfo, null, 2));

  // Check loading overlay
  const loadingInfo = await page.evaluate(() => {
    const overlays = document.querySelectorAll(".fixed.inset-0");
    const results: any[] = [];
    overlays.forEach((el) => {
      const style = getComputedStyle(el);
      results.push({
        zIndex: style.zIndex,
        opacity: style.opacity,
        bg: style.backgroundColor,
        className: el.className.substring(0, 80),
      });
    });
    return results;
  });
  console.log("Overlay info:", JSON.stringify(loadingInfo, null, 2));

  // Take screenshot for visual check
  await page.screenshot({ path: "/tmp/bg-debug.png" });

  console.log("Console errors:", errors.length ? errors.join("\n") : "None");
});
