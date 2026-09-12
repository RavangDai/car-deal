// Functional checks the brief asks for: search retrieves real products, the
// hero anchor lands below the sticky header, filters change the feed.
import { chromium } from "playwright";
const PORT = process.argv[2] || "5174";
const b = await chromium.launch();
const page = await (await b.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
const errs = [];
page.on("pageerror", (e) => errs.push(String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/`, { waitUntil: "networkidle" });

// 1. Search retrieves real products
await page.fill('input[type="search"]', "press");
await page.waitForTimeout(900);
const rows = await page.locator(".rv-hdr-result").count();
const firstTitle = rows ? await page.locator(".rv-hdr-result-title").first().innerText() : null;
console.log(`search "press": ${rows} result(s)` + (firstTitle ? ` — first: "${firstTitle}"` : ""));

await page.fill('input[type="search"]', "zzzzzqqq");
await page.waitForTimeout(900);
const noteText = await page.locator(".rv-hdr-results-note").innerText().catch(() => "(none)");
console.log(`search "zzzzzqqq": ${noteText}`);
await page.keyboard.press("Escape");

// 2. Anchor lands clear of the sticky header
await page.click(".rv-hero2-cta");
await page.waitForTimeout(900);
const anchor = await page.evaluate(() => {
  const el = document.getElementById("finds");
  const hdr = document.querySelector(".rv-hdr");
  return { top: Math.round(el.getBoundingClientRect().top), headerH: Math.round(hdr.getBoundingClientRect().height) };
});
console.log(`anchor: #finds top=${anchor.top}px, header=${anchor.headerH}px -> ${anchor.top >= anchor.headerH ? "CLEAR" : "OBSCURED"}`);

// 3. Category filter changes the feed
const before = await page.locator(".rv-pcard").count();
await page.click('.rv-pill:has-text("Kitchen")');
await page.waitForTimeout(1200);
const after = await page.locator(".rv-pcard").count();
const stores = await page.locator(".rv-pcard-store").allInnerTexts();
console.log(`filter: ${before} cards -> Kitchen -> ${after} cards`);

// 4. Badges reflect the honesty rules
const badges = await page.locator(".rv-pcard-badge").allInnerTexts();
console.log(`badges on screen: ${JSON.stringify([...new Set(badges)])}`);

// 5. Save control routes a guest to sign-in
await page.click(".rv-pcard-save");
await page.waitForTimeout(700);
console.log(`save control -> hash "${await page.evaluate(() => location.hash)}"`);

if (errs.length) console.log("PAGE ERRORS:", errs.slice(0, 3));
else console.log("no page errors");
await b.close();
