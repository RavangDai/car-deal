# Live Extraction Proving — Design

**Date:** 2026-08-01
**Status:** Awaiting review
**Sub-project:** 1 of 6 in the "make everything real" sequence

---

## Problem

WasItCheaper's extraction pipeline has never fetched a real product page.

Every test in `backend/tests/test_extraction_structured.py` runs against saved HTML fixtures. Every one of the 100 seeded demo products lives under the `.example` TLD with `status="demo"`, deliberately excluded from the recheck fan-out. The Claude extraction fallback has only ever run against a mocked client, because `anthropic_api_key` has never been set.

So the core claim of the product — "paste any product URL and we'll track its real price" — is unverified end to end. The deal math is exhaustively tested against synthetic histories; it has never scored a price the app itself observed on a real website.

This sub-project builds the instrument that tells us where the pipeline actually breaks, fixes what it finds, and converts those findings into permanent offline test coverage.

## Goals

1. Run the real `extract_product` path against live product URLs and produce a legible report of what works and what fails, by failure mode.
2. Fix the known false-positive bot-wall detection that would reject a large fraction of the legitimate web.
3. Enable the Claude extraction fallback for the first time, on a current model, with a token budget that won't truncate it.
4. Convert each live page into a checked-in fixture with an offline regression test, so live findings become permanent coverage without putting the network in CI.

## Non-goals

- **No deployment.** Fly.io is sub-project 6.
- **No paid scraping API.** If big-box retailers block direct fetching, this sub-project documents that; it does not spend money to solve it.
- **No pluggable fetch-backend abstraction.** Deliberately deferred — see *Deferred* below.
- **No changes to the demo seed data.** The 100 demo products stay, correctly labeled, per the decision to keep the deals feed from looking empty.
- **No changes to the deal math.** `dealmath.py` is out of scope entirely.

## Constraints

- Requires `ANTHROPIC_API_KEY` in `.env` (the user has agreed to add it).
- Target sites span two regimes: scraper-friendly (Shopify stores, B&H, Newegg, REI) and big-box (Amazon, Walmart, Best Buy, Target). The second group is expected to fail on direct fetch; that outcome is a finding, not a defect.
- The probe must not require Docker, Postgres, or Redis — see below.

---

## Component 1: The probe harness

**New file:** `backend/scripts/probe_urls.py`

A script, deliberately **not** a pytest test. A network-dependent test that goes red when a retailer has a bad afternoon trains the team to ignore red CI. This runs on demand and reports.

### Why it needs no infrastructure

`extract_product` depends only on `extraction.fetch`, `extraction.structured`, `extraction.llm`, and `app.settings`. Nothing in that path touches the database or Redis. The probe therefore runs against the existing venv with no containers up:

```bash
cd backend
.venv/Scripts/python.exe -m scripts.probe_urls
```

This matters because Docker is not currently running on the dev machine, and requiring it would add a failure mode unrelated to what we're measuring.

### Interface

| Flag | Default | Meaning |
|---|---|---|
| `--urls PATH` | `backend/scripts/probe_urls.txt` | Newline-delimited URL list; blank lines and `#` comments ignored |
| `--json PATH` | *(none)* | Also write results as JSON for diffing across runs |
| `--no-save-fixtures` | *(off)* | Skip writing captured HTML |
| `--timeout SECONDS` | `settings.fetch_timeout` | Per-URL fetch timeout override |

### Behavior

For each URL, run the true `extract_product` path and record one row. The probe **never propagates an exception** — every URL yields a row, including failures. Each row carries:

`url` · `outcome` · `strategy` · `title` · `price` · `currency` · `elapsed_ms` · `detail`

`outcome` is one of a fixed set, so results are countable across runs:

| Outcome | Meaning |
|---|---|
| `ok` | A valid product was extracted and passed `_validate` |
| `bot_wall` | Page identified as a challenge/interstitial (see Component 2) |
| `http_error` | `FetchError` with a status code — `detail` carries the code |
| `fetch_failed` | `FetchError` without a status (timeout, non-HTML content-type, redirect chain) |
| `ssrf_blocked` | `SsrfBlockedError` — should never fire for a legitimate retailer; if it does, that's a bug in host validation |
| `no_product` | Fetched and parsed fine, but neither structured data nor the LLM found a product |
| `validation_failed` | A product was extracted but failed `_validate` (implausible price, empty title, unknown currency) |

Output is an aligned table to stdout, followed by a per-outcome tally.

### Fixture capture

Unless `--no-save-fixtures` is passed, each successfully fetched page is written to:

```
backend/tests/fixtures/live/<domain>-<hash8>.html
```

where `domain` comes from `urlnorm.domain_of` and `hash8` is the first 8 characters of `urlnorm.url_hash(normalize_url(url))`. Reusing the existing URL-identity helpers keeps fixture naming consistent with how the app already identifies products, and the hash suffix prevents collisions when probing two products from the same retailer.

Alongside each HTML file, the probe writes a sidecar `<domain>-<hash8>.json` containing the values it actually extracted.

> **The sidecar is a draft, not an assertion.** It records what the parser produced, which is exactly what we're trying to verify. Every sidecar must be checked by a human against the real page before it is committed, or a wrong extraction gets enshrined as the expected result. This review step is mandatory and is called out again in Component 4.

---

## Component 2: Fix bot-wall detection

**File:** `backend/app/extraction/pipeline.py`

### The defect

```python
_BOT_WALL_MARKERS = ("cloudflare", "captcha", "access denied", ...)   # line 30
lowered = html[:5000].lower()                                          # line 55
return any(marker in lowered for marker in _BOT_WALL_MARKERS)
```

A very large fraction of the web loads an asset from `cdnjs.cloudflare.com`. That URL contains the literal substring `cloudflare`, usually inside `<head>`, therefore inside the first 5000 bytes. Those pages are rejected as bot-walled before parsing is ever attempted.

Against saved fixtures this never surfaced. Against the real web it is the single most likely cause of a "this site blocks us" report on a site that does not block us.

### The fix has two parts

**Part A — reorder: parse first, judge second.**

Both `extract_product` and `recheck_product` currently call `_looks_bot_walled` *before* `extract_structured`. Invert it: attempt structured extraction first, and if it yields a product that passes `_validate`, return it. A page we can extract a product from is definitionally not a bot wall, whatever its markup mentions.

Only on the no-product path do we ask "was this blocked, or just a page without structured data?" That distinction still matters, because `recheck_product` maps it to different `Product.status` / `consecutive_failures` accounting.

The bot-wall check must remain **before** the LLM fallback. Sending a Cloudflare challenge page to Claude costs money and returns nothing.

**Part B — replace generic substrings with specific signals.**

Evaluated only on the no-product path:

| Signal | Rationale |
|---|---|
| HTTP 403 / 429 | Already surfaced as `FetchError.status_code`; handled before HTML exists |
| `/cdn-cgi/challenge-platform`, `cf-browser-verification`, `cf_chl_opt` | Appear only on actual Cloudflare challenge pages, never in a CDN asset URL |
| `_Incapsula_Resource`, `px-captcha`, `distil_r_captcha` | Vendor-specific challenge markers |
| `<title>` matching `attention required`, `access denied`, `robot check`, `are you a human` | Challenge pages announce themselves in the title; product pages do not |
| Body smaller than `_CHALLENGE_MAX_BYTES = 15_000` | Challenge interstitials are small; real product pages are not |

The bare `cloudflare` marker is **removed**. It is fully covered by the two challenge-specific markers above, without the false positives.

Size alone never decides the outcome — a small page is treated as a bot wall only in combination with at least one marker above. A short, structured-data-free product page is `no_product`, not `bot_wall`.

`_looks_bot_walled(html: str) -> bool` keeps its current signature. Body size is `len(html)`, and HTTP status never reaches it — `safe_fetch` raises `FetchError` on 4xx/5xx before any HTML is returned, and both callers already branch on `status_code` there.

Title extraction uses a narrow regex rather than a full BeautifulSoup parse — on this path we may be looking at a multi-megabyte document and only need one tag.

### Residual risk, accepted

A page that has a captcha widget (e.g. a review form using reCAPTCHA) *and* no structured data *and* no LLM-extractable product could be labeled `bot_wall` instead of `no_product`. Both outcomes are failures that increment `consecutive_failures` identically; only the diagnostic label differs. Not worth further complexity.

---

## Component 3: LLM fallback — DEFERRED to its own sub-project

> **Status update (2026-08-01, after spec review):** the user is supplying a **Gemini** API key rather than an Anthropic one. That makes this component a provider migration (`client.py`, `extract.py`, `verdict.py`, the 9 tests in `test_ai.py`, `requirements.txt`, and the `settings.py` key/model fields) rather than a config change, so it is cut from this sub-project and becomes sub-project 1b.
>
> Components 1, 2, and 4 are provider-agnostic — the structured-data path involves no LLM at all — so they proceed now and are unaffected by which provider is chosen.
>
> The Opus-5 analysis below is **retained for reference only**. If the project ever returns to Anthropic, the `max_tokens` finding still applies. Under Gemini it is moot; the equivalent token-budget question must be re-derived against `google-genai`, and current Gemini model IDs must be verified against live documentation rather than written from memory.

**Files (when 1b runs):** `backend/app/settings.py`, `backend/app/ai/extract.py`

### Model IDs

`settings.py:55-56` pins both AI features to `claude-opus-4-8`. That model is still active and not deprecated, so nothing is broken today — but it is one generation behind. `claude-opus-5` is current at **identical pricing** ($5 / $25 per MTok), making this a free upgrade.

```
ai_extraction_model: "claude-opus-4-8"  →  "claude-opus-5"
ai_verdict_model:    "claude-opus-4-8"  →  "claude-opus-5"
```

### The token budget, which is load-bearing

`extract.py:43` sets `max_tokens=1024`.

On Opus 4.8, omitting the `thinking` parameter means no thinking, so 1024 tokens was entirely available for the extraction JSON. **On Opus 5, thinking is on by default**, and `max_tokens` caps thinking *plus* response text together. A 1024 budget can be consumed by thinking before the JSON is emitted, truncating the extraction.

Because the fallback has never run against a live key, this would surface as a mysterious first-run failure rather than a regression.

Fix: raise `max_tokens` to `4096`, and set `output_config={"effort": "low"}` on the extraction call.

`low` effort is the documented fit for "short, scoped tasks" — pulling a title and price out of cleaned page text is exactly that, and it is the cost-sensitive high-volume path (potentially once per product per day). The **verdict** call keeps the default (`high`) effort, because narrating deal statistics is the reasoning-heavy feature where Opus-tier capability earns its cost.

### Cost note (decision deferred to the user)

Extraction is mechanical and high-volume; Opus-tier is expensive for it. Haiku 4.5 is $1 / $5 per MTok — 5× cheaper. This spec defaults both features to `claude-opus-5` and revisits extraction's model only after the probe produces real usage numbers. Downgrading for cost is the user's call, not an assumption baked into the design.

### What does not change

`extract.py` already uses `client.messages.parse()` with a Pydantic `output_format`, which is the recommended structured-outputs pattern. Its error handling — re-raising `RateLimitError` so Celery's `autoretry_for` handles backoff, swallowing other `APIError`s — is correct. Neither is touched.

---

## Component 4: Regression tests from captured fixtures

**New file:** `backend/tests/test_extraction_live_fixtures.py`

Parametrized over every `(html, json)` pair in `backend/tests/fixtures/live/`. For each, assert that `extract_structured` returns the title, price, currency, and strategy recorded in the reviewed sidecar.

Properties this gives us:

- **No network in the suite.** These are offline tests over saved bytes.
- **Adding coverage requires no test code.** Drop in a reviewed fixture pair; the parametrization picks it up.
- **Real-world shapes, permanently.** Each fixture is a real retailer's real markup, preserved against future parser regressions.

Fixtures for pages that *failed* extraction are also committed, with a sidecar recording the expected failure outcome. A site we currently cannot parse is worth locking in as a known state — if a parser change starts extracting it, that's a deliberate win to observe, not a silent behavior change.

> Restating the gate from Component 1: **no sidecar is committed until a human has compared it against the live page.** The probe's output is the thing under test; treating it as ground truth without review would make the test suite agree with the parser by construction.

### Test-first sequence

The bot-wall fix is developed test-first. The reproducing case needs no live traffic — any HTML containing a `cdnjs.cloudflare.com` script tag plus valid JSON-LD demonstrates the false positive. That test is written and observed failing before `_looks_bot_walled` is touched.

---

## Component 5: The findings report

The actual deliverable of this sub-project. A short written summary covering:

- Per-outcome counts across the probed URL set
- Which retailers work via structured data, which need the LLM fallback, which are blocked
- Observed Claude API cost per extraction, measured rather than estimated
- A recommendation for sub-project 1b: fix specific parsers, buy a scraping API, or narrow the supported-retailer claim

This report is what makes the Phase 2 (deploy) configuration decisions evidence-based rather than speculative.

---

## Deferred, with reasons

**Pluggable fetch backends (`DirectFetch` / `ScraperBackend`).** Proposed during design, then cut. It is an abstraction built for a failure I have not yet measured. If the probe shows big-box retailers blocking direct fetches, that output is the evidence that earns the seam — and if they unexpectedly work, the abstraction would have been pure cost. Built in 1b if the data calls for it.

**Paid scraping API.** Costs money monthly and is only justified by probe results.

**`SECRET_KEY` rotation.** `.env` carries the literal placeholder `changeme-replace-with-a-real-secret-in-production`, which signs session JWTs. This is a genuine security issue but belongs to the deployment sub-project — it is harmless on localhost and must be fixed before anything is publicly reachable. **Flagged here so it is not lost.**

**README test-count correction (177 → 148) and gitignoring `docker-logs-*.csv`.** Trivial, unrelated to this work, and rolled into sub-project 5 to keep this change set focused.

---

## Success criteria

1. `python -m scripts.probe_urls` runs against a list of real URLs with no Docker, Postgres, or Redis, and emits a complete table with no unhandled exceptions.
2. A page containing a `cdnjs.cloudflare.com` reference and valid JSON-LD extracts successfully — currently it does not.
3. At least one live URL is extracted end to end via the structured-data path, proving that path against real markup. *(The fallback half of this criterion moves to 1b along with Component 3.)*
4. Every captured fixture has a human-reviewed sidecar and a passing offline regression test.
5. The existing 148 tests still pass.
6. The findings report exists and makes a concrete recommendation for 1b — including how many probed URLs returned `no_product`, since that count is the size of the problem the LLM fallback would need to solve and therefore the argument for or against spending effort on 1b at all.

## Risks

| Risk | Handling |
|---|---|
| Big-box retailers block datacenter and residential IPs alike | Expected; captured as a `bot_wall` / `http_error` finding rather than treated as a defect |
| Live pages change, making fixtures stale | Fixtures are snapshots by design — they test the parser, not the retailer. Staleness is acceptable and expected. |
| The Claude fallback costs more per extraction than projected | Measured in Component 5 before any deploy decision; `effort: "low"` plus structured-data-first ordering already minimize calls |
| Probing looks like abusive scraping | One request per URL, run manually, at human scale. No parallelism, no repetition. |
