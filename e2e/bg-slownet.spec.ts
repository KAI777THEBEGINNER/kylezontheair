import { test, expect } from "@playwright/test";

test("slow 3G: background rendering on fresh device", async ({ browser }) => {
  // Create a new context with slow 3G throttling
  const context = await browser.newContext();
  const page = await context.newPage();

  // Enable network throttling via CDP
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 100,      // 100ms RTT
    downloadThroughput: 750000 / 8,  // ~93 KB/s (slow 3G)
    uploadThroughput: 750000 / 8,
  });

  const start = Date.now();
  await page.goto("http://localhost:3000");
  await page.waitForLoadState("domcontentloaded");

  // Check canvas state every 2 seconds for 30 seconds
  for (let t = 2; t <= 30; t += 2) {
    await page.waitForTimeout(2000);
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);

    const state = await page.evaluate(() => {
      const bgCanvas = document.querySelector("canvas") as HTMLCanvasElement;
      if (!bgCanvas) return { error: "no canvas" };
      const bgCtx = bgCanvas.getContext("2d");
      if (!bgCtx) return { error: "no ctx" };

      const w = bgCanvas.width;
      const h = bgCanvas.height;
      const centerPixel = Array.from(bgCtx.getImageData(Math.floor(w/2), Math.floor(h/2), 1, 1).data);
      const hasContent = centerPixel.some(v => v > 5);

      // Check overlay states
      const loadingOverlay = document.querySelector(".fixed.inset-0.z-\\[200\\]");
      const introOverlay = document.querySelector(".fixed.inset-0.z-\\[5\\]");
      
      return {
        canvasSize: `${w}x${h}`,
        centerPixel,
        hasContent,
        loadingOverlayOpacity: loadingOverlay ? getComputedStyle(loadingOverlay).opacity : "not found",
        introOverlayOpacity: introOverlay ? getComputedStyle(introOverlay).opacity : "not found",
      };
    });

    const status = state.hasContent ? "✅ HAS BG" : "❌ NO BG";
    console.log(`[${elapsed}s] ${status} | pixel: ${JSON.stringify(state.centerPixel)} | loading: ${state.loadingOverlayOpacity} | intro: ${state.introOverlayOpacity}`);

    if (state.hasContent && state.loadingOverlayOpacity === "0" && state.introOverlayOpacity === "0") {
      console.log(`Background fully visible at ${elapsed}s`);
      break;
    }
  }

  await page.screenshot({ path: "e2e/screenshots/slow3g-final.png" });
  await context.close();
});
