// Full-surface visual sweep for the "instrument" redesign.
//   node scripts/shoot-all.mjs <port> <productId>
// Covers every route incl. the signed-out dashboard (guest mode) and the
// reduced-motion path, and fails on horizontal overflow or console errors.
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const port = process.argv[2] || "5173";
const productId = process.argv[3];
const base = `http://localhost:${port}/`;

const SIZES = [
  { tag: "desktop", w: 1440, h: 1000 },
  { tag: "mobile", w: 390, h: 844 },
];

await mkdir("verify-shots", { recursive: true });
const browser = await chromium.launch();
const problems = [];

async function shoot(ctx, name, size, setup, { reduced = false } = {}) {
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 200)); });

  await setup(page);
  await page.waitForTimeout(reduced ? 800 : 2000);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  if (overflow > 1) problems.push(`${name} @${size.w}px overflows by ${overflow}px`);
  for (const e of errors) problems.push(`${name} @${size.w}px console: ${e}`);

  await page.screenshot({ path: `verify-shots/inst-${name}-${size.tag}.png` });
  console.log(`  ${name}-${size.tag}  overflow=${overflow}px errors=${errors.length}`);
  await page.close();
}

for (const size of SIZES) {
  for (const reduced of [false, true]) {
    const ctx = await browser.newContext({
      viewport: { width: size.w, height: size.h },
      deviceScaleFactor: 1,
      reducedMotion: reduced ? "reduce" : "no-preference",
    });
    const suffix = reduced ? "-reduced" : "";
    if (reduced && size.tag === "mobile") { await ctx.close(); continue; }

    console.log(`\n${size.tag}${suffix}:`);

    await shoot(ctx, `home${suffix}`, size, async (p) => {
      await p.goto(base, { waitUntil: "networkidle" });
    }, { reduced });

    await shoot(ctx, `detail${suffix}`, size, async (p) => {
      await p.goto(`${base}#/product/${productId}`, { waitUntil: "networkidle" });
    }, { reduced });

    await shoot(ctx, `legal${suffix}`, size, async (p) => {
      await p.goto(`${base}#/terms`, { waitUntil: "networkidle" });
    }, { reduced });

    // Guest dashboard: the browse-only view a visitor lands on from "Browse
    // without an account" on the login page.
    await shoot(ctx, `dashboard${suffix}`, size, async (p) => {
      await p.goto(base, { waitUntil: "networkidle" });
      await p.click("text=Start tracking").catch(() => {});
      await p.waitForTimeout(500);
      await p.click("text=Browse without an account").catch(() => {});
      await p.waitForTimeout(800);
    }, { reduced });

    await ctx.close();
  }
}

await browser.close();
if (problems.length) {
  console.error("\nPROBLEMS:\n" + problems.join("\n"));
  process.exit(1);
}
console.log("\nAll surfaces clean: no overflow, no console errors.");
