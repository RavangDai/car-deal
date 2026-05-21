import { chromium } from "playwright";
import { mkdir } from "fs/promises";

const OUT = "verify-screens";
await mkdir(OUT, { recursive: true });

const url = process.env.URL || "http://localhost:5174/";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();

const logs = [];
page.on("console", (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on("pageerror", (e) => logs.push(`[pageerror] ${e.message}`));

await page.goto(url, { waitUntil: "networkidle" });

// Hero — settled
await page.waitForTimeout(2200);
await page.screenshot({ path: `${OUT}/g01-hero.png` });

// Bulletin / features
await page.evaluate(() => {
  const el = document.querySelector("[data-rv-section='features']");
  if (el) el.scrollIntoView({ block: "start" });
});
await page.waitForTimeout(1100);
await page.screenshot({ path: `${OUT}/g02-features.png` });

// How — asymmetric layout
await page.evaluate(() => {
  const el = document.querySelector("[data-rv-section='how']");
  if (el) el.scrollIntoView({ block: "start" });
});
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/g03-how.png` });

// Index / deals — settled with filter bar
await page.evaluate(() => {
  const el = document.querySelector("[data-rv-section='deals']");
  if (el) el.scrollIntoView({ block: "start" });
});
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/g04-deals.png` });

// Expand the first deal row
await page.evaluate(() => {
  const btn = document.querySelector(".rv-lot-row .rv-lot-expand");
  if (btn) btn.click();
});
await page.waitForTimeout(450);
await page.screenshot({ path: `${OUT}/g05-deals-expanded.png` });

// Save it
await page.evaluate(() => {
  const btn = document.querySelector(".rv-lot-row .rv-save-btn");
  if (btn) btn.click();
});
await page.waitForTimeout(250);
await page.screenshot({ path: `${OUT}/g06-deals-saved.png` });

// Manifesto
await page.evaluate(() => {
  const el = document.querySelector("[data-rv-section='compare']");
  if (el) el.scrollIntoView({ block: "start" });
});
await page.waitForTimeout(1400);
await page.screenshot({ path: `${OUT}/g07-compare.png` });

// Pricing comparison table
await page.evaluate(() => {
  const el = document.querySelector("[data-rv-section='pricing']");
  if (el) el.scrollIntoView({ block: "start" });
});
await page.waitForTimeout(1600);
await page.screenshot({ path: `${OUT}/g08-pricing.png` });

// CTA
await page.evaluate(() => {
  const el = document.querySelector("[data-rv-section='cta']");
  if (el) el.scrollIntoView({ block: "start" });
});
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/g09-cta.png` });

// Buyer desk — open
await page.evaluate(() => {
  const btn = document.querySelector(".rv-desk-tab");
  if (btn) btn.click();
});
await page.waitForTimeout(350);
await page.screenshot({ path: `${OUT}/g10-desk-open.png` });

// Full-page final
await page.evaluate(() => {
  const btn = document.querySelector(".rv-desk-tab");
  if (btn) btn.click();
});
await page.waitForTimeout(200);
await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}/g11-fullpage.png`, fullPage: true });

console.log("---LOGS (last 30)---");
console.log(logs.slice(-30).join("\n"));
await browser.close();
console.log("done");
