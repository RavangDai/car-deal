// Screenshot helper for visual verification.
//   node scripts/shoot.mjs <port> <name> [full]
// Captures the page at desktop / tablet / mobile into verify-shots/.
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const port = process.argv[2] || "5174";
const name = process.argv[3] || "home";
const full = process.argv[4] !== "viewport";
const url = `http://localhost:${port}/`;

const SIZES = [
  { tag: "desktop", w: 1440, h: 900 },
  { tag: "tablet", w: 834, h: 1112 },
  { tag: "mobile", w: 390, h: 844 },
];

await mkdir("verify-shots", { recursive: true });
const browser = await chromium.launch();
for (const s of SIZES) {
  const page = await browser.newPage({ viewport: { width: s.w, height: s.h }, deviceScaleFactor: 1 });
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(700); // let mount animations settle + images decode
  const path = `verify-shots/${name}-${s.tag}.png`;
  await page.screenshot({ path, fullPage: full });
  console.log(path);
  await page.close();
}
await browser.close();
