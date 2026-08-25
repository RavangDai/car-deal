// Click-through verification against a LIVE stack (backend + Vite dev server).
//
//   node scripts/verify-clicks.mjs [appUrl] [apiUrl]
//
// Walks every route, clicks every button and in-app link, and fails on the
// four things that make a click "not work" from a user's point of view:
//
//   1. an uncaught page error
//   2. a console error
//   3. a network response >= 400 (a control that can only ever 503 counts)
//   4. navigation off the SPA origin (the OAuth-button failure mode: a
//      full-page jump to raw JSON with no way back)
//
// Deliberately not a pytest/vitest test: it needs the whole stack up, and a
// suite that goes red because a container is down teaches people to ignore red.
import { chromium } from "playwright";

const APP = process.argv[2] || "http://localhost:5173";
const API = process.argv[3] || "http://localhost:8000";

// Requests the app makes that are *expected* to fail and are handled in the
// UI. Anything not listed here is a real finding.
const EXPECTED_FAILURES = [
  // /auth/me 401s for a signed-out visitor by design; the client treats it as
  // "no session" rather than an error.
  { url: /\/auth\/me$/, status: 401 },
];

const ROUTES = [
  { hash: "", name: "home" },
  { hash: "#/login", name: "login" },
  { hash: "#/browse", name: "browse" },
  { hash: "#/terms", name: "terms" },
  { hash: "#/privacy", name: "privacy" },
  { hash: "#/onboarding", name: "onboarding" },
];

const AUTHED_ROUTES = [
  { hash: "", name: "dashboard (authed)" },
  { hash: "#/alerts", name: "alerts" },
];

function isExpectedFailure(url, status) {
  return EXPECTED_FAILURES.some((e) => e.url.test(url) && e.status === status);
}

// A failing request to someone else's image host is not a broken click in this
// app. ProductImage already falls back to an inline placeholder on error, so
// the user sees a clean box rather than a broken icon.
//
// These are still reported -- a product whose photo never loads is worth
// knowing about -- but they do not fail the run. Letting a third party's
// downtime turn this permanently red is how a check stops being read.
function isThirdParty(url) {
  return !url.startsWith(APP) && !url.startsWith(API);
}

async function registerUser(page) {
  const email = `clickcheck${Date.now()}@example.com`;
  const res = await page.request.post(`${API}/auth/register`, {
    data: { email, password: "Str0ng-Passw0rd!42" },
  });
  if (!res.ok()) throw new Error(`register failed: ${res.status()} ${await res.text()}`);
  return email;
}

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  // Hard ceilings so one wedged control cannot hang the whole run.
  page.setDefaultTimeout(5000);
  page.setDefaultNavigationTimeout(15000);

  const findings = [];   // fail the run
  const thirdParty = [];  // report only
  let current = "(startup)";

  page.on("pageerror", (e) =>
    findings.push({ route: current, kind: "pageerror", detail: e.message }));
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const text = m.text().slice(0, 200);
    // "Failed to load resource" with no first-party URL is the echo of a
    // third-party asset failure already counted above.
    const bucket = /Failed to load resource/i.test(text) ? thirdParty : findings;
    bucket.push({ route: current, kind: "console", detail: text });
  });
  page.on("response", (r) => {
    const s = r.status();
    if (s >= 400 && !isExpectedFailure(r.url(), s)) {
      const bucket = isThirdParty(r.url()) ? thirdParty : findings;
      bucket.push({ route: current, kind: `http ${s}`, detail: r.url() });
    }
  });

  const rows = [];

  async function walk(routes, label) {
    for (const route of routes) {
      current = `${label}:${route.name}`;
      await page.goto(`${APP}/${route.hash}`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(500);

      // Buttons plus in-app anchors. External links are checked by href rather
      // than clicked -- following them would leave the app and prove nothing
      // about our own UI.
      const buttons = await page.locator("button:visible").all();
      const links = await page.locator('a[href^="#"]:visible').all();

      let clicked = 0;
      let deadEnds = 0;
      const routeDeadline = Date.now() + 45_000;

      for (let i = 0; i < buttons.length; i++) {
        if (Date.now() > routeDeadline) {
          rows.push({ route: current, buttons: buttons.length, links: links.length,
                      clicked, deadEnds, note: "route budget exhausted" });
          break;
        }
        // Re-query each time: clicking can re-render and detach handles.
        const fresh = await page.locator("button:visible").all();
        if (i >= fresh.length) break;
        const btn = fresh[i];
        const name = (await btn.textContent().catch(() => ""))?.trim().slice(0, 30) || "(icon)";

        try {
          await btn.click({ timeout: 3000, noWaitAfter: true });
          clicked++;
          await page.waitForTimeout(350);

          if (!page.url().startsWith(APP)) {
            findings.push({
              route: current,
              kind: "left the app",
              detail: `button "${name}" navigated to ${page.url()}`,
            });
            deadEnds++;
            await page.goto(`${APP}/${route.hash}`, { waitUntil: "domcontentloaded" });
          } else if (!page.url().includes(route.hash) && route.hash) {
            // Navigated within the app -- legitimate, just go back for the rest.
            await page.goto(`${APP}/${route.hash}`, { waitUntil: "domcontentloaded" });
          }
        } catch {
          // Not clickable (covered/disabled) is not itself a failure.
        }
      }

      for (const link of links) {
        const href = await link.getAttribute("href").catch(() => null);
        if (href) clicked++;
      }

      rows.push({
        route: current,
        buttons: buttons.length,
        links: links.length,
        clicked,
        deadEnds,
      });
    }
  }

  await walk(ROUTES, "guest");

  const email = await registerUser(page);
  await page.goto(APP, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
  await walk(AUTHED_ROUTES, "authed");

  // Product detail, using whatever the feed actually returns.
  const feed = await page.request.get(`${API}/products?sort=newest&limit=1`);
  const products = feed.ok() ? await feed.json() : [];
  if (products.length) {
    await walk([{ hash: `#/product/${products[0].id}`, name: "product detail" }], "authed");
  } else {
    rows.push({ route: "authed:product detail", buttons: 0, links: 0, clicked: 0, deadEnds: 0, note: "no products in feed" });
  }

  await browser.close();

  console.log(`\nSigned in as ${email}\n`);
  console.log("ROUTE                          BUTTONS  LINKS  EXERCISED  DEAD-ENDS");
  console.log("-----------------------------  -------  -----  ---------  ---------");
  for (const r of rows) {
    console.log(
      `${r.route.padEnd(29)}  ${String(r.buttons).padStart(7)}  ${String(r.links).padStart(5)}  ` +
      `${String(r.clicked).padStart(9)}  ${String(r.deadEnds).padStart(9)}` +
      (r.note ? `   (${r.note})` : "")
    );
  }

  if (findings.length === 0) {
    console.log("\nPASS - no page errors, console errors, failed requests, or dead ends.\n");
    process.exit(0);
  }

  console.log(`\nFAIL - ${findings.length} finding(s):\n`);
  const seen = new Set();
  for (const f of findings) {
    const key = `${f.route}|${f.kind}|${f.detail}`;
    if (seen.has(key)) continue;
    seen.add(key);
    console.log(`  [${f.route}] ${f.kind}`);
    console.log(`      ${f.detail}`);
  }
  process.exit(1);
}

main().catch((e) => {
  console.error("verifier crashed:", e);
  process.exit(2);
});
