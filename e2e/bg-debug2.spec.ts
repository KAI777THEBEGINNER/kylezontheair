import { test, expect } from "@playwright/test";

test("deep debug: frame loading + criticalProgress state", async ({ page }) => {
  const logs: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "log" || msg.type() === "error" || msg.type() === "warn") {
      logs.push(`[${msg.type()}] ${msg.text()}`);
    }
  });

  await page.goto("http://localhost:3000");
  await page.waitForLoadState("domcontentloaded");

  // Inject debug instrumentation
  await page.evaluate(() => {
    // Override Image constructor to track load/error
    const OrigImage = window.Image;
    let loadCount = 0;
    let errorCount = 0;
    // @ts-ignore
    window.__frameDebug = { loadCount: 0, errorCount: 0, errors: [] as string[] };
    
    // Patch console to track critical progress
    const origLog = console.log;
    console.log = (...args: any[]) => {
      origLog(...args);
    };
  });

  // Wait 15 seconds (past the 12s hard timeout)
  await page.waitForTimeout(15000);

  // Check the full state
  const state = await page.evaluate(() => {
    const canvas = document.querySelector("canvas");
    const overlays = document.querySelectorAll(".fixed.inset-0");
    const overlayStates: any[] = [];
    overlays.forEach((el) => {
      const s = getComputedStyle(el);
      if (parseInt(s.zIndex) >= 5 || s.backgroundColor !== "rgba(0, 0, 0, 0)") {
        overlayStates.push({
          zIndex: s.zIndex,
          opacity: s.opacity,
          bg: s.backgroundColor.substring(0, 30),
          class: el.className.substring(0, 60),
        });
      }
    });

    // Count loaded images by checking network
    const imgs = document.querySelectorAll("img");
    const imgStates: any[] = [];
    imgs.forEach((img) => {
      imgStates.push({
        src: (img as HTMLImageElement).src.substring(0, 50),
        complete: img.complete,
        naturalW: img.naturalWidth,
      });
    });

    return { overlayStates, imgStates, canvasOpacity: canvas ? getComputedStyle(canvas).opacity : "no-canvas" };
  });
  console.log("State after 15s:", JSON.stringify(state, null, 2));

  await page.screenshot({ path: "e2e/screenshots/debug-15s.png" });

  // Print console logs for debugging
  if (logs.length > 0) {
    console.log("Console output (last 20):", logs.slice(-20).join("\n"));
  }
});
