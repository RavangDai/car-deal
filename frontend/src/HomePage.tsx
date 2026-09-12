// frontend/src/HomePage.tsx
// The marketing page. A SHOWCASE, not a dashboard.
//
// What was removed, and why:
//   · the sortable deal index (filter bar + 24 expandable rows) — that is
//     app furniture. It made the landing page a worse version of the
//     dashboard, and every row independently fetched its own 90-day history
//     for a sparkline, so it was also the page's entire request budget.
//     It now lives one click away, behind "See every tracked deal".
//   · the ScoreComposition analytics panel and the 01/02/03 step list —
//     both folded into <ScoreModel />, which says the same thing once.
//   · the legacy-vs-us manifesto — its one good line survives in the CTA.
//
// What is left is the argument in order: the claim (hero), the evidence
// (real products, fanned), the method (the score), the ask (CTA).
import { useEffect, useMemo, useState } from "react";
import { useProducts, usePriceHistory } from "./hooks";
import { formatMoney } from "./format";
import { Arrow, Button, Delta, Panel, Reveal, Stamp } from "./primitives";
import { PriceHistoryChart, EmptyAxis } from "./charts";
import { ScoreExplainer } from "./ScoreExplainer";
import { SiteHeader } from "./ui/SiteHeader";
import { ProductCard } from "./ui/ProductCard";
import { ProductImage } from "./ProductImage";
import { productImage } from "./images";
import { CATEGORIES } from "./taxonomy";
import { useReveal } from "./motion";
import Footer from "./Footer";
import type { Product } from "./api";

/** Filter pills over the feed. "For you" is the unfiltered default. */
const FEED_FILTERS: { key: string; label: string }[] = [
  { key: "", label: "For you" },
  // Only categories that actually have seeded data are offered. The taxonomy
  // has eight slugs but four of them are empty on a fresh install, and a
  // filter pill that always yields "nothing here" is worse than no pill.
  ...CATEGORIES.filter((c) => ["electronics", "gaming", "home", "kitchen"].includes(c.slug))
    .map((c) => ({ key: c.slug, label: c.label })),
];

export default function HomePage({
  onGetStarted,
  onBrowse,
}: {
  onGetStarted: (url?: string) => void;
  /** Enter the browse-only dashboard without an account. */
  onBrowse: () => void;
}) {
  const [pasteUrl, setPasteUrl] = useState("");
  const [featuredIdx, setFeaturedIdx] = useState(0);
  const [filter, setFilter] = useState("");
  const [sort, setSort] = useState<"deal_score" | "newest">("deal_score");

  // 12 is a showcase budget, not a feed budget: the fan shows at most a
  // handful at a time and only the featured product fetches its history.
  const productsQuery = useProducts({ sort, category: filter || undefined, limit: 24 });
  const products = useMemo(() => productsQuery.data ?? [], [productsQuery.data]);
  const loading = productsQuery.isLoading;

  // The hero proves the claim with a real product: the highest-scoring ones,
  // rotating. Sorted by deal_score server-side, so "top" is the API's
  // ranking, not a local re-derivation.
  const featuredPool = useMemo(
    () => products.filter((p) => p.deal_score != null && p.median_90d != null).slice(0, 3),
    [products],
  );
  const featured: Product | undefined =
    featuredPool[featuredIdx % Math.max(featuredPool.length, 1)];

  useEffect(() => {
    if (featuredPool.length < 2) return;
    const t = setInterval(
      () => setFeaturedIdx((i) => (i + 1) % featuredPool.length),
      7000,
    );
    return () => clearInterval(t);
  }, [featuredPool.length]);

  const featuredHistory = usePriceHistory(featured?.id ?? null, "90");

  // The feed does NOT filter to scored products. dealClaims.ts decides what
  // each card may claim, and a young product honestly labelled "9 days to a
  // score" is better than an empty grid on a fresh install.
  const feedProducts = useMemo(() => products.slice(0, 12), [products]);

  const dealsRef = useReveal<HTMLDivElement>({ y: 40, stagger: 0.09 });
  const ctaRef = useReveal<HTMLDivElement>({ y: 46, stagger: 0.08, blur: 10 });

  function handlePasteSubmit(e: React.FormEvent) {
    e.preventDefault();
    onGetStarted(pasteUrl.trim() || undefined);
  }

  return (
    <div className="rv-catalog rv-page min-h-screen">
      <style>{STYLES}</style>

      <SiteHeader
        active="discover"
        onSignIn={() => onGetStarted()}
        onCreateAlert={() => onGetStarted()}
        onSaved={() => onGetStarted()}
      />

      {/* ── HERO — a compact navy banner, not an editorial spread. On-mount
             reveal only: a scroll-gated hero ships blank in headless
             renders, which is why this never uses a ScrollTrigger. ── */}
      <section className="rv-band">
        <Reveal className="rv-hero2">
          <div className="rv-hero2-copy">
            <h1 className="rv-display rv-hero2-headline">
              A sharper eye for better deals.
            </h1>
            <p className="rv-hero2-sub">
              Compare prices. Track drops. Shop confidently.
            </p>

            <div className="rv-hero2-actions">
              <a href="#finds" className="rv-hero2-cta">
                Explore deals
                <span className="rv-hero2-cta-arrow" aria-hidden="true">&rsaquo;</span>
              </a>
              <button
                type="button"
                className="rv-hero2-secondary"
                onClick={() => document.getElementById("track-url")?.focus()}
              >
                Track a product
              </button>
            </div>

            {/* The paste box is the app's primary entry point, so it stays
                above the fold rather than moving to a separate page. */}
            <form onSubmit={handlePasteSubmit} className="rv-hero2-form">
              <input
                id="track-url"
                type="url"
                required
                value={pasteUrl}
                onChange={(e) => setPasteUrl(e.target.value)}
                placeholder="Paste a product URL"
                className="rv-hero2-input"
                aria-label="Product URL to track"
              />
              <button type="submit" className="rv-hero2-submit">Track it</button>
            </form>
          </div>

          <div className="rv-hero2-art" aria-hidden={featured ? undefined : true}>
            <span className="rv-hero2-ellipse" />
            {featured && (
              <a className="rv-hero2-shot" href={`#/product/${featured.id}`}>
                <ProductImage
                  image={productImage(featured.image_url, featured.title ?? featured.domain, featured.category)}
                  ratio="1 / 1"
                />
              </a>
            )}
            <span className="rv-hero2-tag">Worth a closer look</span>
          </div>
        </Reveal>
      </section>

      {/* ── THE FEED — an aligned grid, replacing the tilted GSAP fan.
             Cards are NOT pre-filtered to scored products; dealClaims.ts
             decides per card what may honestly be claimed. ── */}
      <section className="rv-band" id="finds" data-rv-section="deals">
        <div className="rv-finds" ref={dealsRef}>
          <header className="rv-finds-head">
            <h2 className="rv-display rv-finds-title" data-reveal>Today&rsquo;s top finds</h2>

            <div className="rv-finds-pills" data-reveal role="group" aria-label="Filter by category">
              {FEED_FILTERS.map((f) => (
                <button
                  key={f.key || "all"}
                  type="button"
                  className={`rv-pill${filter === f.key ? " is-active" : ""}`}
                  aria-pressed={filter === f.key}
                  onClick={() => setFilter(f.key)}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <label className="rv-finds-sort" data-reveal>
              <span className="rv-sr-only">Sort products</span>
              <select
                className="rv-select"
                value={sort}
                onChange={(e) => setSort(e.target.value as "deal_score" | "newest")}
              >
                {/* Only what the API actually offers. There is no view or
                    click data, so a "Trending" option would be invented. */}
                <option value="deal_score">Best scored</option>
                <option value="newest">Newest</option>
              </select>
            </label>
          </header>

          {loading ? (
            <div className="rv-finds-loading">
              <EmptyAxis width={900} height={200} label="Loading tracked products" />
            </div>
          ) : feedProducts.length > 0 ? (
            <div className="rv-pgrid" data-reveal>
              {feedProducts.map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  // Saving a product creates a Watch, which needs a session.
                  // A visitor on the marketing page has none, so send them to
                  // sign-in rather than firing a request that can only 401.
                  onToggleSave={() => onGetStarted()}
                />
              ))}
            </div>
          ) : (
            <p className="rv-finds-empty">
              {filter
                ? "Nothing tracked in this category yet. Try another, or paste a product link above."
                : "Nothing tracked yet. Paste a product link above and it appears here."}
            </p>
          )}

          <div className="rv-finds-foot" data-reveal>
            <Button variant="ghost" onClick={onBrowse}>
              <span>See every tracked deal</span>
              <Arrow size={14} />
            </Button>
          </div>
        </div>
      </section>

      {/* ── PROOF — the featured product's real recorded history. Moved
             below the feed: the grid now carries the top of the page, and
             this is the evidence behind it. It is also the only surviving
             consumer of usePriceHistory + PriceHistoryChart. ── */}
      <section className="rv-band">
        <Reveal className="rv-proof2">
          <Panel label="Today's proof">
            <FeaturedProof
              product={featured}
              points={featuredHistory.data?.points ?? []}
              loading={loading || featuredHistory.isLoading}
              count={featuredPool.length}
              activeIdx={featuredIdx % Math.max(featuredPool.length, 1)}
              onPick={setFeaturedIdx}
            />
          </Panel>
        </Reveal>
      </section>

      {/* ── METHOD ── */}
      <ScoreExplainer />

      {/* ── CTA — carries the surviving line from the old manifesto. ── */}
      <section className="rv-cta" data-rv-section="cta">
        <div className="rv-cta-inner" ref={ctaRef}>
          <h2 className="rv-display rv-cta-headline" data-reveal>
            Most deal sites are built for sellers.
            <br />
            This one keeps the <em>receipts</em>.
          </h2>
          <p className="rv-cta-sub" data-reveal>
            Track your first product in about ten seconds. No card, no extension, no
            countdown timer with nothing behind it.
          </p>
          <div className="rv-cta-actions" data-reveal>
            <Button size="xl" onClick={() => onGetStarted()}>
              <span>Start tracking &mdash; it&rsquo;s free</span>
              <Arrow size={16} />
            </Button>
            <Button as="a" href="#how" variant="ghost-light" size="xl">
              How the score works
            </Button>
          </div>
        </div>
      </section>

      <Footer onGetStarted={() => onGetStarted()} />
    </div>
  );
}

/* ── HERO PROOF ───────────────────────────────────────────── */

// The hero's argument, made with a real product rather than an illustration:
// here is the price now, here is what it normally costs, and here is the
// chart that settles it.
function FeaturedProof({
  product,
  points,
  loading,
  count,
  activeIdx,
  onPick,
}: {
  product: Product | undefined;
  points: { t: string; price: number; in_stock?: boolean }[];
  loading: boolean;
  count: number;
  activeIdx: number;
  onPick: (i: number) => void;
}) {
  if (loading) {
    return (
      <Panel label="Today's proof">
        <EmptyAxis width={900} height={300} label="Loading price history" />
      </Panel>
    );
  }

  if (!product) {
    return (
      <Panel label="Today's proof">
        <EmptyAxis width={900} height={300} label="No price history recorded yet" />
        <p className="rv-proof-empty">
          Nothing is tracked yet. Paste a product link and this chart fills in as its
          history builds.
        </p>
      </Panel>
    );
  }

  const currency = product.currency ?? "USD";
  const delta = product.stats?.discount_vs_median_pct ?? null;
  const saving =
    product.median_90d != null && product.latest_price != null
      ? Number(product.median_90d) - Number(product.latest_price)
      : null;

  return (
    <Panel
      label="Today's proof"
      aside={
        count > 1 ? (
          <span className="rv-proof-dots">
            {Array.from({ length: count }, (_, i) => (
              <button
                key={i}
                type="button"
                className={`rv-proof-dot${i === activeIdx ? " is-active" : ""}`}
                onClick={() => onPick(i)}
                aria-label={`Show product ${i + 1} of ${count}`}
                aria-current={i === activeIdx}
              />
            ))}
          </span>
        ) : undefined
      }
    >
      <div className="rv-proof-head">
        <div className="rv-proof-id">
          <a href={`#/product/${product.id}`} className="rv-proof-title">
            {product.title ?? product.domain}
          </a>
          <p className="rv-proof-meta rv-num">
            {product.domain} &middot; {product.stats?.coverage_days ?? 0} days of history
            &middot; {product.stats?.n_points ?? 0} price checks
          </p>
        </div>
        <div className="rv-proof-stamps">
          {product.is_lowest_ever && <Stamp tone="signal">Lowest ever recorded</Stamp>}
          {product.deal_score != null && (
            <Stamp tone="quiet">
              Score <b className="rv-num">{Math.round(product.deal_score)}</b>/100
            </Stamp>
          )}
        </div>
      </div>

      <div className="rv-proof-figures">
        <Delta pct={delta} size="xl" />
        <div className="rv-proof-prices">
          <span className="rv-proof-now rv-num">
            {product.latest_price != null
              ? formatMoney(product.latest_price, currency)
              : "—"}
          </span>
          {product.median_90d != null && (
            <span className="rv-proof-was rv-num">
              <s>{formatMoney(product.median_90d, currency)}</s> usual
            </span>
          )}
          {saving != null && saving > 0 && (
            <span className="rv-proof-saving rv-num">
              {formatMoney(saving, currency)} below its normal price
            </span>
          )}
        </div>
      </div>

      <div className="rv-proof-chart">
        <PriceHistoryChart
          points={points}
          median90d={product.median_90d}
          minEver={product.min_ever}
          currency={currency}
          variant="hero"
        />
      </div>
    </Panel>
  );
}

const STYLES = `
  /* ── DealOwl bands ───────────────────────────────────────────────────
     One wrapper for every section: the measure, the gutter, and the
     rhythm in one place, so a band cannot quietly add its own padding on
     top of --space-section the way the old sections did. That stacking is
     what produced 160-288px of dead space between adjacent bands. */
  .rv-band {
    max-width: var(--measure);
    margin: 0 auto;
    padding: 0 var(--gutter);
  }
  .rv-band + .rv-band { margin-top: var(--space-section-tight); }
  .rv-band:first-of-type { margin-top: 20px; }

  /* ── Hero — a compact navy banner ──────────────────────────────────── */
  .rv-hero2 {
    position: relative;
    display: grid;
    grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr);
    align-items: center;
    gap: 24px;
    min-height: 320px;
    padding: 40px 44px;
    border-radius: var(--r-xl);
    background: var(--navy);
    color: var(--on-navy);
    overflow: hidden;
  }
  .rv-hero2-copy { min-width: 0; }
  .rv-hero2-headline {
    margin: 0;
    font-size: clamp(34px, 5vw, 60px);
    line-height: 1.02;
    letter-spacing: -0.03em;
    color: var(--on-navy);
    max-width: 13ch;
  }
  .rv-hero2-sub {
    margin: 14px 0 0;
    font-size: clamp(15px, 1.6vw, 18px);
    /* NOT --ink-muted: that is 2.87:1 on navy. This token exists for
       exactly this surface and measures 11.97:1. */
    color: var(--on-navy-muted);
  }
  .rv-hero2-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 14px; margin-top: 24px; }
  .rv-hero2-cta {
    display: inline-flex; align-items: center; gap: 8px;
    border-radius: var(--r-pill);
    background: var(--mint); color: var(--navy);
    padding: 13px 26px;
    font-size: 15.5px; font-weight: 700; text-decoration: none;
    transition: background-color var(--dur-fast) var(--ease-out-soft);
  }
  .rv-hero2-cta:hover { background: var(--mint-deep); }
  .rv-hero2-cta-arrow { font-size: 20px; line-height: 1; }
  .rv-hero2-secondary {
    border: 1px solid rgba(255,255,255,.28);
    border-radius: var(--r-pill);
    background: transparent; color: var(--on-navy);
    padding: 12px 22px;
    font-family: var(--font-sans); font-size: 15px; font-weight: 600;
    cursor: pointer;
    transition: background-color var(--dur-fast) var(--ease-out-soft),
                border-color var(--dur-fast) var(--ease-out-soft);
  }
  .rv-hero2-secondary:hover { background: rgba(255,255,255,.08); border-color: rgba(255,255,255,.48); }

  .rv-hero2-form { display: flex; gap: 10px; margin-top: 20px; max-width: 460px; }
  .rv-hero2-input {
    flex: 1; min-width: 0;
    height: 46px; padding: 0 16px;
    border: 1px solid rgba(255,255,255,.24);
    border-radius: var(--r-pill);
    background: rgba(255,255,255,.06);
    color: var(--on-navy);
    font-family: var(--font-sans); font-size: 14.5px;
  }
  .rv-hero2-input::placeholder { color: rgba(255,255,255,.55); }
  .rv-hero2-input:focus { outline: none; border-color: var(--mint); background: rgba(255,255,255,.1); }
  .rv-hero2-submit {
    flex: none; height: 46px; padding: 0 22px;
    border: 0; border-radius: var(--r-pill);
    background: var(--paper); color: var(--navy);
    font-family: var(--font-sans); font-size: 14.5px; font-weight: 700;
    cursor: pointer;
  }
  .rv-hero2-submit:hover { background: var(--mint); }

  .rv-hero2-art { position: relative; display: grid; place-items: center; min-height: 240px; }
  .rv-hero2-ellipse {
    position: absolute; inset: 12% 8%;
    border-radius: 50%;
    background: var(--mint);
    opacity: .92;
  }
  .rv-hero2-shot { position: relative; display: block; width: min(74%, 300px); }
  /* ProductImage paints its own pale plate and inset ring so product photos
     sit on something in a grid. Over the hero's mint ellipse that plate is a
     white rectangle covering the artwork, so it is stripped here. */
  .rv-hero2-shot .wicimg { background: transparent; box-shadow: none; }
  .rv-hero2-shot img { object-fit: contain; }
  .rv-hero2-tag {
    position: absolute; top: 4px; right: 0;
    border-radius: var(--r-pill);
    background: var(--mint); color: var(--navy);
    padding: 6px 14px;
    font-size: 12.5px; font-weight: 700; white-space: nowrap;
  }

  /* ── The feed ──────────────────────────────────────────────────────── */
  .rv-finds-head {
    display: flex; align-items: center; flex-wrap: wrap; gap: 14px;
    margin-bottom: 20px;
  }
  .rv-finds-title { margin: 0; font-size: clamp(24px, 3vw, 32px); letter-spacing: -0.025em; }
  .rv-finds-pills { display: flex; flex-wrap: wrap; gap: 8px; flex: 1; min-width: 0; }
  .rv-finds-sort { margin-left: auto; flex: none; }

  .rv-pill {
    border: 1px solid transparent; border-radius: var(--r-pill);
    background: var(--paper-deep); color: var(--ink-muted);
    padding: 7px 16px;
    font-family: var(--font-sans); font-size: 13.5px; font-weight: 600;
    cursor: pointer; white-space: nowrap;
    transition: background-color var(--dur-fast) var(--ease-out-soft),
                color var(--dur-fast) var(--ease-out-soft);
  }
  .rv-pill:hover { color: var(--ink); }
  /* Mint fill, navy label. Mint is 1.23:1 on this ground, so the fill alone
     carries no signal — the 13.5:1 label is what makes the state readable. */
  .rv-pill.is-active { background: var(--mint); color: var(--navy); }

  .rv-select {
    height: 40px; padding: 0 34px 0 14px;
    border: 1px solid var(--rule); border-radius: 10px;
    background: var(--paper); color: var(--ink);
    font-family: var(--font-sans); font-size: 13.5px; font-weight: 600;
    cursor: pointer;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2352627A' stroke-width='2' stroke-linecap='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 12px center;
  }
  .rv-select:focus-visible { outline: 2px solid var(--ink); outline-offset: 2px; }

  .rv-finds-loading, .rv-finds-empty {
    border: 1px solid var(--rule); border-radius: var(--r-card);
    background: var(--paper);
    padding: 40px 24px; text-align: center;
    color: var(--ink-muted); font-size: 14.5px;
  }
  .rv-finds-foot { display: flex; justify-content: center; margin-top: 24px; }

  .rv-proof2 { display: block; }

  @media (max-width: 900px) {
    .rv-hero2 {
      grid-template-columns: minmax(0, 1fr);
      padding: 28px 22px; min-height: 0; gap: 20px;
    }
    .rv-hero2-art { min-height: 200px; order: -1; }
    .rv-hero2-tag { top: 0; right: 4px; }
    .rv-hero2-form { max-width: none; }
    .rv-finds-sort { margin-left: 0; }
  }
  @media (max-width: 560px) {
    .rv-hero2-form { flex-direction: column; }
    .rv-hero2-submit { width: 100%; }
    .rv-finds-pills { flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; }
    .rv-finds-pills::-webkit-scrollbar { display: none; }
  }

  @media (prefers-reduced-motion: reduce) {
    .rv-hero2-cta, .rv-hero2-secondary, .rv-pill { transition: none; }
  }

  .rv-catalog { color: var(--ink); font-family: var(--font-sans); }

  /* ── Hero — thesis left, live proof right, both above the fold. ── */
  .rv-hero { padding: clamp(40px, 6vw, 84px) 0 var(--space-section-tight); }
  .rv-hero-inner {
    max-width: var(--measure); margin: 0 auto; padding: 0 var(--gutter);
    display: grid; grid-template-columns: minmax(0, 0.86fr) minmax(0, 1.14fr);
    gap: clamp(32px, 4.5vw, 64px); align-items: center;
  }
  .rv-hero-copy { min-width: 0; }
  .rv-hero-eyebrow { margin-bottom: 22px; }
  .rv-dot {
    width: 7px; height: 7px; border-radius: var(--r-pill);
    background: var(--green); flex: none;
    animation: rv-pulse 2.6s ease-in-out infinite;
  }
  @keyframes rv-pulse { 0%,100% { opacity: 1; } 50% { opacity: .35; } }
  .rv-hero-headline { font-size: clamp(42px, 5.6vw, 74px); margin: 0; }
  .rv-hero-lede {
    margin: 26px 0 0; font-size: clamp(15.5px, 1.35vw, 17.5px);
    line-height: 1.62; color: var(--ink-soft); max-width: 42ch;
  }

  .rv-paste-form { display: flex; gap: 10px; margin-top: 32px; max-width: 500px; }
  .rv-paste-input { flex: 1; min-width: 0; }
  .rv-paste-submit { flex: none; }
  .rv-paste-note { margin: 12px 0 0; font-size: 13px; color: var(--ink-muted); }

  /* ── Hero proof ── */
  .rv-proof { min-width: 0; }
  /* The hero proof nests a second, unlabelled Panel around FeaturedProof's
     own labelled one — a plain descendant selector would hit both
     .rv-panel-body divs, so this stays scoped to the outer one only. */
  .rv-proof > .rv-panel > .rv-panel-body { padding: clamp(18px, 2vw, 26px); }
  .rv-proof-empty { margin: 14px 0 0; font-size: 14px; color: var(--ink-muted); max-width: 52ch; }
  .rv-proof-dots { display: inline-flex; gap: 6px; }
  .rv-proof-dot {
    width: 20px; height: 3px; border-radius: var(--r-pill);
    background: var(--rule-strong); cursor: pointer; padding: 0; border: 0;
    transition: background-color var(--dur-mid) var(--ease-out-soft);
  }
  .rv-proof-dot.is-active { background: var(--ink); }

  .rv-proof-head {
    display: flex; align-items: flex-start; justify-content: space-between;
    gap: 20px; flex-wrap: wrap; margin-bottom: 20px;
  }
  .rv-proof-title {
    font-size: 20px; font-weight: 600; color: var(--ink); text-decoration: none;
    letter-spacing: -0.015em; display: block;
  }
  .rv-proof-title:hover { text-decoration: underline; text-underline-offset: 3px; }
  .rv-proof-meta { margin: 6px 0 0; font-size: 12px; color: var(--ink-muted); }
  .rv-proof-stamps { display: flex; gap: 8px; flex-wrap: wrap; }

  .rv-proof-figures {
    display: flex; align-items: center; gap: 32px; flex-wrap: wrap;
    padding-bottom: 24px; margin-bottom: 8px; border-bottom: 1px solid var(--rule);
  }
  .rv-proof-prices { display: flex; flex-direction: column; gap: 4px; }
  .rv-proof-now {
    font-size: clamp(30px, 4vw, 44px); font-weight: 600;
    letter-spacing: -0.03em; color: var(--ink);
  }
  .rv-proof-was { font-size: 14px; color: var(--ink-muted); }
  .rv-proof-was s { text-decoration-thickness: 1.5px; }
  .rv-proof-saving { font-size: 13px; color: var(--green-deep); font-weight: 500; }
  .rv-proof-chart {
    margin: 16px -10px -6px; padding: 8px 10px 0;
    border-radius: var(--r-md);
  }

  /* ── Evidence / fan ── */
  .rv-deals { padding: var(--space-section) 0; position: relative; }
  .rv-deals-inner { max-width: var(--measure); margin: 0 auto; padding: 0 var(--gutter); }
  .rv-deals-head {
    display: flex; align-items: flex-end; justify-content: space-between;
    gap: 32px; flex-wrap: wrap; margin-bottom: clamp(36px, 4.5vw, 60px);
  }
  .rv-deals-head-copy { min-width: 0; }
  .rv-deals-title { font-size: clamp(34px, 4.6vw, 58px); margin: 14px 0 0; }
  .rv-deals-sub {
    margin: 0; font-size: 15px; line-height: 1.6;
    color: var(--ink-muted); max-width: 34ch;
  }
  .rv-deals-loading, .rv-deals-empty {
    display: flex; align-items: center; justify-content: center;
    min-height: 18rem; color: var(--ink-muted); font-size: 15px; text-align: center;
  }
  .rv-deals-foot {
    display: flex; justify-content: center; margin-top: clamp(28px, 3.5vw, 44px);
  }

  /* ── CTA — the one full-bleed ink band on the page. ── */
  .rv-cta {
    background: var(--ink);
    padding: var(--space-section) 0;
    position: relative; overflow: hidden;
  }
  /* A light source on the dark band too, or it reads as a flat black hole
     between two lit surfaces. */
  .rv-cta::before {
    content: ""; position: absolute; inset: 0; pointer-events: none;
    background: radial-gradient(80% 60% at 50% 0%, rgba(255,255,255,.08), transparent 68%);
  }
  .rv-cta-inner {
    position: relative; max-width: 62rem; margin: 0 auto;
    padding: 0 var(--gutter); text-align: center;
  }
  .rv-cta-headline {
    font-size: clamp(34px, 5vw, 64px); margin: 0; color: var(--paper);
  }
  .rv-cta-sub {
    margin: 24px auto 0; max-width: 46ch; font-size: 16px; line-height: 1.6;
    color: rgba(244,243,239,.68);
  }
  .rv-cta-actions {
    display: flex; gap: 14px; justify-content: center; flex-wrap: wrap;
    margin-top: 38px;
  }
  .rv-cta .rv-btn-primary {
    background: var(--paper); color: var(--ink);
    box-shadow: var(--shadow-lg), inset 0 1px 0 rgba(255,255,255,.9);
  }
  .rv-cta .rv-btn-primary:hover:not(:disabled) { background: #fff; }
  .rv-cta .rv-btn-primary .rv-btn-well { background: rgba(27,26,22,.09); }
  .rv-cta .rv-btn-primary:hover:not(:disabled) .rv-btn-well { background: rgba(27,26,22,.15); }

  @media (max-width: 1000px) {
    .rv-hero-inner { grid-template-columns: minmax(0, 1fr); gap: 44px; }
    .rv-hero-headline { font-size: clamp(40px, 8vw, 56px); }
  }

  @media (max-width: 640px) {
    .rv-paste-form { flex-direction: column; }
    .rv-paste-submit { width: 100%; }
    .rv-proof-figures { gap: 18px; }
    .rv-deals-head { gap: 18px; }
    .rv-deals-sub { max-width: none; }
  }

  @media (prefers-reduced-motion: reduce) {
    .rv-dot { animation: none; }
  }
`;
