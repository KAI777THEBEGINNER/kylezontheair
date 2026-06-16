import { test, expect } from "@playwright/test";

test("check AVIF support and canvas pixel data", async ({ page }) => {
  await page.goto("http://localhost:3000");
  await page.waitForLoadState("domcontentloaded");

  // Check AVIF support
  const avifSupported = await page.evaluate(async () => {
    return new Promise<boolean>((resolve) => {
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = "/frames/frame_0001.avif";
    });
  });
  console.log("AVIF supported:", avifSupported);

  // Try loading a frame and check canvas
  const canvasState = await page.evaluate(async () => {
    // Try to load a single frame
    const img = new Image();
    const loaded = await new Promise<{success: boolean, w: number, h: number}>((resolve) => {
      img.onload = () => resolve({ success: true, w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => resolve({ success: false, w: 0, h: 0 });
      img.src = "/frames/frame_0001.avif";
    });

    if (!loaded.success) {
      return { frameLoadResult: loaded, canvasHasContent: false };
    }

    // Draw to a test canvas and check pixels
    const testCanvas = document.createElement("canvas");
    testCanvas.width = loaded.w;
    testCanvas.height = loaded.h;
    const ctx = testCanvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0);
    const pixel = ctx.getImageData(0, 0, 1, 1).data;
    
    // Also check the actual background canvas
    const bgCanvas = document.querySelector("canvas") as HTMLCanvasElement;
    let bgPixel = [0, 0, 0, 0];
    if (bgCanvas) {
      const bgCtx = bgCanvas.getContext("2d");
      if (bgCtx) {
        bgPixel = Array.from(bgCtx.getImageData(0, 0, 1, 1).data);
      }
    }

    return {
      frameLoadResult: loaded,
      testPixel: Array.from(pixel),
      bgCanvasSize: bgCanvas ? `${bgCanvas.width}x${bgCanvas.height}` : "not found",
      bgPixel,
      canvasHasContent: pixel.some(v => v > 0),
      bgHasContent: bgPixel.some(v => v > 0),
    };
  });
  console.log("Canvas state:", JSON.stringify(canvasState, null, 2));

  // Wait longer and check again
  await page.waitForTimeout(15000);
  
  const finalState = await page.evaluate(() => {
    const bgCanvas = document.querySelector("canvas") as HTMLCanvasElement;
    if (!bgCanvas) return { error: "no canvas" };
    const bgCtx = bgCanvas.getContext("2d");
    if (!bgCtx) return { error: "no context" };
    
    // Sample multiple pixels
    const w = bgCanvas.width;
    const h = bgCanvas.height;
    const pixels: number[][] = [];
    for (const [x, y] of [[0,0], [w/2, h/2], [w-1, h-1], [w/4, h/4]]) {
      const d = bgCtx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data;
      pixels.push(Array.from(d));
    }
    
    // Check how many images the component has loaded
    // We can't access React refs directly, but we can check the network requests
    return { canvasSize: `${w}x${h}`, sampledPixels: pixels };
  });
  console.log("Final state:", JSON.stringify(finalState, null, 2));
});
