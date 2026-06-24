// Downscale + re-encode the raw car photos into lightweight WebP assets in
// public/cars/. No sharp/ImageMagick on this machine, so we drive the already-
// installed Playwright Chromium and use a <canvas> to resize + encode.
//
// Raw originals live in design-assets/carimages/ (NOT public/, so the multi-MB
// sources never ship to the production build). Only the optimized WebP in
// public/cars/ is served. Drop new raw shots into design-assets/carimages/,
// add a JOBS entry, and re-run:  node scripts/optimize-images.mjs
import { chromium } from "playwright";
import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = path.join(root, "design-assets");
const pub = path.join(root, "public");

// src is relative to design-assets/.  max caps the long edge.
const JOBS = [
  { src: "carimages/mustang.jpg",                out: "cars/hero-mustang.webp",     max: 1920, q: 0.80 },
  { src: "carimages/mustang2.jpg",               out: "cars/band-challenger.webp",  max: 1920, q: 0.80 },
  { src: "carimages/mustange3 for login3.jpg",   out: "cars/login-mustang.webp",    max: 1300, q: 0.82 },
  { src: "carimages/mustange3 for login.jpg",    out: "cars/detail-chrome.webp",    max: 1000, q: 0.82 },
  { src: "carimages/mustang.jpg",                out: "cars/thumb-mustang.webp",    max: 420,  q: 0.80 },
  { src: "carimages/mustang2.jpg",               out: "cars/thumb-challenger.webp", max: 420,  q: 0.80 },
  { src: "carimages/mustange3 for login3.jpg",   out: "cars/thumb-silver.webp",     max: 420,  q: 0.80 },
  { src: "carimages/mustange3 for login.jpg",    out: "cars/thumb-chrome.webp",     max: 420,  q: 0.80 },
];

const mime = (f) => (f.endsWith(".png") ? "image/png" : "image/jpeg");

async function main() {
  await mkdir(path.join(pub, "cars"), { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent("<canvas id=c></canvas>");

  for (const job of JOBS) {
    try {
      const srcPath = path.join(srcDir, job.src);
      const buf = await readFile(srcPath);
      const dataUrl = `data:${mime(job.src)};base64,${buf.toString("base64")}`;

      const outDataUrl = await page.evaluate(
        async ({ dataUrl, max, q }) => {
          // createImageBitmap tolerates progressive/CMYK JPEGs that img.decode() rejects.
          const blob = await (await fetch(dataUrl)).blob();
          const bmp = await createImageBitmap(blob);
          const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
          const w = Math.round(bmp.width * scale);
          const h = Math.round(bmp.height * scale);
          const canvas = document.getElementById("c");
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(bmp, 0, 0, w, h);
          return canvas.toDataURL("image/webp", q);
        },
        { dataUrl, max: job.max, q: job.q },
      );

      const b64 = outDataUrl.split(",")[1];
      const outPath = path.join(pub, job.out);
      await writeFile(outPath, Buffer.from(b64, "base64"));
      const { size } = await stat(outPath);
      console.log(`${job.out.padEnd(30)} ${(size / 1024).toFixed(0).padStart(5)} KB`);
    } catch (e) {
      console.warn(`SKIP ${job.out} — ${e.message?.split("\n")[0]}`);
    }
  }

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
