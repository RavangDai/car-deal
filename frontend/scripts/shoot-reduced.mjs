// Verify content is fully visible under prefers-reduced-motion (never gated by animation).
//   node scripts/shoot-reduced.mjs <port>
import { chromium } from "playwright";
const port = process.argv[2] || "5191";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
await page.goto(`http://localhost:${port}/`, { waitUntil: "networkidle" });
await page.waitForTimeout(400);
await page.screenshot({ path: "verify-shots/home-reduced.png", fullPage: false });
console.log("verify-shots/home-reduced.png");
await browser.close();
