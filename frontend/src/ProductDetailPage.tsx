// Dedicated per-product detail page (#/product/:id). Reads GET /products/{id}
// + /history, shows the real price chart, the deal-score breakdown, watch
// controls, and the cached "Buy or Wait" AI verdict. Publicly readable;
// tracking/alerts and the verdict require sign-in.
import { useEffect, useState } from "react";
import { ArrowLeft, ExternalLink } from "lucide-react";
import {
  useCreateWatch,
  useDeleteWatch,
  useMe,
  usePriceHistory,
  useProduct,
  useUpdateWatch,
  useVerdict,
  useWatches,
} from "./hooks";
import type { RuleType } from "./api";
import { ProductImage } from "./ProductImage";
import { productImage } from "./images";
import { formatMoney } from "./format";
import { PriceHistoryChart } from "./charts";
import { Spinner } from "./Spinner";
import { Reveal } from "./primitives";

export default function ProductDetailPage({ id, onBack }: { id: string; onBack: () => void }) {
  const { data: product, isLoading, isError } = useProduct(id);
  const me = useMe();
  const [windowSize, setWindowSize] = useState<"90" | "180" | "all">("90");
  const historyQuery = usePriceHistory(id, windowSize);

  const currency = product?.currency ?? "USD";

  return (
    <div className="rv-detail min-h-screen">
      <style>{DETAIL_STYLES}</style>

      <header className="rv-detail-nav">
        <div className="rv-detail-nav-inner">
          <button onClick={onBack} className="rv-detail-back">
            <ArrowLeft size={15} />
            <span>Back</span>
          </button>
          <a href="#" className="rv-detail-brand">
            <img src="/wic-logo.svg" alt="" aria-hidden className="rv-detail-logo" />
            <span>WasItCheaper</span>
          </a>
        </div>
      </header>

      <main className="rv-detail-main">
        {isLoading && (
          <div className="rv-detail-state">
            <Spinner size={20} />
            <p>Loading product…</p>
          </div>
        )}

        {(isError || (!isLoading && !product)) && (
          <div className="rv-detail-state">
            <p className="rv-detail-state-title">Product not found</p>
            <p className="rv-detail-state-sub">It may have been removed or the link is out of date.</p>
            <button onClick={onBack} className="rv-btn rv-btn-primary">Back</button>
          </div>
        )}

        {product && (
          <article className="rv-detail-grid">
            <div className="rv-detail-gallery">
              <ProductImage
                image={productImage(product.image_url, product.title ?? product.domain)}
                ratio="4 / 3"
                className="rv-detail-hero"
                position="center"
              />
              {(product.status === "blocked" || product.status === "unavailable") && (
                <p className="rv-detail-status-note">
                  {product.status === "blocked"
                    ? "This store blocks automated price checks — we'll keep the history we already have."
                    : "We couldn't reach this page recently — price history may be stale."}
                </p>
              )}
            </div>

            <Reveal className="rv-detail-info">
              <p className="rv-eyebrow mb-2.5">
                {product.domain} · tracking since {new Date(product.created_at).toLocaleDateString()}
              </p>
              <h1 className="rv-detail-title">{product.title ?? product.domain}</h1>

              <div className="rv-bezel rv-detail-pricebox">
                <div className="rv-bezel-core rv-detail-pricebox-core">
                  <div className="rv-detail-priceline">
                    <span className="rv-detail-asking">
                      {product.latest_price != null ? formatMoney(product.latest_price, currency) : "—"}
                    </span>
                    {product.median_90d != null && (
                      <span className="rv-detail-fair">90d median {formatMoney(product.median_90d, currency)}</span>
                    )}
                  </div>
                  {product.deal_score != null ? (
                    <div className="rv-detail-savings">
                      Deal score {Math.round(product.deal_score)}/100
                      {product.is_lowest_ever && <span className="rv-detail-pct"> · lowest ever</span>}
                    </div>
                  ) : (
                    <div className="rv-detail-savings rv-detail-savings-muted">
                      Score unlocks after 2 weeks of tracking
                    </div>
                  )}
                </div>
              </div>

              <div className="rv-detail-chart-head">
                <span className="rv-eyebrow">Price history</span>
                <div className="rv-window-toggle">
                  {(["90", "180", "all"] as const).map((w) => (
                    <button
                      key={w}
                      onClick={() => setWindowSize(w)}
                      className={`rv-window-btn${windowSize === w ? " is-active" : ""}`}
                    >
                      {w === "all" ? "All" : `${w}d`}
                    </button>
                  ))}
                </div>
              </div>
              <div className="rv-bezel rv-detail-chart-box">
                <div className="rv-bezel-core p-5">
                  <PriceHistoryChart
                    points={historyQuery.data?.points ?? []}
                    median90d={historyQuery.data?.median_90d ?? product.median_90d}
                    minEver={historyQuery.data?.min_ever ?? product.min_ever}
                    currency={currency}
                  />
                </div>
              </div>

              {product.stats && (
                <div className="rv-detail-stats-panel">
                  <div className="rv-eyebrow mb-2">Why this score</div>
                  <dl className="rv-detail-specs">
                    <div>
                      <dt>Below 90d median</dt>
                      <dd>{product.stats.discount_vs_median_pct != null ? `${product.stats.discount_vs_median_pct.toFixed(1)}%` : "—"}</dd>
                    </div>
                    <div>
                      <dt>Historical rarity</dt>
                      <dd>{product.stats.rarity != null ? `${Math.round(product.stats.rarity * 100)}%` : "—"}</dd>
                    </div>
                    <div>
                      <dt>Pre-drop stability</dt>
                      <dd>{product.stats.stability != null ? `${Math.round(product.stats.stability * 100)}%` : "—"}</dd>
                    </div>
                    <div>
                      <dt>Tracked</dt>
                      <dd>{product.stats.coverage_days} days · {product.stats.n_points} checks</dd>
                    </div>
                  </dl>
                </div>
              )}

              <div className="rv-detail-actions-row">
                <a href={product.url} target="_blank" rel="noreferrer" className="rv-btn rv-btn-primary rv-btn-lg">
                  <span>View original listing</span>
                  <span className="rv-btn-icon">
                    <ExternalLink size={13} strokeWidth={2.2} className="rv-btn-arrow" />
                  </span>
                </a>
              </div>

              <div className="rv-detail-panels">
                <WatchPanel productId={id} signedIn={!!me.data} />
                <VerdictCard productId={id} enabled={!!me.data} hasScore={product.deal_score != null} />
              </div>
            </Reveal>
          </article>
        )}
      </main>
    </div>
  );
}

function WatchPanel({ productId, signedIn }: { productId: string; signedIn: boolean }) {
  const watchesQuery = useWatches(signedIn);
  const myWatch = watchesQuery.data?.find((w) => w.product_id === productId) ?? null;

  const createWatch = useCreateWatch();
  const updateWatch = useUpdateWatch();
  const deleteWatch = useDeleteWatch();

  const [ruleType, setRuleType] = useState<RuleType>("any_drop");
  const [threshold, setThreshold] = useState("");

  useEffect(() => {
    if (myWatch) {
      setRuleType(myWatch.rule_type);
      setThreshold(myWatch.threshold != null ? String(myWatch.threshold) : "");
    }
  }, [myWatch?.id, myWatch?.rule_type, myWatch?.threshold]);

  if (!signedIn) {
    return (
      <div className="rv-bezel rv-watch-panel">
        <div className="rv-bezel-core p-5">
          <p className="text-[14px] font-semibold mb-2">Get alerted on real price drops</p>
          <p className="text-[13px] text-[var(--ink-muted)] mb-4">
            Sign in to track this product and set an alert rule.
          </p>
          <a href="#" className="rv-btn rv-btn-primary rv-btn-sm">Sign in to track</a>
        </div>
      </div>
    );
  }

  function save() {
    const thresholdNum = threshold.trim() ? Number(threshold) : null;
    if (myWatch) {
      updateWatch.mutate({ id: myWatch.id, rule_type: ruleType, threshold: thresholdNum });
    } else {
      createWatch.mutate({ product_id: productId, rule_type: ruleType, threshold: thresholdNum });
    }
  }

  const pending = createWatch.isPending || updateWatch.isPending;

  return (
    <div className="rv-bezel rv-watch-panel">
      <div className="rv-bezel-core p-5">
        <p className="text-[14px] font-semibold mb-4">
          {myWatch ? "You're tracking this product" : "Track this product"}
        </p>

        <div className="rv-watch-form">
          <label className="rv-watch-field">
            <span className="rv-eyebrow mb-1">Alert me when</span>
            <select
              value={ruleType}
              onChange={(e) => setRuleType(e.target.value as RuleType)}
              className="rv-filter-input"
            >
              <option value="any_drop">Price drops at all</option>
              <option value="percent_drop">Drops by at least %</option>
              <option value="target_price">Hits a target price</option>
            </select>
          </label>
          {ruleType !== "any_drop" && (
            <label className="rv-watch-field">
              <span className="rv-eyebrow mb-1">
                {ruleType === "percent_drop" ? "Percent (1–90)" : "Target price"}
              </span>
              <input
                type="number"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                className="rv-input"
                placeholder={ruleType === "percent_drop" ? "15" : "49.99"}
              />
            </label>
          )}
        </div>

        <div className="mt-4 flex items-center gap-3 flex-wrap">
          <button onClick={save} disabled={pending} className="rv-btn rv-btn-primary rv-btn-sm">
            {myWatch ? "Update alert" : "Track & alert me"}
          </button>
          {myWatch && (
            <button
              onClick={() => deleteWatch.mutate(myWatch.id)}
              disabled={deleteWatch.isPending}
              className="rv-btn rv-btn-outline rv-btn-sm"
            >
              Unwatch
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function VerdictCard({
  productId,
  enabled,
  hasScore,
}: {
  productId: string;
  enabled: boolean;
  hasScore: boolean;
}) {
  const verdictQuery = useVerdict(productId, enabled);

  if (!enabled) {
    return (
      <div className="rv-bezel rv-verdict-card">
        <div className="rv-bezel-core p-5">
          <p className="rv-eyebrow mb-2">Buy or wait?</p>
          <p className="text-[13px] text-[var(--ink-muted)]">
            Sign in to see the AI analysis of this product's price statistics.
          </p>
        </div>
      </div>
    );
  }

  if (!hasScore) {
    return (
      <div className="rv-bezel rv-verdict-card">
        <div className="rv-bezel-core p-5">
          <p className="rv-eyebrow mb-2">Buy or wait?</p>
          <p className="text-[13px] text-[var(--ink-muted)]">
            Not enough price history yet — check back once this product has been tracked for a couple of weeks.
          </p>
        </div>
      </div>
    );
  }

  const data = verdictQuery.data;

  if (verdictQuery.isLoading || data?.state === "pending") {
    return (
      <div className="rv-bezel rv-verdict-card">
        <div className="rv-bezel-core p-5 flex items-center gap-3">
          <Spinner size={16} />
          <p className="text-[13.5px] text-[var(--ink-muted)]">Analyzing price history…</p>
        </div>
      </div>
    );
  }

  if (!data || data.state === "unavailable" || !data.verdict) {
    return (
      <div className="rv-bezel rv-verdict-card">
        <div className="rv-bezel-core p-5">
          <p className="rv-eyebrow mb-2">Buy or wait?</p>
          <p className="text-[13px] text-[var(--ink-muted)]">AI analysis isn't available right now.</p>
        </div>
      </div>
    );
  }

  const tone = data.verdict === "buy" ? "best" : data.verdict === "wait" ? "thin" : "rec";

  return (
    <div className="rv-bezel rv-verdict-card">
      <div className="rv-bezel-core p-5">
        <div className="flex items-center justify-between gap-3 mb-2">
          <p className="rv-eyebrow">AI analysis of the statistics above</p>
          <span className={`rv-badge rv-badge--${tone}`}>{data.verdict.toUpperCase()}</span>
        </div>
        <p className="text-[14px] leading-relaxed">{data.rationale}</p>
        {data.computed_at && (
          <p className="rv-tag mt-3">Analyzed {new Date(data.computed_at).toLocaleDateString()}</p>
        )}
      </div>
    </div>
  );
}

const DETAIL_STYLES = `
  .rv-detail {
    background: var(--paper);
    color: var(--ink);
    font-family: 'Manrope', sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  .rv-detail-nav { border-bottom: 1px solid var(--rule); background: var(--paper-pale); }
  .rv-detail-nav-inner {
    max-width: 1080px; margin: 0 auto; padding: 14px 24px;
    display: flex; align-items: center; justify-content: space-between;
  }
  .rv-detail-back {
    display: inline-flex; align-items: center; gap: 8px;
    font-size: 14px; font-weight: 600; color: var(--ink-muted);
    transition: color .15s ease;
  }
  .rv-detail-back:hover { color: var(--ink); }
  .rv-detail-brand { display: inline-flex; align-items: center; gap: 9px; font-weight: 800; font-size: 17px; letter-spacing: -0.02em; }
  .rv-detail-logo { width: 24px; height: 24px; object-fit: contain; }

  .rv-detail-main { max-width: 1080px; margin: 0 auto; padding: 32px 24px 64px; }
  .rv-detail-state {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 12px; padding: 80px 0; color: var(--ink-muted); text-align: center;
  }
  .rv-detail-state-title { font-family: var(--font-display); font-weight: 800; font-size: 1.5rem; color: var(--ink); }
  .rv-detail-state-sub { font-size: 14px; }

  .rv-detail-grid { display: grid; grid-template-columns: 1.05fr 1fr; gap: 40px; align-items: start; }
  @media (max-width: 860px) { .rv-detail-grid { grid-template-columns: 1fr; gap: 28px; } }

  .rv-detail-hero { width: 100%; border-radius: 14px; box-shadow: var(--shadow-md); }
  .rv-detail-status-note { margin-top: 12px; font-size: 13px; color: var(--amber-deep); background: var(--amber-tint); padding: 10px 14px; border-radius: 10px; }

  .rv-detail-title { font-family: var(--font-display); font-weight: 800; font-size: clamp(1.6rem, 3vw, 2.1rem); line-height: 1.08; letter-spacing: -0.03em; }

  .rv-detail-pricebox { margin: 20px 0; }
  .rv-detail-pricebox-core { padding: 18px 20px; }
  .rv-detail-priceline { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; }
  .rv-detail-asking { font-size: 1.9rem; font-weight: 800; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
  .rv-detail-fair { font-size: 13.5px; color: var(--ink-muted); font-variant-numeric: tabular-nums; }
  .rv-detail-savings { margin-top: 8px; font-size: 15px; font-weight: 800; color: var(--green); font-variant-numeric: tabular-nums; }
  .rv-detail-savings-muted { color: var(--ink-muted); font-weight: 600; font-size: 13.5px; }
  .rv-detail-pct { font-size: 13px; font-weight: 700; }

  .rv-detail-chart-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
  .rv-window-toggle { display: flex; gap: 4px; background: var(--paper-soft); border: 1px solid var(--rule); border-radius: 999px; padding: 3px; }
  .rv-window-btn { font-size: 12px; font-weight: 700; padding: 5px 11px; border-radius: 999px; color: var(--ink-muted); transition: background-color .15s ease, color .15s ease; }
  .rv-window-btn.is-active { background: var(--primary); color: #fff; }
  .rv-detail-chart-box { margin-bottom: 20px; }

  .rv-detail-stats-panel { margin-bottom: 22px; }
  .rv-detail-specs { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1px; background: var(--rule); border: 1px solid var(--rule); border-radius: 12px; overflow: hidden; margin: 0; }
  .rv-detail-specs > div { background: var(--paper-pale); padding: 11px 14px; }
  .rv-detail-specs dt { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.07em; color: var(--ink-muted); }
  .rv-detail-specs dd { margin: 3px 0 0; font-size: 14.5px; font-weight: 600; }

  .rv-detail-actions-row { margin-bottom: 24px; }

  .rv-detail-panels { display: flex; flex-direction: column; gap: 16px; }
  .rv-watch-form { display: flex; gap: 14px; flex-wrap: wrap; }
  .rv-watch-field { display: flex; flex-direction: column; gap: 2px; flex: 1 1 160px; min-width: 0; }
  .rv-verdict-card { margin: 0; }
`;
