import { chromium } from "playwright";
import { mkdir } from "fs/promises";

const OUT = "verify-screens";
await mkdir(OUT, { recursive: true });

const url = process.env.URL || "http://localhost:5174/";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

const logs = [];
page.on("console", (m) => logs.push(`[console.${m.type()}] ${m.text()}`));
page.on("pageerror", (e) => logs.push(`[pageerror] ${e.message}`));
page.on("requestfailed", (r) => logs.push(`[reqfail] ${r.url()} ${r.failure()?.errorText}`));

async function step(name, fn) {
  console.log(`--- ${name} ---`);
  try {
    await fn();
    console.log(`OK ${name}`);
  } catch (e) {
    console.log(`ERR ${name}: ${e.message}`);
  }
}

await step("home: load + mid-anim", async () => {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  // Capture early to catch hero fading in
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${OUT}/01-home-early.png`, fullPage: false });
  // Settle
  await page.waitForTimeout(1800);
  await page.screenshot({ path: `${OUT}/02-home-settled.png`, fullPage: false });
  // Full page after settled
  await page.screenshot({ path: `${OUT}/03-home-full.png`, fullPage: true });
});

await step("home: badge presence", async () => {
  // Heuristic: look for the Get Started button + hero
  const btns = await page.locator("button").allInnerTexts();
  console.log("buttons:", JSON.stringify(btns));
});

await step("login: navigate", async () => {
  // Click 'Get Started' or 'Login'
  const start = page.locator("button", { hasText: /Get Started/i }).first();
  await start.click();
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${OUT}/04-login-early.png` });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/05-login-settled.png` });
});

await step("login: form interaction probe", async () => {
  // Try the mode toggle if present
  const toggle = page.locator("text=/Create an account|Sign in instead|Already have/i").first();
  if (await toggle.count()) {
    await toggle.click();
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${OUT}/06-login-toggled.png` });
  } else {
    console.log("no mode toggle found");
  }
});

await step("login: try bogus submit to capture error animation", async () => {
  const emailInput = page.locator('input[type="email"], input[name="email"], input[placeholder*="mail" i]').first();
  const pwInput = page.locator('input[type="password"]').first();
  if (await emailInput.count() && await pwInput.count()) {
    await emailInput.fill("nope@nope.test");
    await pwInput.fill("wrongpassword1");
    const submit = page.locator('button[type="submit"], button:has-text("Log in"), button:has-text("Sign in"), button:has-text("Create")').first();
    if (await submit.count()) {
      await submit.click();
      await page.waitForTimeout(2500);
      await page.screenshot({ path: `${OUT}/07-login-after-submit.png` });
    }
  }
});

await step("dump logs", async () => {
  console.log(logs.join("\n"));
});

await browser.close();
console.log("done");
