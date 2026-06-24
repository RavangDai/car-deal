// Focused high-DPI screenshot of a single element (or viewport) for close review.
//   node scripts/clip.mjs <port> <selector> <name> [width] [drive]
// drive: optional — "guest" | "login" | "legal" to route the SPA first.
import { chromium } from "playwright";

const port = process.argv[2] || "5191";
const sel = process.argv[3] || "body";
const name = process.argv[4] || "clip";
const w = Number(process.argv[5] || 1440);
const drive = process.argv[6] || "";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: w, height: 900 }, deviceScaleFactor: 2 });
await page.goto(`http://localhost:${port}/`, { waitUntil: "networkidle" });

if (drive === "login" || drive === "guest") {
  await page.getByRole("button", { name: /get started/i }).first().click();
  await page.waitForTimeout(500);
}
if (drive === "guest") {
  await page.getByRole("button", { name: /continue as guest/i }).click();
  await page.waitForTimeout(700);
}
if (drive === "legal") {
  await page.evaluate(() => { window.location.hash = "#/terms"; });
  await page.waitForTimeout(500);
}

await page.waitForTimeout(500);
const el = sel === "viewport" ? null : await page.$(sel);
if (el) {
  await el.screenshot({ path: `verify-shots/${name}.png` });
  console.log("ok", `verify-shots/${name}.png`);
} else if (sel === "viewport") {
  await page.screenshot({ path: `verify-shots/${name}.png` });
  console.log("ok", `verify-shots/${name}.png`);
} else {
  console.log("no element:", sel);
}
await browser.close();
