// Drive the app's state-routing to screenshot Login, Dashboard (guest) and Legal.
//   node scripts/shoot-app.mjs <port>
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const port = process.argv[2] || "5174";
const base = `http://localhost:${port}/`;
await mkdir("verify-shots", { recursive: true });
const browser = await chromium.launch();

async function shot(name, w, h, drive, full = true) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.goto(base, { waitUntil: "networkidle" });
  if (drive) await drive(page);
  await page.waitForTimeout(900);
  await page.screenshot({ path: `verify-shots/${name}.png`, fullPage: full });
  console.log(`verify-shots/${name}.png`);
  await page.close();
}

const toLogin = async (p) => {
  await p.getByRole("button", { name: /get started/i }).first().click();
  await p.waitForTimeout(500);
};
const toGuest = async (p) => {
  await toLogin(p);
  await p.getByRole("button", { name: /continue as guest/i }).click();
  await p.waitForTimeout(600);
};
const toLegal = async (p) => {
  await p.evaluate(() => { window.location.hash = "#/terms"; });
  await p.waitForTimeout(500);
};

await shot("login-desktop", 1440, 900, toLogin, false);
await shot("login-mobile", 390, 844, toLogin, true);
await shot("dashboard-desktop", 1440, 900, toGuest, true);
await shot("dashboard-mobile", 390, 844, toGuest, true);
await shot("legal-desktop", 1440, 900, toLegal, true);

await browser.close();
