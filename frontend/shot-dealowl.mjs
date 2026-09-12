// Screenshot the DealOwl redesign at the three widths the brief names.
// Run with the dev server up:  node shot-dealowl.mjs [port]
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const PORT = process.argv[2] || "5174";
const OUT = "shots";
mkdirSync(OUT, { recursive: true });

const WIDTHS = [
  { name: "1440", width: 1440, height: 1100 },
  { name: "768", width: 768, height: 1100 },
  { name: "375", width: 375, height: 900 },
];

const browser = await chromium.launch();
for (const w of WIDTHS) {
  const ctx = await browser.newContext({
    viewport: { width: w.width, height: w.height },
    deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text().slice(0, 200));
  });
  page.on("pageerror", (e) => errors.push("PAGEERROR: " + String(e).slice(0, 200)));

  await page.goto(`http://localhost:${PORT}/`, { waitUntil: "networkidle" }).catch(() => {});
  // Let fonts settle so the screenshot shows Manrope/Inter, not the fallback.
  await page.evaluate(() => document.fonts.ready).catch(() => {});
  await page.waitForTimeout(700);

  // The app hides below-fold content behind GSAP reveals; settle them so the
  // capture is not a page of blank sections.
  await page.evaluate(() => window.__rvSettle && window.__rvSettle()).catch(() => {});
  await page.waitForTimeout(250);

  await page.screenshot({ path: `${OUT}/home-${w.name}.png`, fullPage: false });
  await page.screenshot({ path: `${OUT}/home-${w.name}-full.png`, fullPage: true });

  // Which font actually resolved, and is anything overflowing horizontally?
  const facts = await page.evaluate(() => {
    const body = getComputedStyle(document.body);
    const h1 = document.querySelector("h1");
    return {
      bodyFont: body.fontFamily,
      bodyBg: body.backgroundColor,
      h1Font: h1 ? getComputedStyle(h1).fontFamily : null,
      h1Size: h1 ? getComputedStyle(h1).fontSize : null,
      docWidth: document.documentElement.scrollWidth,
      winWidth: window.innerWidth,
      overflowX: document.documentElement.scrollWidth > window.innerWidth,
    };
  });
  console.log(`\n[${w.name}px]`, JSON.stringify(facts, null, 2));
  if (errors.length) console.log(`  console errors: ${errors.slice(0, 4).join(" | ")}`);

  await ctx.close();
}

// Sign-in page at desktop width too.
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
const page = await ctx.newPage();
await page.goto(`http://localhost:${PORT}/#/login`, { waitUntil: "networkidle" }).catch(() => {});
await page.evaluate(() => document.fonts.ready).catch(() => {});
await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}/login-1440.png` });
await ctx.close();

await browser.close();
console.log("\nwrote screenshots to frontend/shots/");
