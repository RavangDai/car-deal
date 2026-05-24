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

// Trigger the login route by clicking the homepage "Get started" button
await page.waitForTimeout(800);
const navBtn = await page.locator("nav .rv-btn-primary").first();
await navBtn.click();

// Wait for the login layout's stagger to settle
await page.waitForTimeout(1400);
await page.screenshot({ path: `${OUT}/login-01-default.png` });

// Focus the email input → shows the focus state (red shadow shift)
await page.locator(".rv-input[type='email']").focus();
await page.locator(".rv-input[type='email']").fill("buyer@example.com");
await page.waitForTimeout(250);
await page.screenshot({ path: `${OUT}/login-02-email-focus.png` });

// Add a password
await page.locator(".rv-input-pw").fill("supersecret123");
await page.waitForTimeout(200);

// Tick remember me
await page.locator(".rv-checkbox").click();
await page.waitForTimeout(200);
await page.screenshot({ path: `${OUT}/login-03-filled.png` });

// Trigger validation error
await page.locator(".rv-input[type='email']").fill("not-an-email");
await page.locator(".rv-login-submit").click();
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/login-04-validation-err.png` });

// Toggle to register mode
await page.locator(".rv-input[type='email']").fill("");
await page.locator(".rv-input-pw").fill("");
await page.locator(".rv-login-toggle-btn").click();
await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}/login-05-register.png` });

// Full page screenshot (default state)
await page.locator(".rv-login-toggle-btn").click();
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/login-06-fullpage.png`, fullPage: true });

console.log("---LOGS (last 30)---");
console.log(logs.slice(-30).join("\n"));
await browser.close();
console.log("done");
