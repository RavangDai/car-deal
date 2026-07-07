import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { useProducts } from "./hooks";
import { ProductImage } from "./ProductImage";
import { productImage } from "./images";
import { formatMoney } from "./format";
import { Arrow, RetroButton, RetroWindow, Reveal, Taskbar } from "./primitives";
import HeroCarousel, { type HeroSlide } from "./HeroCarousel";
import Footer from "./Footer";
import type { Product } from "./api";

function agoLabel(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "—";
  const days = Math.max(0, Math.round((Date.now() - t) / 86_400_000));
  if (days < 1) return "tracked today";
  if (days === 1) return "tracked 1 day";
  return `tracked ${days} days`;
}

function confidenceTier(p: Product): "low" | "med" | "high" {
  const days = p.stats?.coverage_days ?? 0;
  if (days >= 60) return "high";
  if (days >= 30) return "med";
  return "low";
}

function scoreReasons(p: Product): string[] {
  const s = p.stats;
  if (!s) return ["Not enough price history yet to compute a score."];
  const out: string[] = [];
  if (s.discount_vs_median_pct != null) {
    out.push(
      s.discount_vs_median_pct > 3
        ? `${s.discount_vs_median_pct.toFixed(0)}% below the 90-day median price`
        : "Priced at or near the 90-day median — not a real discount"
    );
  }
  if (s.rarity != null) out.push(`Cheaper than ${Math.round(s.rarity * 100)}% of days tracked`);
  if (s.stability != null) {
    out.push(
      s.stability > 0.6
        ? "Price was stable before this change — a trustworthy reference point"
        : "Price has fluctuated recently — treat this discount with caution"
    );
  }
  out.push(`Tracked for ${s.coverage_days} days across ${s.n_points} price checks`);
  return out;
}

export default function HomePage({ onGetStarted }: { onGetStarted: (url?: string) => void }) {
  const scopeRef = useRef<HTMLDivElement>(null);

  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<string>("hero");
  const [pasteUrl, setPasteUrl] = useState("");

  const [filterDomain, setFilterDomain] = useState<string>("all");
  const [filterMinScore, setFilterMinScore] = useState<number>(0);
  const [filterSort, setFilterSort] = useState<"deal_score" | "newest">("deal_score");
  const [expanded, setExpanded] = useState<string | null>(null);

  const productsQuery = useProducts({ sort: filterSort, limit: 60 });
  const products = useMemo(() => productsQuery.data ?? [], [productsQuery.data]);
  const loading = productsQuery.isLoading;

  const domains = useMemo(
    () => Array.from(new Set(products.map((p) => p.domain))).slice(0, 10),
    [products]
  );

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (filterDomain !== "all" && p.domain !== filterDomain) return false;
      if (filterMinScore > 0 && (p.deal_score == null || p.deal_score < filterMinScore)) return false;
      return true;
    });
  }, [products, filterDomain, filterMinScore]);

  const heroSlides = useMemo<HeroSlide[]>(() => {
    return products
      .filter((p) => p.deal_score != null)
      .slice(0, 5)
      .map((p) => ({
        id: p.id,
        title: p.title ?? p.domain,
        domain: p.domain,
        image: productImage(p.image_url, p.title ?? p.domain),
        priceLabel: p.latest_price != null ? formatMoney(p.latest_price, p.currency ?? "USD") : "—",
        median90dLabel:
          p.median_90d != null ? `90d median ${formatMoney(p.median_90d, p.currency ?? "USD")}` : null,
        dealScore: p.deal_score,
        isLowestEver: p.is_lowest_ever,
        historyPoints: [],
      }));
  }, [products]);

  function goToProduct(id: string) {
    window.location.hash = `#/product/${id}`;
  }

  function handlePasteSubmit(e: React.FormEvent) {
    e.preventDefault();
    onGetStarted(pasteUrl.trim() || undefined);
  }

  // Highlight the nav link for the section currently in view.
  useEffect(() => {
    const root = scopeRef.current;
    if (!root) return;
    const sections = root.querySelectorAll<HTMLElement>("[data-rv-section]");
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) {
          const id = visible.target.getAttribute("data-rv-section");
          if (id) setActiveSection(id);
        }
      },
      { rootMargin: "-25% 0% -65% 0%", threshold: 0 },
    );
    sections.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMobileOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  const bandProduct = products[0];

  return (
    <div ref={scopeRef} className="rv-catalog rv-page min-h-screen relative">
      <style>{STYLES}</style>
      <DonateBanner />

      {/* ── NAV ──────────────────────────────────────────── */}
      <Taskbar
        links={NAV_LINKS.map(([l, h]) => ({ href: `#${h}`, label: l }))}
        activeHref={`#${activeSection}`}
        status={products.length > 0 ? `${products.length} tracked` : undefined}
        actions={
          <RetroButton variant="primary" size="sm" onClick={() => onGetStarted()}>
            Get started
          </RetroButton>
        }
        menuOpen={mobileOpen}
        onToggleMenu={() => setMobileOpen((v) => !v)}
      />

      {/* ── HERO — the carousel IS the hero: full-viewport slides cycling
          through today's top real deals, with the paste-URL CTA overlaid
          on every slide. ── */}
      <section data-rv-section="hero">
        <HeroCarousel slides={heroSlides} onSlideClick={goToProduct}>
          <Reveal className="rv-hero-content">
            <p className="rv-eyebrow rv-hero-eyebrow">
              <span className="rv-dot" /> Live · {products.length > 0 ? `${products.length} products tracked` : "tracking prices"}
            </p>
            <h1 className="display rv-hero-headline">
              Was it <em className="rv-emph rv-emph-light">actually</em> cheaper? Now you'll know.
            </h1>
            <p className="rv-hero-lede">
              Paste any product link. We track its real price history and score
              every "deal" against 90 days of data — <a href="#how" className="rv-ilink rv-ilink-on-dark">the math attached</a>.
            </p>

            <form onSubmit={handlePasteSubmit} className="rv-paste-form">
              <input
                type="url"
                required
                value={pasteUrl}
                onChange={(e) => setPasteUrl(e.target.value)}
                placeholder="Paste a product URL…"
                className="rv-paste-input"
                aria-label="Product URL to track"
              />
              <RetroButton type="submit" variant="primary" size="lg" className="rv-paste-submit">
                <span>Track it</span>
                <Arrow size={14} />
              </RetroButton>
            </form>

            <div className="rv-hero-meta">
              <Stat v={String(products.length)} k="products tracked" />
              <Stat v={String(products.filter((p) => p.is_lowest_ever).length)} k="at lowest ever" />
              <Stat v="daily" k="price rechecks" />
            </div>
          </Reveal>
        </HeroCarousel>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────── */}
      <section id="how" data-rv-section="how" className="rv-section rv-section-alt">
        <div className="rv-section-inner">
          <Reveal>
            <RetroWindow title="how_it_works.txt">
              <div className="rv-how-grid">
                <div className="rv-how-side">
                  <p className="rv-eyebrow mb-3">Process</p>
                  <h2 className="display rv-section-title">How it works</h2>
                  <p className="rv-section-sub">Three steps. Real statistics, not marketing.</p>
                </div>
                <ol className="rv-how-steps">
                  {STEPS.map((s, i) => (
                    <li key={s.title} className="rv-step-row">
                      <span className="rv-step-num">{String(i + 1).padStart(2, "0")}</span>
                      <div className="rv-step-body">
                        <h3 className="rv-step-title">{s.title}</h3>
                        <p className="rv-step-text">{s.body}</p>
                        <span className="rv-tag">{s.foot}</span>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            </RetroWindow>
          </Reveal>
        </div>
      </section>

      {/* ── DEALS ────────────────────────────────────────── */}
      <section id="deals" data-rv-section="deals" className="rv-section">
        <div className="rv-section-inner">
          <Reveal>
            <header className="rv-section-head">
              <p className="rv-eyebrow rv-eyebrow-accent mb-3">Live index</p>
              <h2 className="display rv-section-title">Today's real deals</h2>
              <p className="rv-section-sub">Ranked by deal score — real discount depth, rarity, and stability, not a claimed discount.</p>
            </header>

            <RetroWindow title="deals.exe" bodyClassName="p-0">
            <div className="rv-filter-bar">
              <label className="rv-filter">
                <span className="rv-eyebrow">Store</span>
                <select className="rv-filter-input" value={filterDomain} onChange={(e) => setFilterDomain(e.target.value)}>
                  <option value="all">All stores</option>
                  {domains.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </label>
              <label className="rv-filter">
                <span className="rv-eyebrow">Min. score {filterMinScore}</span>
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
              <span className="rv-tag rv-filter-result">{filteredProducts.length} of {products.length}</span>
            </div>

            <div className="rv-index-wrap">
              <table className="rv-index">
                <thead>
                  <tr>
                    <th className="rv-index-th" aria-label="Track"></th>
                    <th className="rv-index-th">Product</th>
                    <th className="rv-index-th rv-index-th-num">Current</th>
                    <th className="rv-index-th rv-index-th-num">90d median</th>
                    <th className="rv-index-th rv-index-th-num">Δ</th>
                    <th className="rv-index-th rv-index-th-conf">Confidence</th>
                    <th className="rv-index-th rv-index-th-num">Score</th>
                    <th className="rv-index-th"></th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr><td colSpan={8} className="rv-index-empty">Loading tracked products…</td></tr>
                  )}
                  {!loading && filteredProducts.length === 0 && (
                    <tr>
                      <td colSpan={8} className="rv-index-empty">
                        No products match these filters.{" "}
                        <button onClick={() => { setFilterDomain("all"); setFilterMinScore(0); }} className="rv-link">Clear filters</button>
                      </td>
                    </tr>
                  )}
                  {!loading && filteredProducts.map((p) => {
                    const isOpen = expanded === p.id;
                    const currency = p.currency ?? "USD";
                    const delta = p.stats?.discount_vs_median_pct ?? null;
                    return (
                      <Fragment key={p.id}>
                        <tr className={`rv-lot-row ${isOpen ? "rv-lot-row-open" : ""}`}>
                          <td className="rv-lot-cell">
                            <button
                              onClick={() => onGetStarted()}
                              className="rv-save-btn"
                              aria-label="Sign in to track this product"
                              title="Sign in to track this product"
                            >
                              <Bell size={14} strokeWidth={1.8} />
                            </button>
                          </td>
                          <td className="rv-lot-cell">
                            <a href={`#/product/${p.id}`} className="rv-lot-vehicle-cell">
                              <ProductImage image={productImage(p.image_url, p.title ?? p.domain)} ratio="4 / 3" className="rv-lot-thumb" />
                              <span className="min-w-0">
                                <span className="rv-lot-vehicle">{p.title ?? p.domain}</span>
                                <span className="rv-lot-source">{p.domain} · {agoLabel(p.created_at)}</span>
                              </span>
                            </a>
                          </td>
                          <td className="rv-lot-cell rv-lot-cell-num rv-lot-cell-strong">
                            {p.latest_price != null ? formatMoney(p.latest_price, currency) : "—"}
                          </td>
                          <td className="rv-lot-cell rv-lot-cell-num rv-lot-cell-fade">
                            {p.median_90d != null ? formatMoney(p.median_90d, currency) : "—"}
                          </td>
                          <td className="rv-lot-cell rv-lot-cell-num rv-lot-cell-delta">
                            {delta != null ? `−${delta.toFixed(0)}%` : "—"}
                          </td>
                          <td className="rv-lot-cell rv-lot-cell-conf">
                            <ConfidenceBars level={confidenceTier(p)} />
                          </td>
                          <td className="rv-lot-cell rv-lot-cell-num">
                            {p.deal_score != null ? (
                              <span className="rv-lot-score">{Math.round(p.deal_score)}<span className="rv-lot-score-of">/100</span></span>
                            ) : (
                              <span className="rv-tag">locked</span>
                            )}
                          </td>
                          <td className="rv-lot-cell rv-lot-cell-act">
                            <button
                              className="rv-lot-expand"
                              onClick={() => setExpanded(isOpen ? null : p.id)}
                              aria-expanded={isOpen}
                              aria-label={isOpen ? "Hide details" : "Why this score?"}
                            >
                              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
                                <path d="M2 4l4 4 4-4" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                        {isOpen && (
                          <tr className="rv-lot-detail">
                            <td colSpan={8} className="rv-lot-detail-cell">
                              <div className="rv-lot-detail-bevel rv-lot-detail-grid">
                                  <div>
                                    <div className="rv-eyebrow mb-2">Why this score</div>
                                    <ul className="rv-lot-detail-list">
                                      {scoreReasons(p).map((r) => (
                                        <li key={r}>{r}</li>
                                      ))}
                                    </ul>
                                  </div>
                                  <div>
                                    <div className="rv-eyebrow mb-2">Price context</div>
                                    <div className="rv-lot-detail-stats">
                                      <span>Current <strong>{p.latest_price != null ? formatMoney(p.latest_price, currency) : "—"}</strong></span>
                                      <span>90d median <strong>{p.median_90d != null ? formatMoney(p.median_90d, currency) : "—"}</strong></span>
                                      <span>All-time low <strong>{p.min_ever != null ? formatMoney(p.min_ever, currency) : "—"}</strong></span>
                                    </div>
                                  </div>
                                  <div className="rv-lot-detail-actions">
                                    <RetroButton as="a" href={`#/product/${p.id}`} variant="primary" size="sm">
                                      <span>View details</span>
                                      <Arrow size={11} />
                                    </RetroButton>
                                    <RetroButton as="button" onClick={() => onGetStarted()} variant="outline" size="sm">
                                      <span>Track for alerts</span>
                                    </RetroButton>
                                  </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="rv-index-foot">
              <span className="rv-tag">Showing {filteredProducts.length} of {products.length} tracked products.</span>
              <RetroButton as="button" onClick={() => onGetStarted()} variant="ghost" size="sm">
                <span>Track your own product</span>
                <Arrow size={11} />
              </RetroButton>
            </div>
            </RetroWindow>
          </Reveal>
        </div>
      </section>

      {/* ── MANIFESTO ────────────────────────────────────── */}
      <section data-rv-section="compare" className="rv-section rv-section-alt">
        <div className="rv-section-inner">
          <Reveal>
            <header className="rv-section-head">
              <p className="rv-eyebrow mb-3">Why WasItCheaper</p>
              <h2 className="display rv-section-title">
                Most "deal" sites show you a discount. <em className="rv-emph">We show you the math.</em>
              </h2>
            </header>
            <RetroWindow title="compare.txt">
              <div className="rv-manifesto">
                <div className="rv-manifesto-col">
                  <span className="rv-eyebrow">Most deal sites</span>
                  <ul className="rv-manifesto-list">
                    {LEGACY.map((t) => (
                      <li key={t} className="rv-legacy-item">{t}</li>
                    ))}
                  </ul>
                </div>
                <div className="rv-manifesto-col">
                  <span className="rv-eyebrow rv-eyebrow-accent">WasItCheaper</span>
                  <ul className="rv-manifesto-list">
                    {WIC_WAY.map((t) => (
                      <li key={t} className="rv-reveal-item"><span className="rv-reveal-mark">→</span>{t}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </RetroWindow>
          </Reveal>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────── */}
      <section data-rv-section="cta" className="rv-cta">
        <div className="rv-cta-media" aria-hidden>
          {bandProduct ? (
            <ProductImage
              image={productImage(bandProduct.image_url, bandProduct.title ?? bandProduct.domain)}
              className="rv-cta-img"
              position="center"
            />
          ) : (
            <div className="rv-cta-img rv-cta-img-fallback" />
          )}
          <div className="rv-cta-scrim" />
        </div>
        <Reveal className="rv-cta-inner">
          <h2 className="display rv-cta-headline">
            Stop trusting the badge. Start <em className="rv-emph rv-emph-light">tracking the price</em>.
          </h2>
          <p className="rv-cta-sub">Free to track. We alert you the moment a price genuinely drops.</p>
          <div className="rv-cta-buttons">
            <RetroButton onClick={() => onGetStarted()} variant="primary" size="xl">
              <span>Get started — it's free</span>
              <Arrow size={16} />
            </RetroButton>
            <RetroButton as="a" href="#how" variant="ghost-light" size="xl">
              <span>How it works</span>
            </RetroButton>
          </div>
        </Reveal>
      </section>

      <Footer onGetStarted={() => onGetStarted()} />
    </div>
  );
}

/* ── COMPONENTS ───────────────────────────────────────────── */

function Stat({ v, k }: { v: string; k: string }) {
  return (
    <span className="rv-stat">
      <span className="rv-stat-v tabular-nums">{v}</span>
      <span className="rv-stat-k">{k}</span>
    </span>
  );
}

function ConfidenceBars({ level }: { level: "low" | "med" | "high" }) {
  const filled = level === "high" ? 3 : level === "med" ? 2 : 1;
  return (
    <span className={`rv-conf rv-conf-${level}`} aria-label={`Confidence: ${level}`}>
      {[0, 1, 2].map((i) => (
        <span key={i} className={`rv-conf-bar ${i < filled ? "rv-conf-bar-on" : ""}`} />
      ))}
      <span className="rv-conf-label">{level}</span>
    </span>
  );
}

/* ── DONATION BANNER ──────────────────────────────────────── */

// Shows a one-time banner when the user returns from Stripe Checkout, then
// strips the ?donate query param so it doesn't persist on reload.
function DonateBanner() {
  const [status, setStatus] = useState<"success" | "cancelled" | null>(() => {
    const d = new URLSearchParams(window.location.search).get("donate");
    return d === "success" || d === "cancelled" ? d : null;
  });

  useEffect(() => {
    if (!status) return;
    const params = new URLSearchParams(window.location.search);
    if (!params.has("donate")) return;
    params.delete("donate");
    const qs = params.toString();
    window.history.replaceState(
      {},
      "",
      window.location.pathname + (qs ? `?${qs}` : "") + window.location.hash,
    );
  }, [status]);

  useEffect(() => {
    if (status !== "success") return;
    const t = setTimeout(() => setStatus(null), 6000);
    return () => clearTimeout(t);
  }, [status]);

  if (!status) return null;

  return (
    <div className={`rv-donate-banner rv-donate-banner-${status}`} role="status">
      <span>{status === "success" ? "Thank you for your support." : "Checkout cancelled — no charge made."}</span>
      <button onClick={() => setStatus(null)} className="rv-donate-banner-close" aria-label="Dismiss">×</button>
    </div>
  );
}

/* ── DATA ─────────────────────────────────────────────────── */

const NAV_LINKS: [string, string][] = [
  ["Deals", "deals"],
  ["How it works", "how"],
];

const STEPS = [
  {
    title: "Paste any product link.",
    body: "Amazon, Best Buy, Target, your favorite boutique — an extraction agent reads structured data first, and falls back to an AI reader when a site doesn't publish it.",
    foot: "Any store",
  },
  {
    title: "We track it daily.",
    body: "A scheduled job rechecks the price every day and appends to a real, append-only history — never overwritten, never guessed.",
    foot: "Scheduled jobs",
  },
  {
    title: "Real math, not marketing.",
    body: "Every score weighs discount depth against the 90-day median, historical rarity, and pre-drop stability — a raised-then-'dropped' price scores near zero.",
    foot: "Deterministic scoring",
  },
];

const LEGACY = [
  "Fake 'was $199' reference prices",
  "No real price history to check",
  "Countdown timers with no substance",
  "Discounts you have to just trust",
];

const WIC_WAY = [
  "Deal score from 90 days of real prices",
  "Every 'lowest ever' badge is verified",
  "Full price history, charted",
  "Built for shoppers, not sellers",
];

/* ── STYLES ───────────────────────────────────────────────── */

const STYLES = `
  .rv-catalog {
    background: var(--paper);
    color: var(--ink);
    font-family: 'Manrope', sans-serif;
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
  }
  .rv-catalog * { box-sizing: border-box; }
  .rv-catalog .display { font-family: var(--font-display); font-weight: 400; letter-spacing: 0.01em; line-height: 1.06; text-wrap: balance; }
  .rv-catalog .rv-emph { color: var(--primary); font-style: normal; }
  .rv-catalog .rv-ilink { color: var(--blue); text-decoration: underline; text-decoration-thickness: 1px; text-underline-offset: 3px; text-decoration-color: color-mix(in srgb, var(--blue) 45%, transparent); transition: text-decoration-color .15s ease, color .15s ease; }
  .rv-catalog .rv-ilink:hover { color: var(--link-hover); text-decoration-color: var(--blue); }
  .rv-catalog .tabular-nums { font-variant-numeric: tabular-nums; }

  .rv-catalog .rv-tag {
    font-size: 11.5px; font-weight: 600; letter-spacing: 0.02em;
    color: var(--ink-muted); font-variant-numeric: tabular-nums;
  }
  .rv-catalog .rv-dot {
    width: 7px; height: 7px; border-radius: 50%; background: var(--primary);
    display: inline-block; flex-shrink: 0;
  }
  .rv-catalog .rv-link {
    color: var(--link); font-weight: 600; text-decoration: underline;
    text-underline-offset: 2px; transition: color .15s ease;
  }
  .rv-catalog .rv-link:hover { color: var(--link-hover); }

  /* ── Layout — macro-whitespace between sections. ── */
  .rv-catalog .rv-section { padding: 72px 0; }
  @media (min-width: 820px) { .rv-catalog .rv-section { padding: 112px 0; } }
  .rv-catalog .rv-section-alt { background: var(--paper-soft); border-top: 1px solid var(--rule); border-bottom: 1px solid var(--rule); }
  .rv-catalog .rv-section-inner { max-width: 1180px; margin: 0 auto; padding: 0 24px; }
  .rv-catalog .rv-section-head { margin-bottom: 36px; }
  .rv-catalog .rv-section-title { font-size: clamp(1.9rem, 3.6vw, 2.8rem); line-height: 1.04; }
  .rv-catalog .rv-section-sub { margin-top: 12px; font-size: 16px; color: var(--ink-muted); max-width: 60ch; }

  /* ── Hero overlay content (rendered inside HeroCarousel) ── */
  .rv-hero-content { max-width: 620px; }
  .rv-hero-eyebrow { margin-bottom: 20px; color: rgba(255,255,255,.86); text-shadow: 0 1px 12px rgba(0,0,0,.45); }
  .rv-hero-headline { font-size: clamp(2.6rem, 5.8vw, 4.3rem); line-height: 1.05; color: #fff; text-shadow: 0 2px 30px rgba(0,0,0,.36); font-family: var(--font-display); font-weight: 400; letter-spacing: 0.01em; }
  .rv-hero-lede { margin-top: 20px; font-size: clamp(16px, 1.6vw, 19px); line-height: 1.55; color: rgba(255,255,255,.88); max-width: 46ch; text-wrap: pretty; text-shadow: 0 1px 16px rgba(0,0,0,.32); }
  .rv-ilink-on-dark { color: #9bd4ee; text-decoration-color: rgba(155,212,238,.5); }
  .rv-ilink-on-dark:hover { color: #c4e7f6; text-decoration-color: #9bd4ee; }

  .rv-paste-form {
    margin-top: 28px; display: flex; gap: 10px; flex-wrap: wrap;
    max-width: 560px;
  }
  .rv-paste-input {
    flex: 1 1 260px; min-width: 0;
    font-family: 'Manrope', sans-serif; font-size: 15px; font-weight: 600;
    color: #fff; background: rgba(255,255,255,.12);
    border: 1px solid rgba(255,255,255,.34); border-radius: 12px;
    padding: 14px 16px; outline: none;
    transition: border-color .15s ease, background-color .15s ease;
  }
  .rv-paste-input::placeholder { color: rgba(255,255,255,.6); }
  .rv-paste-input:focus { border-color: #fff; background: rgba(255,255,255,.18); }
  .rv-paste-submit { flex-shrink: 0; }

  .rv-hero-meta { margin-top: 30px; display: flex; flex-wrap: wrap; gap: 30px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,.22); }
  .rv-stat { display: flex; flex-direction: column; gap: 2px; }
  .rv-stat-v { font-size: 22px; font-weight: 800; letter-spacing: -0.02em; color: #fff; }
  .rv-stat-k { font-size: 12.5px; color: rgba(255,255,255,.74); }

  /* ── How ── */
  .rv-catalog .rv-how-grid { display: grid; grid-template-columns: 0.7fr 1.3fr; gap: 48px; }
  @media (max-width: 820px) { .rv-catalog .rv-how-grid { grid-template-columns: 1fr; gap: 28px; } }
  .rv-catalog .rv-how-steps { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
  .rv-catalog .rv-step-row { display: grid; grid-template-columns: 48px 1fr; gap: 16px; padding: 24px 0; border-top: 1px solid var(--rule); }
  .rv-catalog .rv-how-steps li:first-child { border-top: none; }
  .rv-catalog .rv-step-num { font-size: 15px; font-weight: 800; color: var(--primary); font-variant-numeric: tabular-nums; }
  .rv-catalog .rv-step-title { font-size: 19px; font-weight: 700; margin-bottom: 6px; }
  .rv-catalog .rv-step-text { font-size: 15px; line-height: 1.55; color: var(--ink-muted); max-width: 52ch; margin-bottom: 10px; }

  /* ── Deals table ── */
  .rv-catalog .rv-filter-bar { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 18px 24px; padding: 16px 18px; margin-bottom: 18px; background: var(--paper-pale); border: 1px solid var(--rule); border-radius: 12px; }
  .rv-catalog .rv-filter { display: flex; flex-direction: column; gap: 6px; }
  .rv-catalog .rv-filter-input { font-family: 'Manrope', sans-serif; font-size: 13.5px; font-weight: 600; color: var(--ink); background: var(--paper-pale); border: 1px solid var(--rule-strong); border-radius: 8px; padding: 7px 10px; outline: none; cursor: pointer; }
  .rv-catalog .rv-filter-input:focus { border-color: var(--primary); }
  .rv-catalog .rv-filter-range { width: 130px; accent-color: var(--primary); }
  .rv-catalog .rv-filter-result { margin-left: auto; }

  .rv-catalog .rv-index-wrap { overflow-x: auto; border: 1px solid var(--rule); border-radius: 12px; box-shadow: var(--shadow-sm); background: var(--paper-pale); }
  .rv-catalog .rv-index { width: 100%; border-collapse: collapse; min-width: 780px; }
  .rv-catalog .rv-index-th { text-align: left; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--ink-muted); padding: 13px 14px; border-bottom: 1px solid var(--rule); background: var(--paper-soft); white-space: nowrap; }
  .rv-catalog .rv-index-th-num { text-align: right; }
  .rv-catalog .rv-index-th-conf { text-align: left; }
  .rv-catalog .rv-lot-row { transition: background-color .15s ease; }
  .rv-catalog .rv-lot-row:hover, .rv-catalog .rv-lot-row-open { background: var(--paper-soft); }
  .rv-catalog .rv-lot-cell { padding: 14px 14px; border-bottom: 1px solid var(--rule); font-size: 14px; vertical-align: middle; }
  .rv-catalog .rv-lot-cell-num { text-align: right; font-variant-numeric: tabular-nums; }
  .rv-catalog .rv-lot-cell-fade { color: var(--ink-fade); }
  .rv-catalog .rv-lot-cell-strong { font-weight: 700; }
  .rv-catalog .rv-lot-cell-delta { font-weight: 700; color: var(--green); }
  .rv-catalog .rv-lot-vehicle-cell { display: flex; align-items: center; gap: 12px; text-decoration: none; color: inherit; }
  .rv-catalog .rv-lot-thumb { width: 48px; border-radius: 8px; flex-shrink: 0; }
  .rv-catalog .rv-lot-vehicle { display: block; font-weight: 600; }
  .rv-catalog .rv-lot-source { display: block; font-size: 12px; color: var(--ink-muted); margin-top: 2px; }
  .rv-catalog .rv-lot-score { font-weight: 700; font-variant-numeric: tabular-nums; }
  .rv-catalog .rv-lot-score-of { font-size: 11px; font-weight: 600; color: var(--ink-fade); }
  .rv-catalog .rv-lot-cell-act { text-align: right; }
  .rv-catalog .rv-save-btn { color: var(--ink-fade); padding: 4px; border-radius: 6px; transition: color .15s ease; }
  .rv-catalog .rv-save-btn:hover { color: var(--primary); }
  .rv-catalog .rv-lot-expand { color: var(--ink-muted); padding: 6px; border-radius: 6px; transition: color .15s ease, background-color .15s ease; }
  .rv-catalog .rv-lot-expand:hover { color: var(--ink); background: var(--rule); }
  .rv-catalog .rv-index-empty { padding: 28px 14px; text-align: center; color: var(--ink-muted); font-size: 14px; }

  .rv-catalog .rv-conf { display: inline-flex; align-items: center; gap: 3px; }
  .rv-catalog .rv-conf-bar { width: 4px; height: 13px; border-radius: 1px; background: var(--rule-strong); }
  .rv-catalog .rv-conf-high .rv-conf-bar-on { background: var(--green); }
  .rv-catalog .rv-conf-med .rv-conf-bar-on { background: var(--amber); }
  .rv-catalog .rv-conf-low .rv-conf-bar-on { background: var(--ink-fade); }
  .rv-catalog .rv-conf-label { margin-left: 6px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--ink-muted); }

  .rv-catalog .rv-lot-detail-cell { padding: 0 14px 22px; background: var(--paper-soft); border-bottom: 1px solid var(--rule); }
  .rv-catalog .rv-lot-detail-bevel {
    margin-top: 4px; background: var(--paper);
    border-top: var(--bevel-width) solid var(--bevel-hi); border-left: var(--bevel-width) solid var(--bevel-hi);
    border-right: var(--bevel-width) solid var(--bevel-lo); border-bottom: var(--bevel-width) solid var(--bevel-lo);
  }
  .rv-catalog .rv-lot-detail-grid { display: grid; grid-template-columns: 1.2fr 1fr auto; gap: 32px; padding: 20px 22px; }
  @media (max-width: 760px) { .rv-catalog .rv-lot-detail-grid { grid-template-columns: 1fr; gap: 20px; } }
  .rv-catalog .rv-lot-detail-list { list-style: none; margin: 0; padding: 0; font-size: 13.5px; line-height: 1.5; color: var(--ink-soft); }
  .rv-catalog .rv-lot-detail-list li { padding: 3px 0 3px 14px; position: relative; }
  .rv-catalog .rv-lot-detail-list li::before { content: "·"; position: absolute; left: 2px; color: var(--primary); font-weight: 700; }
  .rv-catalog .rv-lot-detail-stats { display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: var(--ink-muted); }
  .rv-catalog .rv-lot-detail-stats strong { color: var(--ink); font-variant-numeric: tabular-nums; }
  .rv-catalog .rv-lot-detail-actions { display: flex; flex-direction: column; gap: 8px; align-items: flex-start; }

  .rv-catalog .rv-index-foot { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-top: 18px; flex-wrap: wrap; }

  /* ── Manifesto ── */
  .rv-catalog .rv-manifesto { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; }
  @media (max-width: 760px) { .rv-catalog .rv-manifesto { grid-template-columns: 1fr; gap: 28px; } }
  .rv-catalog .rv-manifesto-list { list-style: none; margin: 16px 0 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }
  .rv-catalog .rv-legacy-item { font-size: 15.5px; color: var(--ink-fade); text-decoration: line-through; text-decoration-color: var(--rule-strong); }
  .rv-catalog .rv-reveal-item { display: flex; gap: 10px; font-size: 15.5px; font-weight: 600; color: var(--ink); }
  .rv-catalog .rv-reveal-mark { color: var(--primary); font-weight: 800; }

  /* ── CTA (cinematic full-bleed band) ── */
  .rv-catalog .rv-cta { position: relative; isolation: isolate; padding: clamp(100px, 14vw, 168px) 24px; text-align: center; overflow: hidden; border-top: 1px solid var(--rule); }
  .rv-catalog .rv-cta-media { position: absolute; inset: 0; z-index: -1; }
  .rv-catalog .rv-cta-img { width: 100%; height: 100%; border-radius: 0; box-shadow: none; }
  .rv-catalog .rv-cta-img-fallback { background: linear-gradient(135deg, var(--primary-deep, var(--primary)), var(--ink)); }
  .rv-catalog .rv-cta-scrim {
    position: absolute; inset: 0;
    background:
      linear-gradient(180deg, rgba(15,15,17,.50) 0%, rgba(15,15,17,.64) 56%, rgba(15,15,17,.82) 100%),
      radial-gradient(70% 90% at 50% 50%, rgba(15,15,17,.06), rgba(15,15,17,.40));
  }
  .rv-catalog .rv-cta-inner { position: relative; max-width: 760px; margin: 0 auto; }
  .rv-catalog .rv-cta-headline { font-size: clamp(2.2rem, 5vw, 3.6rem); line-height: 1.05; color: #fff; text-shadow: 0 2px 24px rgba(0,0,0,.30); }
  .rv-catalog .rv-cta-sub { margin-top: 16px; font-size: clamp(16px, 2vw, 18px); color: rgba(255,255,255,.84); }
  .rv-catalog .rv-cta-buttons { margin-top: 32px; display: flex; flex-wrap: wrap; gap: 12px; justify-content: center; }
  .rv-catalog .rv-emph-light { color: #60a5fa; font-style: normal; }

  /* ── Donate banner (Footer.tsx owns the rest of the footer/donation UI) ── */
  .rv-catalog .rv-donate-banner { position: fixed; top: 16px; left: 50%; transform: translateX(-50%); z-index: var(--z-banner); display: flex; align-items: center; gap: 14px; padding: 12px 18px; border-radius: 12px; font-size: 14px; font-weight: 600; box-shadow: var(--shadow-lg); }
  .rv-catalog .rv-donate-banner-success { background: var(--green); color: #fff; }
  .rv-catalog .rv-donate-banner-cancelled { background: var(--ink); color: var(--paper); }
  .rv-catalog .rv-donate-banner-close { font-size: 20px; line-height: 1; opacity: .8; }

  @media (prefers-reduced-motion: reduce) {
    .rv-catalog * { animation: none !important; transition: none !important; }
  }
`;
