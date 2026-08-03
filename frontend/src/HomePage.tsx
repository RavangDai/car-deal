import { useEffect, useMemo, useState } from "react";
import { useProducts, usePriceHistory } from "./hooks";
import { ProductImage } from "./ProductImage";
import { productImage } from "./images";
import { formatMoney } from "./format";
import { Arrow, Button, Delta, Panel, Reveal, Stamp, TopBar } from "./primitives";
import { PriceHistoryChart, Sparkline, EmptyAxis } from "./charts";
import { ScoreBar } from "./ScoreBar";
import { ScoreComposition } from "./ScoreComposition";
import Footer from "./Footer";
import type { Product } from "./api";

const NAV_LINKS: [string, string][] = [
  ["Today's deals", "deals"],
  ["How it works", "how"],
  ["Why us", "compare"],
];

const STEPS = [
  {
    title: "Paste any product link",
    body: "Amazon, Best Buy, Target, your favourite boutique. An extraction agent reads the page's structured data first, and falls back to an AI reader only when a site doesn't publish any.",
    foot: "Any store",
  },
  {
    title: "We check the price every day",
    body: "A scheduled job rechecks the price daily and appends to a history that is never overwritten. Yesterday's price cannot be quietly rewritten to make today's look better.",
    foot: "Append-only history",
  },
  {
    title: "The drop is scored against its own past",
    body: "Discount depth, historical rarity, pre-drop stability and freshness. A price raised and then “dropped” back to baseline never moved the median, so it scores near zero.",
    foot: "Deterministic scoring",
  },
];

const LEGACY = [
  "A struck-through “was £199” nobody ever paid",
  "No price history you can check",
  "Countdown timers with nothing behind them",
  "A discount you simply have to believe",
];

const WIC_WAY = [
  "A score built from 90 days of real prices",
  "Every “lowest ever” verified against the record",
  "The full price history, charted",
  "Built for shoppers, not sellers",
];

function agoLabel(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "—";
  const days = Math.max(0, Math.round((Date.now() - t) / 86_400_000));
  if (days < 1) return "tracked today";
  if (days === 1) return "tracked 1 day";
  return `tracked ${days}d`;
}

export default function HomePage({ onGetStarted }: { onGetStarted: (url?: string) => void }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [pasteUrl, setPasteUrl] = useState("");

  const [filterDomain, setFilterDomain] = useState<string>("all");
  const [filterMinScore, setFilterMinScore] = useState<number>(0);
  const [filterSort, setFilterSort] = useState<"deal_score" | "newest">("deal_score");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [featuredIdx, setFeaturedIdx] = useState(0);

  // Capped at 24: every row independently fetches its own 90-day history for
  // the sparkline, so the feed size is a request budget, not just page length.
  const productsQuery = useProducts({ sort: filterSort, limit: 24 });
  const products = useMemo(() => productsQuery.data ?? [], [productsQuery.data]);
  const loading = productsQuery.isLoading;

  const domains = useMemo(
    () => Array.from(new Set(products.map((p) => p.domain))).slice(0, 10),
    [products]
  );

  const filteredProducts = useMemo(
    () =>
      products.filter((p) => {
        if (filterDomain !== "all" && p.domain !== filterDomain) return false;
        if (filterMinScore > 0 && (p.deal_score == null || p.deal_score < filterMinScore)) return false;
        return true;
      }),
    [products, filterDomain, filterMinScore]
  );

  // The hero proves the claim with a real product: the highest-scoring ones,
  // rotating. Sorted by deal_score server-side, so "top" is the API's ranking,
  // not a local re-derivation.
  const featuredPool = useMemo(
    () => products.filter((p) => p.deal_score != null && p.median_90d != null).slice(0, 3),
    [products]
  );
  const featured: Product | undefined = featuredPool[featuredIdx % Math.max(featuredPool.length, 1)];

  useEffect(() => {
    if (featuredPool.length < 2) return;
    const t = setInterval(() => setFeaturedIdx((i) => (i + 1) % featuredPool.length), 7000);
    return () => clearInterval(t);
  }, [featuredPool.length]);

  const featuredHistory = usePriceHistory(featured?.id ?? null, "90");

  const lowestEverCount = products.filter((p) => p.is_lowest_ever).length;

  function handlePasteSubmit(e: React.FormEvent) {
    e.preventDefault();
    onGetStarted(pasteUrl.trim() || undefined);
  }

  return (
    <div className="rv-catalog rv-page min-h-screen">
      <style>{STYLES}</style>

      <TopBar
        links={NAV_LINKS.map(([l, h]) => ({ href: `#${h}`, label: l }))}
        status={products.length > 0 ? `${products.length} tracked` : undefined}
        actions={
          <Button variant="primary" size="sm" onClick={() => onGetStarted()}>
            Start tracking
          </Button>
        }
        menuOpen={mobileOpen}
        onToggleMenu={() => setMobileOpen((v) => !v)}
      />

      {/* ── HERO — thesis, then proof ─────────────────────── */}
      <section className="rv-hero">
        <div className="rv-hero-inner">
          <Reveal className="rv-hero-copy">
            <p className="rv-eyebrow rv-hero-eyebrow">
              <span className="rv-dot" aria-hidden="true" />
              {products.length > 0
                ? `Live · ${products.length} tracked · ${lowestEverCount} at lowest ever`
                : "Live · rechecking prices daily"}
            </p>
            <h1 className="rv-display rv-hero-headline">
              Every deal is a claim.<br />
              We keep the receipts.
            </h1>
            <p className="rv-hero-lede">
              Paste any product link. We check its price every day and score the drop against its own
              ninety-day history &mdash; so you can tell a real sale from a sticker.
            </p>

            <form onSubmit={handlePasteSubmit} className="rv-paste-form">
              <input
                type="url"
                required
                value={pasteUrl}
                onChange={(e) => setPasteUrl(e.target.value)}
                placeholder="Paste a product URL"
                className="rv-input rv-paste-input"
                aria-label="Product URL to track"
              />
              <Button type="submit" variant="primary" size="lg" className="rv-paste-submit">
                <span>Track it</span>
                <Arrow size={14} />
              </Button>
            </form>
            <p className="rv-paste-note">Free, and we never need your card.</p>
          </Reveal>

          <Reveal className="rv-proof" delay={0.1}>
            <FeaturedProof
              product={featured}
              points={featuredHistory.data?.points ?? []}
              loading={loading || featuredHistory.isLoading}
              count={featuredPool.length}
              activeIdx={featuredIdx % Math.max(featuredPool.length, 1)}
              onPick={setFeaturedIdx}
            />
          </Reveal>
        </div>
      </section>

      {/* ── INDEX ────────────────────────────────────────── */}
      <section id="deals" className="rv-section rv-section-alt">
        <div className="rv-section-inner">
          <header className="rv-section-head">
            <p className="rv-eyebrow rv-eyebrow-accent">Live index</p>
            <h2 className="rv-display rv-section-title">Today&rsquo;s real deals</h2>
            <p className="rv-section-sub">
              Ranked by how well each drop holds up against its own price history &mdash; not by how big
              the discount claims to be.
            </p>
          </header>

          {/* Composition across products — the index below ranks by the
              score, this shows what each score is MADE of. */}
          {!loading && filteredProducts.length > 1 && (
            <Panel
              label="What today's top scores are made of"
              aside="points out of 100"
              className="rv-comp-panel"
            >
              <ScoreComposition products={filteredProducts} limit={8} />
            </Panel>
          )}

          <div className="rv-filter-bar">
            <label className="rv-filter">
              <span className="rv-eyebrow">Store</span>
              <select className="rv-filter-input" value={filterDomain} onChange={(e) => setFilterDomain(e.target.value)}>
                <option value="all">All stores</option>
                {domains.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </label>
            <label className="rv-filter">
              <span className="rv-eyebrow">Minimum score <b className="rv-num">{filterMinScore}</b></span>
              <input
                type="range" min={0} max={100} step={5}
                value={filterMinScore}
                onChange={(e) => setFilterMinScore(Number(e.target.value))}
                className="rv-filter-range"
              />
            </label>
            <label className="rv-filter">
              <span className="rv-eyebrow">Sort by</span>
              <select className="rv-filter-input" value={filterSort} onChange={(e) => setFilterSort(e.target.value as "deal_score" | "newest")}>
                <option value="deal_score">Highest score</option>
                <option value="newest">Recently tracked</option>
              </select>
            </label>
            <span className="rv-filter-count rv-num">
              {filteredProducts.length}<span className="rv-filter-count-of">/{products.length}</span>
            </span>
          </div>

          <div className="rv-index rv-gridded">
            <div className="rv-index-head" aria-hidden="true">
              <span className="rv-index-h-rank">#</span>
              <span>Product</span>
              <span className="rv-index-h-spark">90-day history</span>
              <span className="rv-index-h-num">Now</span>
              <span className="rv-index-h-num">vs median</span>
              <span className="rv-index-h-num">Score</span>
              <span />
            </div>

            {loading && <div className="rv-index-state">Loading tracked products&hellip;</div>}

            {!loading && products.length === 0 && (
              <div className="rv-index-empty">
                <EmptyAxis width={720} height={210} label="No history recorded yet" />
                <p className="rv-index-empty-title">Nothing is being tracked yet.</p>
                <p className="rv-index-empty-body">
                  Paste any product URL above. We record its price from today and recheck it every day
                  &mdash; the score unlocks once there are fourteen days of real history behind it.
                </p>
              </div>
            )}

            {!loading && products.length > 0 && filteredProducts.length === 0 && (
              <div className="rv-index-state">
                No product matches these filters.{" "}
                <button onClick={() => { setFilterDomain("all"); setFilterMinScore(0); }} className="rv-link">
                  Clear filters
                </button>
              </div>
            )}

            {!loading && filteredProducts.map((p, i) => (
              <IndexRow
                key={p.id}
                product={p}
                rank={i + 1}
                open={expanded === p.id}
                onToggle={() => setExpanded(expanded === p.id ? null : p.id)}
                onTrack={() => onGetStarted()}
              />
            ))}
          </div>

          <div className="rv-index-foot">
            <span className="rv-tag">
              Showing {filteredProducts.length} of {products.length} tracked products.
            </span>
            <Button onClick={() => onGetStarted()} variant="ghost" size="sm">
              <span>Track your own product</span>
              <Arrow size={11} />
            </Button>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────── */}
      <section id="how" className="rv-section">
        <div className="rv-section-inner">
          <header className="rv-section-head">
            <p className="rv-eyebrow">Process</p>
            <h2 className="rv-display rv-section-title">How it works</h2>
            <p className="rv-section-sub">Three steps, in order. Real statistics, not marketing.</p>
          </header>
          <ol className="rv-steps">
            {STEPS.map((s, i) => (
              <li key={s.title} className="rv-step">
                <span className="rv-step-num rv-num">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="rv-step-title">{s.title}</h3>
                <p className="rv-step-text">{s.body}</p>
                <span className="rv-tag rv-step-foot">{s.foot}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── MANIFESTO ────────────────────────────────────── */}
      <section id="compare" className="rv-section rv-section-alt">
        <div className="rv-section-inner">
          <header className="rv-section-head">
            <p className="rv-eyebrow">Why WasItCheaper</p>
            <h2 className="rv-display rv-section-title">
              Most deal sites show you a discount. We show you the arithmetic.
            </h2>
          </header>
          <div className="rv-manifesto">
            <div className="rv-manifesto-col">
              <span className="rv-eyebrow">Most deal sites</span>
              <ul className="rv-manifesto-list">
                {LEGACY.map((t) => (
                  <li key={t} className="rv-legacy-item">{t}</li>
                ))}
              </ul>
            </div>
            <div className="rv-manifesto-col rv-manifesto-col-ours">
              <span className="rv-eyebrow rv-eyebrow-accent">WasItCheaper</span>
              <ul className="rv-manifesto-list">
                {WIC_WAY.map((t) => (
                  <li key={t} className="rv-ours-item">{t}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────── */}
      <section className="rv-cta">
        <div className="rv-cta-inner">
          <h2 className="rv-display rv-cta-headline">
            Stop trusting the badge.<br />Start tracking the price.
          </h2>
          <p className="rv-cta-sub">Free to track. We email you the moment a price genuinely drops.</p>
          <div className="rv-cta-buttons">
            <Button onClick={() => onGetStarted()} variant="primary" size="xl" className="rv-cta-primary">
              <span>Start tracking &mdash; it&rsquo;s free</span>
              <Arrow size={16} />
            </Button>
            <Button as="a" href="#how" variant="ghost-light" size="xl">
              <span>How it works</span>
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
      <Panel label="Today's proof" gridded>
        <EmptyAxis width={900} height={300} label="Loading price history" />
      </Panel>
    );
  }

  if (!product) {
    return (
      <Panel label="Today's proof" gridded>
        <EmptyAxis width={900} height={300} label="No price history recorded yet" />
        <p className="rv-proof-empty">
          Nothing is tracked yet. Paste a product link and this chart fills in as its history builds.
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
      gridded
    >
      <div className="rv-proof-head">
        <div className="rv-proof-id">
          <a href={`#/product/${product.id}`} className="rv-proof-title">
            {product.title ?? product.domain}
          </a>
          <p className="rv-proof-meta rv-num">
            {product.domain} &middot; {product.stats?.coverage_days ?? 0} days of history &middot;{" "}
            {product.stats?.n_points ?? 0} price checks
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
            {product.latest_price != null ? formatMoney(product.latest_price, currency) : "—"}
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

/* ── INDEX ROW ────────────────────────────────────────────── */

function IndexRow({
  product: p,
  rank,
  open,
  onToggle,
  onTrack,
}: {
  product: Product;
  rank: number;
  open: boolean;
  onToggle: () => void;
  onTrack: () => void;
}) {
  const currency = p.currency ?? "USD";
  const delta = p.stats?.discount_vs_median_pct ?? null;
  const history = usePriceHistory(p.id, "90");

  return (
    <article className={`rv-row${open ? " is-open" : ""}`}>
      <div className="rv-row-main">
        <span className="rv-row-rank rv-num">{String(rank).padStart(2, "0")}</span>

        <a href={`#/product/${p.id}`} className="rv-row-product">
          <ProductImage
            image={productImage(p.image_url, p.title ?? p.domain)}
            ratio="1 / 1"
            className="rv-row-thumb"
          />
          <span className="rv-row-names">
            <span className="rv-row-title">{p.title ?? p.domain}</span>
            <span className="rv-row-source rv-num">{p.domain} &middot; {agoLabel(p.created_at)}</span>
          </span>
        </a>

        <span className="rv-row-spark">
          <Sparkline points={history.data?.points ?? []} median={p.median_90d} />
        </span>

        <span className="rv-row-price rv-num">
          {p.latest_price != null ? formatMoney(p.latest_price, currency) : "—"}
          {p.median_90d != null && (
            <s className="rv-row-was">{formatMoney(p.median_90d, currency)}</s>
          )}
        </span>

        <span className="rv-row-delta">
          <Delta pct={delta} size="lg" />
        </span>

        <span className="rv-row-score">
          {p.deal_score != null ? (
            <>
              <b className="rv-row-score-v rv-num">{Math.round(p.deal_score)}</b>
              {p.is_lowest_ever && <Stamp tone="signal">Lowest ever</Stamp>}
            </>
          ) : (
            <Stamp tone="quiet">Scores in {Math.max(0, 14 - (p.stats?.coverage_days ?? 0))}d</Stamp>
          )}
        </span>

        <button
          className="rv-row-expand"
          onClick={onToggle}
          aria-expanded={open}
          aria-label={open ? `Hide why ${p.title ?? p.domain} scored this` : `Why did ${p.title ?? p.domain} score this?`}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M2 4l4 4 4-4" />
          </svg>
        </button>
      </div>

      {open && (
        <div className="rv-row-detail">
          <div className="rv-row-detail-score">
            <p className="rv-eyebrow rv-mb-10">Why it scored {p.deal_score != null ? Math.round(p.deal_score) : "—"}</p>
            <ScoreBar score={p.deal_score} stats={p.stats} />
          </div>
          <div className="rv-row-detail-actions">
            <Button as="a" href={`#/product/${p.id}`} variant="primary" size="sm">
              <span>Full history</span>
              <Arrow size={11} />
            </Button>
            <Button onClick={onTrack} variant="ghost" size="sm">
              <span>Alert me on a drop</span>
            </Button>
          </div>
        </div>
      )}
    </article>
  );
}

const STYLES = `
  .rv-catalog {
    background: var(--paper); color: var(--ink);
    font-family: var(--font-sans);
  }
  .rv-mb-10 { margin-bottom: 10px; }

  /* ── Sections ── */
  .rv-section { padding: 88px 0; border-top: 1px solid var(--rule); }
  .rv-section-alt { background: var(--paper-soft); }
  .rv-section-inner { max-width: 1180px; margin: 0 auto; padding: 0 24px; }
  /* A px cap, not ch: ch resolves against this element's 16px font-size, so
     a 62ch box was squeezing a 54px display headline into five lines. */
  .rv-section-head { max-width: 880px; margin-bottom: 36px; }
  .rv-section-title { font-size: clamp(32px, 4.2vw, 50px); margin: 12px 0 0; }
  .rv-section-sub { margin: 16px 0 0; font-size: 16px; line-height: 1.6; color: var(--ink-muted); max-width: 58ch; }

  /* ── Hero — thesis left, live proof right, both above the fold. ── */
  .rv-hero { padding: 56px 0 80px; }
  .rv-hero-inner {
    max-width: 1180px; margin: 0 auto; padding: 0 24px;
    display: grid; grid-template-columns: minmax(0, 0.82fr) minmax(0, 1.18fr);
    gap: 56px; align-items: center;
  }
  .rv-hero-copy { min-width: 0; }
  .rv-hero-eyebrow { margin-bottom: 20px; }
  .rv-dot {
    width: 7px; height: 7px; background: var(--green); flex: none;
    animation: rv-pulse 2.6s ease-in-out infinite;
  }
  @keyframes rv-pulse { 0%,100% { opacity: 1; } 50% { opacity: .35; } }
  .rv-hero-headline { font-size: clamp(38px, 4.4vw, 60px); margin: 0; }
  .rv-hero-lede {
    margin: 22px 0 0; font-size: 16px; line-height: 1.6; color: var(--ink-soft); max-width: 46ch;
  }

  .rv-paste-form { display: flex; gap: 10px; margin-top: 26px; max-width: 480px; }
  .rv-paste-input { flex: 1; min-width: 0; font-size: 15px; padding: 14px 15px; }
  .rv-paste-submit { flex: none; }
  .rv-paste-note { margin: 10px 0 0; font-size: 13px; color: var(--ink-muted); }

  /* ── Hero proof ── */
  .rv-proof { min-width: 0; }
  .rv-proof-empty { margin: 14px 0 0; font-size: 14px; color: var(--ink-muted); max-width: 52ch; }
  .rv-proof-dots { display: inline-flex; gap: 6px; }
  .rv-proof-dot {
    width: 22px; height: 3px; background: var(--rule-strong); cursor: pointer; padding: 0; border: 0;
    transition: background-color var(--dur-fast) ease;
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
  .rv-proof-now { font-size: clamp(30px, 4vw, 44px); font-weight: 600; letter-spacing: -0.03em; color: var(--ink); }
  .rv-proof-was { font-size: 14px; color: var(--ink-muted); }
  .rv-proof-was s { text-decoration-thickness: 1.5px; }
  .rv-proof-saving { font-size: 13px; color: var(--green-deep); font-weight: 500; }
  .rv-proof-chart { margin: 0 -8px; }

  .rv-comp-panel { margin-bottom: 44px; }

  /* ── Filter bar ── */
  .rv-filter-bar {
    display: flex; align-items: flex-end; gap: 26px; flex-wrap: wrap;
    padding-bottom: 18px; border-bottom: 1px solid var(--rule-strong);
  }
  .rv-filter { display: flex; flex-direction: column; gap: 7px; }
  .rv-filter-input { min-width: 168px; padding: 8px 10px; font-size: 13.5px; height: 37px; }
  /* Matched to the select height so the three controls sit on one baseline. */
  .rv-filter-range { width: 168px; height: 37px; accent-color: var(--ink); cursor: pointer; }
  .rv-filter-count { margin-left: auto; font-size: 22px; font-weight: 600; color: var(--ink); }
  .rv-filter-count-of { font-size: 14px; color: var(--ink-fade); }

  /* ── Index rows — CSS grid, not a table: the same markup restacks on
     mobile instead of scrolling sideways off the screen. ── */
  .rv-index { --cols: 44px minmax(0, 1fr) 148px 132px 128px 132px 40px; }
  .rv-index-head, .rv-row-main {
    display: grid; grid-template-columns: var(--cols); gap: 18px; align-items: center;
  }
  .rv-index-head {
    padding: 14px 12px; border-bottom: 1px solid var(--rule-strong);
    font-family: var(--font-mono); font-size: 10.5px; font-weight: 600;
    text-transform: uppercase; letter-spacing: .12em; color: var(--ink-muted);
  }
  .rv-index-h-num, .rv-index-h-spark { text-align: right; }
  .rv-index-h-spark { text-align: left; }

  .rv-row { border-bottom: 1px solid var(--rule); background: rgba(255,255,255,.35); }
  .rv-row:hover { background: var(--paper-pale); }
  .rv-row.is-open { background: var(--paper-pale); }
  /* An index earns its keep by being dense — tight rows, one scan. */
  .rv-row-main { padding: 11px 12px; }

  .rv-row-rank { font-size: 13px; color: var(--ink-fade); font-weight: 500; }
  .rv-row-product { display: flex; align-items: center; gap: 13px; min-width: 0; text-decoration: none; }
  .rv-row-thumb { width: 40px; height: 40px; flex: none; border-radius: var(--img-radius); box-shadow: var(--img-ring); }
  .rv-row-names { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
  .rv-row-title {
    font-size: 14.5px; font-weight: 600; color: var(--ink); letter-spacing: -0.01em;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .rv-row-product:hover .rv-row-title { text-decoration: underline; text-underline-offset: 3px; }
  .rv-row-source { font-size: 11.5px; color: var(--ink-muted); }

  .rv-row-spark { display: flex; }
  .rv-row-price { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; font-size: 16px; font-weight: 600; }
  .rv-row-was { font-size: 11.5px; color: var(--ink-fade); font-weight: 400; }
  .rv-row-delta { display: flex; justify-content: flex-end; }
  .rv-row-score { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
  .rv-row-score-v { font-size: 24px; font-weight: 600; letter-spacing: -0.03em; color: var(--ink); line-height: 1; }

  .rv-row-expand {
    display: grid; place-items: center; width: 30px; height: 30px; cursor: pointer;
    color: var(--ink-muted); background: none; border: 1px solid transparent;
    transition: border-color var(--dur-fast) ease, color var(--dur-fast) ease;
  }
  .rv-row-expand:hover { color: var(--ink); border-color: var(--rule-strong); }
  .rv-row.is-open .rv-row-expand svg { transform: rotate(180deg); }
  .rv-row-expand svg { transition: transform var(--dur-mid) ease; }

  .rv-row-detail {
    display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 32px;
    padding: 4px 12px 24px; border-top: 1px dashed var(--rule-strong);
    padding-top: 22px; margin: 0 12px;
  }
  .rv-row-detail-actions { display: flex; flex-direction: column; gap: 8px; align-items: stretch; }

  .rv-index-state { padding: 40px 12px; font-size: 14px; color: var(--ink-muted); text-align: center; }
  .rv-index-empty { padding: 32px 12px 44px; text-align: center; max-width: 720px; margin: 0 auto; }
  .rv-index-empty-title { margin: 20px 0 0; font-size: 18px; font-weight: 600; color: var(--ink); }
  .rv-index-empty-body { margin: 10px auto 0; font-size: 14.5px; line-height: 1.6; color: var(--ink-muted); max-width: 52ch; }

  .rv-index-foot {
    display: flex; align-items: center; justify-content: space-between;
    gap: 16px; flex-wrap: wrap; padding-top: 18px;
  }

  /* ── Steps — numbered because the content genuinely is a sequence. ── */
  .rv-steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px; background: var(--rule); margin: 0; padding: 0; list-style: none; }
  .rv-step { background: var(--paper); padding: 28px 26px 30px; }
  .rv-step-num { display: block; font-size: 12px; font-weight: 600; color: var(--green-deep); letter-spacing: .1em; }
  .rv-step-title { margin: 16px 0 0; font-size: 19px; font-weight: 600; letter-spacing: -0.02em; }
  .rv-step-text { margin: 10px 0 0; font-size: 14.5px; line-height: 1.62; color: var(--ink-muted); }
  .rv-step-foot { margin-top: 16px; }

  /* ── Manifesto ── */
  .rv-manifesto { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; background: var(--rule-strong); }
  .rv-manifesto-col { background: var(--paper-soft); padding: 28px 26px 32px; }
  .rv-manifesto-col-ours { background: var(--paper-pale); }
  .rv-manifesto-list { margin: 18px 0 0; padding: 0; list-style: none; display: flex; flex-direction: column; }
  .rv-manifesto-list li { padding: 13px 0; border-bottom: 1px solid var(--rule); font-size: 15px; line-height: 1.5; }
  .rv-manifesto-list li:last-child { border-bottom: 0; }
  .rv-legacy-item { color: var(--ink-fade); text-decoration: line-through; text-decoration-color: var(--rule-strong); }
  .rv-ours-item { color: var(--ink); font-weight: 500; position: relative; padding-left: 22px !important; }
  .rv-ours-item::before {
    content: ""; position: absolute; left: 0; top: 21px; width: 12px; height: 2px; background: var(--green);
  }

  /* ── CTA ── */
  .rv-cta { background: var(--ink); color: var(--paper); padding: 96px 0; }
  .rv-cta-inner { max-width: 1180px; margin: 0 auto; padding: 0 24px; text-align: center; }
  .rv-cta-headline { font-size: clamp(34px, 5.4vw, 62px); margin: 0; color: var(--paper); }
  .rv-cta-sub { margin: 20px 0 0; font-size: 16.5px; color: rgba(244,243,239,.72); }
  .rv-cta-buttons { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; margin-top: 34px; }
  .rv-cta-primary { background: var(--paper); color: var(--ink); }
  .rv-cta-primary:hover { background: #fff; }

  /* ── Responsive ── */
  @media (max-width: 1080px) {
    .rv-index { --cols: 36px minmax(0, 1fr) 120px 112px 104px 108px 36px; }
    .rv-index-head, .rv-row-main { gap: 12px; }
  }

  /* The hero stacks before the proof panel gets too narrow to read a chart in. */
  @media (max-width: 1000px) {
    .rv-hero-inner { grid-template-columns: 1fr; gap: 44px; }
    .rv-hero-headline { font-size: clamp(38px, 6.4vw, 62px); }
  }

  @media (max-width: 860px) {
    .rv-section { padding: 64px 0; }
    .rv-steps { grid-template-columns: 1fr; }
    .rv-manifesto { grid-template-columns: 1fr; }
    .rv-row-detail { grid-template-columns: 1fr; gap: 22px; }
    .rv-row-detail-actions { flex-direction: row; flex-wrap: wrap; }
  }

  /* Below 760px the grid restacks entirely: two rows per product, with the
     sparkline and figures on their own line. No horizontal scrolling. */
  @media (max-width: 760px) {
    .rv-hero { padding: 48px 0 64px; }
    .rv-proof { margin-top: 40px; }
    .rv-paste-form { flex-direction: column; }
    .rv-paste-submit { width: 100%; }

    .rv-index-head { display: none; }
    /* Columns are shared down the grid, so auto-sized trailing columns were
       taking their width from the figures row and starving the product name.
       Fixed widths for the figures; the product row spans the full width and
       pads its trailing end for the expand button placed over it. */
    .rv-row-main {
      grid-template-columns: 26px minmax(0, 1fr) 92px 78px;
      grid-template-areas:
        "rank  product product product"
        "spark spark   spark   spark"
        "price price   delta   score";
      gap: 12px; padding: 16px 12px;
    }
    .rv-row-rank { grid-area: rank; align-self: start; }
    .rv-row-product { grid-area: product; align-self: start; padding-right: 36px; }
    .rv-row-expand { grid-column: 4; grid-row: 1; justify-self: end; align-self: start; }
    .rv-row-spark { grid-area: spark; }
    .rv-row-spark svg { width: 100%; height: 44px; }
    .rv-row-price { grid-area: price; align-items: flex-start; }
    .rv-row-delta { grid-area: delta; justify-content: flex-start; align-items: center; }
    /* Still the loudest figure in the row, but sized to its column. */
    .rv-row-delta .rv-delta-lg { font-size: 23px; }
    .rv-row-score { grid-area: score; }
    .rv-row-score-v { font-size: 21px; }
    /* Long domains have few break opportunities; let them break anywhere
       rather than spill out of their column. */
    .rv-row-source { overflow-wrap: anywhere; }
    .rv-row-title { white-space: normal; overflow: visible; }
    .rv-row-detail { margin: 0; padding: 20px 12px 24px; }
    .rv-filter-bar { gap: 16px; }
    .rv-filter { flex: 1 1 140px; }
    .rv-filter-input, .rv-filter-range { min-width: 0; width: 100%; }
    .rv-filter-count { flex-basis: 100%; margin-left: 0; }
  }

  @media (prefers-reduced-motion: reduce) {
    .rv-dot { animation: none; }
  }
`;
