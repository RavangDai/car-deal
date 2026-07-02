// One-off visual verification for the real-images + detail-page work.
// Usage: node scripts/shoot-verify.mjs <dealId>
import { chromium } from "playwright";

const ID = process.argv[2];
const base = "http://localhost:5173";
const out = "verify-shots";

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
});

// Home — hero (real "top pick" thumbnail) + deals table (real per-car photos)
await page.goto(base, { waitUntil: "networkidle" });
await page.waitForTimeout(2000);
await page.screenshot({ path: `${out}/v-home-hero.png` });

await page.evaluate(() => document.querySelector("#deals")?.scrollIntoView());
await page.waitForTimeout(3000); // allow external photos to load
await page.screenshot({ path: `${out}/v-home-deals.png` });

// Detail page — gallery + full field set
if (ID) {
  await page.goto(`${base}/#/deal/${ID}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${out}/v-deal-detail.png`, fullPage: true });
}

await browser.close();
console.log("shots done:", `${out}/v-home-hero.png`, `${out}/v-home-deals.png`, ID ? `${out}/v-deal-detail.png` : "(no detail id)");
