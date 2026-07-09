#!/usr/bin/env node
// ---------------------------------------------------------------------------
// sync-docs.mjs — keep the *derivable* parts of the docs in step with the code.
//
// Reads live project state (package.json, requirements.txt, FastAPI routers,
// SQLAlchemy models, Alembic migrations, the seed catalog, git) and rewrites
// ONLY the text between `<!-- SYNC:key:start -->` / `<!-- SYNC:key:end -->`
// markers in:
//   • <repo>/README.md                       (scaffolded on first run)
//   • <memory-dir>/project-snapshot.md        (a dedicated auto memory file)
//
// It never touches prose outside the markers, and only writes a file when the
// content actually changed — so wiring it to a Claude Code Stop hook is quiet
// (a no-op on turns that didn't change anything relevant).
//
// Usage:  node scripts/sync-docs.mjs [--memory-dir "<abs path to memory dir>"]
// Root is resolved from this file's location, so cwd doesn't matter.
// Any failure is swallowed and the process exits 0 (must never break a hook).
// ---------------------------------------------------------------------------

import {
  readFileSync,
  writeFileSync,
  existsSync,
  readdirSync,
  mkdirSync,
} from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { execFileSync } from "node:child_process";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT =
  process.env.CLAUDE_PROJECT_DIR && existsSync(process.env.CLAUDE_PROJECT_DIR)
    ? process.env.CLAUDE_PROJECT_DIR
    : resolve(HERE, "..");

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : null;
}
const MEMORY_DIR = argValue("--memory-dir") || process.env.CLAUDE_MEMORY_DIR || null;

const read = (p) => {
  try {
    return readFileSync(p, "utf8");
  } catch {
    return null;
  }
};
const repo = (...p) => join(ROOT, ...p);

// args is an array — no shell is spawned, so nothing is interpolated into a
// command string (execFileSync, not execSync). All call sites pass constants.
function git(args) {
  try {
    return execFileSync("git", args, {
      cwd: ROOT,
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
  } catch {
    return null;
  }
}

// ── Collectors ─────────────────────────────────────────────────────────────

function collectMeta() {
  const html = read(repo("frontend", "index.html")) || "";
  const main = read(repo("backend", "app", "main.py")) || "";
  const title = (html.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || "";
  const desc =
    (html.match(/name="description"[\s\S]*?content="([\s\S]*?)"/) || [])[1] ||
    "";
  return {
    pageTitle: title.trim(),
    description: desc.replace(/\s+/g, " ").trim(),
    apiTitle: (main.match(/title="([^"]+)"/) || [])[1] || "",
    apiVersion: (main.match(/version="([^"]+)"/) || [])[1] || "",
  };
}

function collectFrontendDeps() {
  const raw = read(repo("frontend", "package.json"));
  if (!raw) return null;
  try {
    const pkg = JSON.parse(raw);
    return { deps: pkg.dependencies || {}, dev: pkg.devDependencies || {} };
  } catch {
    return null;
  }
}

function collectBackendDeps() {
  const raw = read(repo("backend", "requirements.txt"));
  if (!raw) return [];
  return raw
    .split(/\r?\n/)
    .map((l) => l.replace(/#.*$/, "").trim())
    .filter(Boolean)
    .map((l) => {
      const m = l.match(/^([A-Za-z0-9_.\-]+(?:\[[^\]]+\])?)==([^\s]+)/);
      return m ? { name: m[1], version: m[2] } : null;
    })
    .filter(Boolean);
}

function collectRoutes() {
  const dir = repo("backend", "app");
  let files;
  try {
    files = readdirSync(dir).filter((f) => f.endsWith(".py"));
  } catch {
    return [];
  }
  const routes = [];
  for (const file of files) {
    const src = read(join(dir, file)) || "";
    const prefix = (src.match(/APIRouter\([^)]*prefix\s*=\s*["']([^"']*)["']/) || [])[1] || "";
    const re = /@(?:app|router)\.(get|post|put|patch|delete)\(\s*["']([^"']*)["']/g;
    let m;
    while ((m = re.exec(src))) {
      const path = (prefix + m[2]) || "/";
      routes.push({ method: m[1].toUpperCase(), path, module: file });
    }
  }
  routes.sort(
    (a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method),
  );
  return routes;
}

function collectModels() {
  const src = read(repo("backend", "app", "models.py"));
  if (!src) return [];
  const models = [];
  const classRe = /class\s+(\w+)\(Base\):/g;
  const marks = [];
  let m;
  while ((m = classRe.exec(src))) marks.push({ name: m[1], at: m.index });
  for (let i = 0; i < marks.length; i++) {
    const body = src.slice(marks[i].at, marks[i + 1] ? marks[i + 1].at : undefined);
    const table = (body.match(/__tablename__\s*=\s*["'](\w+)["']/) || [])[1] || "—";
    models.push({ model: marks[i].name, table });
  }
  return models;
}

function collectMigrations() {
  const dir = repo("backend", "alembic", "versions");
  let files;
  try {
    files = readdirSync(dir).filter((f) => f.endsWith(".py") && f !== "__init__.py");
  } catch {
    return { count: 0, head: null };
  }
  files.sort();
  return { count: files.length, head: files[files.length - 1] || null };
}

function collectSeed() {
  const src = read(repo("backend", "scripts", "seed_products.py"));
  if (!src) return { count: 0, categories: [] };
  const open = src.indexOf("[", src.indexOf("CATALOG"));
  const block = open >= 0 ? src.slice(open, src.indexOf("\n]", open)) : "";
  const count = (block.match(/\d+\)\s*,/g) || []).length;
  const categories = [
    ...new Set([...block.matchAll(/"([a-z][a-z0-9_]*)",\s*\d+\)/g)].map((x) => x[1])),
  ];
  return { count, categories };
}

function collectGit() {
  return {
    branch: git(["rev-parse", "--abbrev-ref", "HEAD"]),
    sha: git(["rev-parse", "--short", "HEAD"]),
    date: git(["log", "-1", "--format=%cd", "--date=short"]),
    subject: git(["log", "-1", "--format=%s"]),
  };
}

// ── Renderers (return the markdown body for one marker region) ──────────────

function renderStack(fe, be) {
  const lines = [];
  if (fe) {
    lines.push("**Frontend**", "", "| Package | Version |", "| --- | --- |");
    for (const [k, v] of Object.entries(fe.deps)) lines.push(`| ${k} | ${v} |`);
    const tool = ["vite", "typescript", "tailwindcss", "eslint"]
      .filter((t) => fe.dev[t])
      .map((t) => `${t} ${fe.dev[t]}`)
      .join(" · ");
    if (tool) lines.push("", `_Build tooling: ${tool}_`);
    lines.push("");
  }
  if (be && be.length) {
    lines.push("**Backend**", "", "| Package | Version |", "| --- | --- |");
    for (const d of be) lines.push(`| ${d.name} | ${d.version} |`);
  }
  return lines.join("\n").trim();
}

function renderRoutes(routes) {
  if (!routes.length) return "_No routes detected._";
  const out = ["| Method | Path | Module |", "| --- | --- | --- |"];
  for (const r of routes) out.push(`| ${r.method} | \`${r.path}\` | \`${r.module}\` |`);
  return out.join("\n");
}

function renderData(models, mig) {
  const out = [];
  if (models.length) {
    out.push("| Model | Table |", "| --- | --- |");
    for (const m of models) out.push(`| \`${m.model}\` | \`${m.table}\` |`);
  } else {
    out.push("_No models detected._");
  }
  out.push("");
  out.push(
    `Migrations: **${mig.count}**${mig.head ? ` · head \`${mig.head}\`` : ""}`,
  );
  return out.join("\n");
}

function renderSeed(seed) {
  if (!seed.count) return "_No seed catalog detected._";
  const cats = seed.categories.length ? ` across ${seed.categories.join(", ")}` : "";
  return `**${seed.count}** demo products${cats} (\`backend/scripts/seed_products.py\`).`;
}

function renderState(meta, g) {
  const commit = g.sha
    ? `\`${g.sha}\`${g.date ? ` (${g.date})` : ""}${g.subject ? ` — ${g.subject}` : ""}`
    : "_no commits_";
  return [
    `- **App:** ${meta.pageTitle || meta.apiTitle || "—"}`,
    `- **API:** ${meta.apiTitle || "—"}${meta.apiVersion ? ` v${meta.apiVersion}` : ""}`,
    `- **Branch:** ${g.branch || "—"}`,
    `- **Last commit:** ${commit}`,
  ].join("\n");
}

function renderSnapshot(meta, fe, be, routes, models, mig, seed, g) {
  const feList = fe ? Object.keys(fe.deps).join(", ") : "—";
  const beKey = be
    .filter((d) => /fastapi|sqlalchemy|alembic|celery|redis|anthropic|pydantic|authlib|stripe/i.test(d.name))
    .map((d) => `${d.name.replace(/\[.*\]/, "")} ${d.version}`)
    .join(", ");
  return [
    `- **App:** ${meta.pageTitle || "—"} — ${meta.description || ""}`.trim(),
    `- **API:** ${meta.apiTitle || "—"}${meta.apiVersion ? ` v${meta.apiVersion}` : ""} · **${routes.length}** routes`,
    `- **Frontend deps:** ${feList}`,
    `- **Backend (key):** ${beKey || "—"}`,
    `- **Models:** ${models.map((m) => m.model).join(", ") || "—"}`,
    `- **Migrations:** ${mig.count}${mig.head ? ` (head \`${mig.head}\`)` : ""}`,
    `- **Seed catalog:** ${seed.count} products${seed.categories.length ? ` (${seed.categories.join(", ")})` : ""}`,
    `- **Git:** ${g.branch || "—"} @ ${g.sha || "—"}${g.date ? ` (${g.date})` : ""}`,
  ].join("\n");
}

// ── Splice + write ─────────────────────────────────────────────────────────

function splice(content, key, body) {
  const start = `<!-- SYNC:${key}:start -->`;
  const end = `<!-- SYNC:${key}:end -->`;
  const re = new RegExp(`${start}[\\s\\S]*?${end}`);
  const block = `${start}\n${body}\n${end}`;
  return re.test(content) ? content.replace(re, block) : content;
}

function writeIfChanged(path, next) {
  if (read(path) === next) return false;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, next, "utf8");
  return true;
}

// ── Templates (used only when the target file doesn't exist yet) ────────────

function readmeTemplate() {
  return `# WasItCheaper

> Every price has a past.

WasItCheaper tracks the price of anything you paste — see its full price history,
whether it's ever been cheaper, and get a buy-or-wait verdict. A portfolio-grade
full-stack app: a FastAPI + PostgreSQL backend with Celery-scheduled scraping and
a deterministic deal-scoring engine, and a React + Vite SPA with a retro
Windows-95 desktop UI.

<!-- SYNC:note:start -->
<!-- SYNC:note:end -->

## Stack

<!-- SYNC:stack:start -->
<!-- SYNC:stack:end -->

## API surface

<!-- SYNC:api:start -->
<!-- SYNC:api:end -->

## Data model

<!-- SYNC:data:start -->
<!-- SYNC:data:end -->

## Demo catalog

<!-- SYNC:seed:start -->
<!-- SYNC:seed:end -->

## Current state

<!-- SYNC:state:start -->
<!-- SYNC:state:end -->

## Development

Backend + workers run via Docker Compose (Postgres, Redis, API, Celery worker, Celery beat):

\`\`\`bash
docker compose up            # bring up the full stack
docker compose exec backend python -m scripts.seed_products   # seed the demo catalog
\`\`\`

Frontend:

\`\`\`bash
cd frontend
npm install
npm run dev                  # http://localhost:5173  (API at http://localhost:8000)
\`\`\`

---

_Sections marked with \`SYNC\` comments above are generated by
\`scripts/sync-docs.mjs\` from the live codebase. Edit the prose around them freely —
it is preserved. Run \`node scripts/sync-docs.mjs\` to refresh manually._
`;
}

function snapshotTemplate() {
  return `---
name: project-snapshot
description: Auto-generated snapshot of the live codebase (stack, API, models, migrations, seed) — machine-maintained, refreshed when Claude finishes a turn
metadata:
  type: project
  generated: true
---

> Auto-generated by \`scripts/sync-docs.mjs\`. The block between the SYNC
> markers is overwritten on every run — do not hand-edit it. Narrative and
> the *why* behind decisions live in [[project_stack_upgrade]], not here.

<!-- SYNC:snapshot:start -->
<!-- SYNC:snapshot:end -->
`;
}

// ── Main ───────────────────────────────────────────────────────────────────

function main() {
  const meta = collectMeta();
  const fe = collectFrontendDeps();
  const be = collectBackendDeps();
  const routes = collectRoutes();
  const models = collectModels();
  const mig = collectMigrations();
  const seed = collectSeed();
  const g = collectGit();

  const note = `_Live snapshot of the codebase — auto-generated, do not hand-edit the \`SYNC\` regions. Last commit \`${g.sha || "—"}\`${g.date ? ` (${g.date})` : ""}._`;

  const changed = [];

  // README (repo)
  const readmePath = repo("README.md");
  let readme = read(readmePath) ?? readmeTemplate();
  readme = splice(readme, "note", note);
  readme = splice(readme, "stack", renderStack(fe, be));
  readme = splice(readme, "api", renderRoutes(routes));
  readme = splice(readme, "data", renderData(models, mig));
  readme = splice(readme, "seed", renderSeed(seed));
  readme = splice(readme, "state", renderState(meta, g));
  if (writeIfChanged(readmePath, readme)) changed.push("README.md");

  // Memory snapshot (dedicated file, outside the repo)
  if (MEMORY_DIR && existsSync(MEMORY_DIR)) {
    const snapPath = join(MEMORY_DIR, "project-snapshot.md");
    let snap = read(snapPath) ?? snapshotTemplate();
    snap = splice(snap, "snapshot", renderSnapshot(meta, fe, be, routes, models, mig, seed, g));
    if (writeIfChanged(snapPath, snap)) changed.push("project-snapshot.md");
  }

  console.log(
    changed.length
      ? `sync-docs: updated ${changed.join(", ")}`
      : "sync-docs: no changes",
  );
}

try {
  main();
} catch (err) {
  console.error("sync-docs: skipped —", err && err.message ? err.message : err);
}
process.exit(0);
