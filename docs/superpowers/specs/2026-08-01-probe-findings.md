# Probe Run — Findings

**Date:** 2026-08-01
**Command:** `python -m scripts.probe_urls` (two runs, 9 URLs total)
**Products successfully extracted: 0**

---

## Headline

Nine URLs, zero products. But the run does **not** support the conclusion "extraction is broken," because **four of the nine URLs were bad links of my own choosing**, and the parser was never handed a real product page. The extractor remains unproven — success criterion #3 is still unmet.

The run did establish three things solidly: the probe harness works, bot-wall detection is correct, and three major retailers definitively block direct fetching.

## Full results

| URL | Outcome | What it actually tells us |
|---|---|---|
| newegg.com | `bot_wall` | **Genuine block** — Cloudflare challenge, verified |
| walmart.com | `bot_wall` | **Genuine block** — PerimeterX, verified |
| bhphotovideo.com | `http_error` 403 | **Genuine block** |
| rei.com | `error` ReadTimeout | Inconclusive — 15s timeout hit |
| bestbuy.com | `error` ReadTimeout | Inconclusive — 15s timeout hit |
| amazon.com | `http_error` 404 | **Bad URL (mine)** — tests nothing |
| taylorstitch.com | `http_error` 404 | **Bad URL (mine)** — tests nothing |
| us.gymshark.com | `ssrf_blocked` | **Bad hostname (mine)** — DNS did not resolve |
| allbirds.com | `no_product` | **Bad URL (mine)** — redirected to a collection page |

Scoring honestly: 3 genuine blocks, 2 inconclusive timeouts, 4 self-inflicted.

## What was actually learned

**1. Big-box blocking is confirmed, with mechanisms identified.**
Walmart serves a PerimeterX interstitial (`<div id="px-captcha">`, title `Robot or human?`). Newegg serves a Cloudflare challenge (`/cdn-cgi/challenge-platform`, title `Are you a human?`). B&H returns a bare 403. These are not transient. Both challenge pages are now committed as reviewed regression fixtures.

**2. Bot-wall detection is correct — verified, not assumed.**
Both `bot_wall` verdicts were checked by reading the captured HTML rather than trusting the classifier. Both are real interstitials with no product markup.

**3. The secondary heuristic in `_looks_bot_walled` is weaker than specified.**
Walmart's challenge page is **15,562 bytes — above the 15,000 `_CHALLENGE_MAX_BYTES` gate** — and its title `Robot or human?` matched none of the configured patterns. It was caught **only** by the `px-captcha` vendor marker. The size+title rule contributed nothing on the one page that most needed it. Vendor markers are carrying the entire detection.

**4. The 2 MB fetch cap is closer to binding than expected.**
The Allbirds page is ~1.99 MB — inside `fetch_max_bytes = 2_000_000`, but with under 0.5% headroom. Modern JS-heavy storefronts are at the edge of this limit today and will cross it.

**5. `fetch_timeout = 15.0` produced two inconclusive results.**
REI and Best Buy both hit it. Whether that is tarpitting or genuine slowness is unresolved. A diagnostic probe should use a longer timeout than the production recheck path.

**6. Client-side rendering is a category we had not accounted for.**
Allbirds' full page contains only `CollectionPage` and `FAQPage` JSON-LD — no `Product`, and no `og:price`. Even fetched whole, there is nothing server-side to extract. Any store rendering product data in JavaScript defeats *both* the structured-data path and the LLM fallback, because the fallback reads the same HTML. This is a distinct failure class from blocking and neither planned mitigation addresses it.

## What was NOT learned

**Whether the extractor works on real product markup.** Not one valid product page reached the parser. Every JSON-LD, Open Graph, and microdata path remains verified only against hand-written fixtures.

## Immediate blocker

**Valid product URLs are needed.** Group C in `scripts/probe_urls.txt` is still empty, and my curated Groups A and B proved unreliable — I picked dead links and mislabeled three defended retailers as "scraper-friendly." Real URLs from the person who wants the products tracked are worth more than any list I can assemble.

## Recommendations for 1b

1. **Get real URLs first.** Everything else is speculation until the parser sees one real product page.
2. **Raise the probe's timeout** above the production 15s so timeouts stop being inconclusive.
3. ~~**Strengthen the challenge-title fallback**~~ — **DONE 2026-08-01.** Size gate raised 15,000 → 100,000 bytes; title patterns extended from 4 to 9 with phrases observed in the wild (`robot or human`, `just a moment`, `checking your browser`, `verifying you are human`, `pardon our interruption`). Both captured interstitials are now detected by the title rule *independently* of their vendor marker, so a vendor shipping an unfamiliar marker no longer slips through. Generic wording (`security check`, `verification`) was deliberately excluded — it appears on legitimate checkout and account pages.
4. **Do not buy a scraping API yet.** Blocking is confirmed for three retailers, but with the parser still unproven, spending money would fix the second problem while the first is unmeasured.
5. **Treat client-side rendering as its own decision.** If the stores that matter render prices in JS, the choice is headless-browser rendering or narrowing the supported-retailer claim — and the LLM fallback does not help either way. This should be settled before the Gemini migration, since it may change what that migration is worth.
