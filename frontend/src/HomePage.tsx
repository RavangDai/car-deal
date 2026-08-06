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
import { Arrow, Bezel, Button, Delta, Panel, Reveal, Stamp, TopBar } from "./primitives";
import { PriceHistoryChart, EmptyAxis } from "./charts";
import { ProductFan } from "./ProductFan";
import { ScoreExplainer } from "./ScoreExplainer";
import { useReveal } from "./motion";
import Footer from "./Footer";
import type { Product } from "./api";

const NAV_LINKS: [string, string][] = [
  ["Today's deals", "deals"],
  ["How it works", "how"],
];

export default function HomePage({
  onGetStarted,
  onBrowse,
}: {
  onGetStarted: (url?: string) => void;
  /** Enter the browse-only dashboard without an account. */
  onBrowse: () => void;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [pasteUrl, setPasteUrl] = useState("");
  const [featuredIdx, setFeaturedIdx] = useState(0);

  // 12 is a showcase budget, not a feed budget: the fan shows at most a
  // handful at a time and only the featured product fetches its history.
  const productsQuery = useProducts({ sort: "deal_score", limit: 12 });
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
  const lowestEverCount = products.filter((p) => p.is_lowest_ever).length;

  // Fan cards need a score and a median to say anything; a card that reads
  // "—" twice is worse than one fewer card.
  const fanProducts = useMemo(
    () => products.filter((p) => p.deal_score != null && p.median_90d != null).slice(0, 10),
    [products],
  );

  const dealsRef = useReveal<HTMLDivElement>({ y: 40, stagger: 0.09 });
  const ctaRef = useReveal<HTMLDivElement>({ y: 46, stagger: 0.08, blur: 10 });

  function handlePasteSubmit(e: React.FormEvent) {
    e.preventDefault();
    onGetStarted(pasteUrl.trim() || undefined);
  }

  return (
    <div className="rv-catalog rv-page min-h-screen">
      <style>{STYLES}</style>

      <TopBar
        links={NAV_LINKS.map(([label, id]) => ({ href: `#${id}`, label }))}
        status={products.length > 0 ? `${products.length} tracked` : undefined}
        menuOpen={mobileOpen}
        onToggleMenu={() => setMobileOpen((v) => !v)}
        actions={
          <>
            <Button variant="quiet" size="sm" onClick={onBrowse}>
              Browse
            </Button>
            <Button size="sm" onClick={() => onGetStarted()}>
              Start tracking
            </Button>
          </>
        }
      />

      {/* ── HERO — the claim, then the receipt. On-mount reveal only:
             a scroll-gated hero ships blank in headless renders. ── */}
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
              Every deal is a <em>claim</em>.
              <br />
              We keep the receipts.
            </h1>
            <p className="rv-hero-lede">
              Paste any product link. We check its price every day and score the drop
              against its own ninety-day history &mdash; so you can tell a real sale
              from a sticker.
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
            <Bezel gridded>
              <FeaturedProof
                product={featured}
                points={featuredHistory.data?.points ?? []}
                loading={loading || featuredHistory.isLoading}
                count={featuredPool.length}
                activeIdx={featuredIdx % Math.max(featuredPool.length, 1)}
                onPick={setFeaturedIdx}
              />
            </Bezel>
          </Reveal>
        </div>
      </section>

      {/* ── EVIDENCE — real tracked products, fanned. ── */}
      <section className="rv-deals" id="deals" data-rv-section="deals">
        <div className="rv-deals-inner" ref={dealsRef}>
          <header className="rv-deals-head">
            <div className="rv-deals-head-copy">
              <p className="rv-eyebrow" data-reveal>
                Today&rsquo;s evidence
              </p>
              <h2 className="rv-display rv-deals-title" data-reveal>
                Scored against their own past
              </h2>
            </div>
            <p className="rv-deals-sub" data-reveal>
              Every card is a product we are tracking right now. The figure on it is
              measured, not advertised.
            </p>
          </header>

          <div className="rv-deals-fan" data-reveal>
            {loading ? (
              <div className="rv-deals-loading">
                <EmptyAxis width={900} height={260} label="Loading tracked products" />
              </div>
            ) : fanProducts.length > 0 ? (
              <ProductFan products={fanProducts} />
            ) : (
              <p className="rv-deals-empty">
                Nothing has enough history to score yet. Paste a product link and it
                appears here once we have fourteen days on it.
              </p>
            )}
          </div>

          <div className="rv-deals-foot" data-reveal>
            <Button variant="ghost" onClick={onBrowse}>
              <span>See every tracked deal</span>
              <Arrow size={14} />
            </Button>
          </div>
        </div>
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

      <div className="rv-proof-chart rv-gridded">
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
  .rv-proof .rv-bezel-core { padding: clamp(18px, 2vw, 26px); }
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
  /* The grid substrate rides the chart only — the panel around it is a
     reading surface, and gridding both makes neither mean anything. */
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
