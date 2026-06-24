// Capture the mobile nav with the burger menu open.
//   node scripts/shoot-menu.mjs <port>
import { chromium } from "playwright";
const port = process.argv[2] || "5191";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await page.goto(`http://localhost:${port}/`, { waitUntil: "networkidle" });
await page.waitForTimeout(400);
await page.getByRole("button", { name: /toggle menu/i }).click();
await page.waitForTimeout(400);
await page.screenshot({ path: "verify-shots/home-menu-mobile.png", fullPage: false });
console.log("verify-shots/home-menu-mobile.png");
await browser.close();
