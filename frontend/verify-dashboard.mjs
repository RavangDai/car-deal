import { chromium } from "playwright";
import { mkdir } from "fs/promises";

const OUT = "verify-screens";
await mkdir(OUT, { recursive: true });

const url = process.env.URL || "http://localhost:5174/";
const API = "http://localhost:8000";

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

const logs = [];
page.on("console", (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on("pageerror", (e) => logs.push(`[pageerror] ${e.message}`));

// Stub /auth/me → fake user
await ctx.route(`${API}/auth/me`, (route) =>
  route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ id: "00000000-0000-0000-0000-000000000001", email: "demo@revveal.test", is_active: true }),
  }),
);

// Stub /deals → 9 fake deals so we can observe the staggered card grid
const fakeDeals = Array.from({ length: 9 }).map((_, i) => ({
  id: `d${i}`,
  source: i % 2 === 0 ? "craigslist" : "facebook",
  url: "https://example.com",
  title: `${2018 + (i % 6)} Honda Civic LX ${i}`,
  description: "Clean title, one owner, well maintained.",
  listed_price: 12000 + i * 350,
  predicted_price: 14000 + i * 400,
  undervalue_percent: 12 + i,
  year: 2018 + (i % 6),
  make: "Honda",
  model: "Civic",
  mileage: 60000 + i * 1500,
  location: ["CA", "TX", "NY", "WA", "FL"][i % 5],
  created_at: new Date().toISOString(),
  posted_at: new Date(Date.now() - i * 3600_000).toISOString(),
}));

await ctx.route(new RegExp(`${API}/deals.*`), (route) =>
  route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(fakeDeals),
  }),
);

// Inject a token before any script runs so useMe's `enabled: !!getToken()` is true
await ctx.addInitScript(() => {
  localStorage.setItem("revveal_access_token", "stub-token-for-verification");
});

await page.goto(url, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/08-dashboard-early.png` });
await page.waitForTimeout(1800);
await page.screenshot({ path: `${OUT}/09-dashboard-settled.png` });
await page.screenshot({ path: `${OUT}/10-dashboard-full.png`, fullPage: true });

// Confirm card count
const cards = await page.locator("a.rv-deal-card-link").count();
console.log(`deal cards on screen: ${cards}`);
console.log("---LOGS---");
console.log(logs.slice(-20).join("\n"));

await browser.close();
console.log("done");
