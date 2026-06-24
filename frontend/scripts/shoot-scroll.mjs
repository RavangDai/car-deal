// Screenshot the viewport after scrolling down, to check the fixed pill over content.
//   node scripts/shoot-scroll.mjs <port> <name> <scrollPx> [width]
import { chromium } from "playwright";
const port = process.argv[2] || "5191";
const name = process.argv[3] || "scroll";
const y = Number(process.argv[4] || 1200);
const w = Number(process.argv[5] || 1440);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: w, height: 900 }, deviceScaleFactor: 1 });
await page.goto(`http://localhost:${port}/`, { waitUntil: "networkidle" });
await page.waitForTimeout(500);
await page.evaluate((y) => window.scrollTo(0, y), y);
await page.waitForTimeout(500);
await page.screenshot({ path: `verify-shots/${name}.png`, fullPage: false });
console.log(`verify-shots/${name}.png`);
await browser.close();
