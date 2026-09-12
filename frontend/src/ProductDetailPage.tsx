// Dedicated per-product detail page (#/product/:id). Reads GET /products/{id}
// + /history, shows the real price chart, the deal-score breakdown, watch
// controls, and the cached "Buy or Wait" AI verdict. Publicly readable;
// tracking/alerts and the verdict require sign-in.
//
// The chart is the page. Everything else — the score breakdown, the watch
// rule, the AI narration — is an annotation on it, so it comes after.
import { useEffect, useState, type ReactNode } from "react";
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
import { formatMoney, formatCheckedAgo } from "./format";
import { PriceHistoryChart } from "./charts";
import { ScoreBar } from "./ScoreBar";
import { Spinner } from "./Spinner";
import { Button, Delta, Panel, Reveal, Stamp, TopBar } from "./primitives";
import { OverlayToggle, SegmentedControl } from "./chartUI";
import { useChartPrefs } from "./chartView";

export default function ProductDetailPage({ id, onBack }: { id: string; onBack: () => void }) {
  const { data: product, isLoading, isError } = useProduct(id);
  const me = useMe();
  const [windowSize, setWindowSize] = useState<"90" | "180" | "all">("90");
  const [menuOpen, setMenuOpen] = useState(false);
  const { prefs, update } = useChartPrefs();
  const historyQuery = usePriceHistory(id, windowSize);

  const currency = product?.currency ?? "USD";
  const delta = product?.stats?.discount_vs_median_pct ?? null;
  const saving =
    product?.median_90d != null && product?.latest_price != null
      ? Number(product.median_90d) - Number(product.latest_price)
      : null;

  return (
    <div className="rv-detail rv-page min-h-screen">
      <style>{DETAIL_STYLES}</style>

      <TopBar
        links={[
          { href: "#", label: "Today's deals" },
          ...(me.data ? [{ href: "#/alerts", label: "Alerts" }] : []),
        ]}
        status={product ? formatCheckedAgo(product.last_checked_at) : undefined}
        menuOpen={menuOpen}
        onToggleMenu={() => setMenuOpen((v) => !v)}
      />

      <main className="rv-detail-main">
        <button onClick={onBack} className="rv-detail-back">
          <ArrowLeft size={15} />
          <span>Back to deals</span>
        </button>

        {isLoading && (
          <div className="rv-detail-state">
            <Spinner size={20} />
            <p>Loading price history&hellip;</p>
          </div>
        )}

        {(isError || (!isLoading && !product)) && (
          <div className="rv-detail-state">
            <p className="rv-detail-state-title">We don&rsquo;t have this product</p>
            <p className="rv-detail-state-sub">It may have been removed, or the link is out of date.</p>
            <Button onClick={onBack} variant="primary">Back to deals</Button>
          </div>
        )}

        {product && (
          <article>
            {/* ── Identity ─────────────────────────────────── */}
            <Reveal className="rv-detail-head">
              <ProductImage
                image={productImage(product.image_url, product.title ?? product.domain, product.category)}
                ratio="1 / 1"
                className="rv-detail-thumb"
                position="center"
              />
              <div className="rv-detail-id">
                <p className="rv-eyebrow rv-num">
                  {product.domain} &middot; tracking since{" "}
                  {new Date(product.created_at).toLocaleDateString()}
                </p>
                <h1 className="rv-detail-title">{product.title ?? product.domain}</h1>
                <div className="rv-detail-stamps">
                  {product.is_lowest_ever && <Stamp tone="signal">Lowest ever recorded</Stamp>}
                  {(product.status === "blocked" || product.status === "unavailable") && (
                    <Stamp tone="caution">
                      {product.status === "blocked" ? "Store blocks price checks" : "Page unreachable recently"}
                    </Stamp>
                  )}
                </div>
              </div>
              {/* Seeded demo rows live on the reserved .example TLD, which by
                  definition never resolves — offering "Open on ..." there is a
                  link that cannot work. Say what the row is instead. */}
              {product.status === "demo" ? (
                <span className="rv-detail-visit rv-detail-demo">
                  <Stamp tone="caution">Demo product &middot; no live page</Stamp>
                </span>
              ) : (
                <Button
                  as="a" href={product.url} target="_blank" rel="noreferrer"
                  variant="ghost" className="rv-detail-visit"
                >
                  <span>Open on {product.domain}</span>
                  <ExternalLink size={13} strokeWidth={2.2} className="rv-btn-arrow" />
                </Button>
              )}
            </Reveal>

            {/* ── The headline figures ─────────────────────── */}
            <div className="rv-detail-figures">
              <div className="rv-detail-fig">
                <span className="rv-eyebrow">Price now</span>
                <span className="rv-detail-now rv-num">
                  {product.latest_price != null ? formatMoney(product.latest_price, currency) : "—"}
                </span>
              </div>
              <div className="rv-detail-fig">
                <span className="rv-eyebrow">Its usual price</span>
                <span className="rv-detail-usual rv-num">
                  {product.median_90d != null ? formatMoney(product.median_90d, currency) : "—"}
                </span>
              </div>
              <div className="rv-detail-fig">
                <span className="rv-eyebrow">Below its median</span>
                <Delta pct={delta} size="lg" />
                {saving != null && saving > 0 && (
                  <span className="rv-detail-saving rv-num">
                    You save {formatMoney(saving, currency)}
                  </span>
                )}
              </div>
              <div className="rv-detail-fig rv-detail-fig-score">
                <span className="rv-eyebrow">Deal score</span>
                {product.deal_score != null ? (
                  <span className="rv-detail-score rv-num">
                    {Math.round(product.deal_score)}<span className="rv-detail-score-of">/100</span>
                  </span>
                ) : (
                  <span className="rv-detail-score-locked">Not yet</span>
                )}
              </div>
            </div>

            {/* ── The chart: the page's primary object ─────── */}
            <Panel
              label="Price history"
              aside={
                <span className="rv-window-toggle">
                  {(["90", "180", "all"] as const).map((w) => (
                    <button
                      key={w}
                      onClick={() => setWindowSize(w)}
                      className={`rv-window-btn${windowSize === w ? " is-active" : ""}`}
                      aria-pressed={windowSize === w}
                    >
                      {w === "all" ? "All" : `${w}d`}
                    </button>
                  ))}
                </span>
              }
              className="rv-detail-chart"
            >
              <div className="rv-viewbar">
                <SegmentedControl
                  label="Chart view"
                  value={prefs.view}
                  onChange={(v) => update({ view: v })}
                  options={[
                    { value: "line", label: "Line" },
                    { value: "bars", label: "Bars" },
                    { value: "table", label: "Table" },
                  ]}
                />
                {prefs.view === "line" && (
                  <div className="rv-viewbar-overlays">
                    <OverlayToggle
                      checked={prefs.showMedian}
                      onChange={(v) => update({ showMedian: v })}
                      swatch="var(--ink-fade)"
                    >
                      90-day median
                    </OverlayToggle>
                    <OverlayToggle
                      checked={prefs.showBand}
                      onChange={(v) => update({ showBand: v })}
                      swatch="var(--green)"
                    >
                      Discount band
                    </OverlayToggle>
                    <OverlayToggle
                      checked={prefs.showLowest}
                      onChange={(v) => update({ showLowest: v })}
                      swatch="var(--green-deep)"
                    >
                      Lowest ever
                    </OverlayToggle>
                  </div>
                )}
              </div>

              <PriceHistoryChart
                points={historyQuery.data?.points ?? []}
                median90d={historyQuery.data?.median_90d ?? product.median_90d}
                minEver={historyQuery.data?.min_ever ?? product.min_ever}
                currency={currency}
                view={prefs.view}
                showMedian={prefs.showMedian}
                showBand={prefs.showBand}
                showLowest={prefs.showLowest}
              />
              <p className="rv-detail-chart-note">
                {prefs.view === "line" && (
                  <>
                    Every point this line passes through is a real price check. The curve between two
                    checks is a connection, not a reading &mdash; real prices hold flat and then jump,
                    and the line never dips below a price that was actually recorded. Hatched bands are
                    periods the product was out of stock.
                  </>
                )}
                {prefs.view === "bars" && (
                  <>
                    Each bar is one price check, measured against this product&rsquo;s own 90-day median
                    rather than against zero. Bars of the price itself would need a cut-off axis, which
                    exaggerates small differences &mdash; the trick this site exists to catch. Below the
                    line means cheaper than its usual price.
                  </>
                )}
                {prefs.view === "table" && (
                  <>
                    Only the checks where the price actually moved. The price is recorded daily, so the
                    days in between repeat the value above them.
                  </>
                )}
              </p>
            </Panel>

            {/* ── Why it scored what it scored ─────────────── */}
            <Panel
              label="Why this score"
              aside={
                product.stats
                  ? `${product.stats.coverage_days} days · ${product.stats.n_points} checks`
                  : undefined
              }
              className="rv-detail-why"
            >
              <ScoreBar score={product.deal_score} stats={product.stats} />
            </Panel>

            <div className="rv-detail-panels">
              <WatchPanel productId={id} signedIn={!!me.data} />
              <VerdictCard productId={id} enabled={!!me.data} hasScore={product.deal_score != null} />
            </div>
          </article>
        )}
      </main>
    </div>
  );
}

// The API returns "<status>: <detail>"; the status code is noise to a reader.
function friendlyWatchError(message: string): string {
  if (/429/.test(message)) return "You've reached the limit on tracked products.";
  if (/401/.test(message)) return "Your session expired. Sign in again to save this alert.";
  const detail = message.replace(/^\d{3}:\s*/, "").trim();
  return detail || "Couldn't save that alert. Please try again.";
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

  const [localError, setLocalError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Mirrors _validate_rule in watches_api.py. Without this the server answers
  // 422 and — because no mutation error was ever rendered — the button simply
  // appeared to do nothing.
  function validate(thresholdNum: number | null): string | null {
    if (ruleType === "percent_drop") {
      if (thresholdNum === null || Number.isNaN(thresholdNum)) return "Enter a percentage between 1 and 90.";
      if (thresholdNum < 1 || thresholdNum > 90) return "Percentage must be between 1 and 90.";
    }
    if (ruleType === "target_price") {
      if (thresholdNum === null || Number.isNaN(thresholdNum)) return "Enter the price you're waiting for.";
      if (thresholdNum <= 0) return "Target price must be greater than 0.";
    }
    return null;
  }

  function save() {
    const thresholdNum = threshold.trim() ? Number(threshold) : null;
    const problem = validate(thresholdNum);
    setSaved(false);
    setLocalError(problem);
    if (problem) return;

    const onSettled = { onSuccess: () => setSaved(true) };
    if (myWatch) {
      updateWatch.mutate({ id: myWatch.id, rule_type: ruleType, threshold: thresholdNum }, onSettled);
    } else {
      createWatch.mutate({ product_id: productId, rule_type: ruleType, threshold: thresholdNum }, onSettled);
    }
  }

  const pending = createWatch.isPending || updateWatch.isPending;
  const serverError =
    createWatch.error?.message ?? updateWatch.error?.message ?? deleteWatch.error?.message ?? null;
  const errorText = localError ?? (serverError ? friendlyWatchError(serverError) : null);

  return (
    <Panel label={myWatch ? "Your alert" : "Set an alert"}>
      {!signedIn ? (
        <>
          <p className="rv-panel-lead">Get told the moment this price genuinely drops.</p>
          <p className="rv-panel-body-text">
            Sign in to set a rule. We check daily and email you only when the rule actually fires.
          </p>
          <Button as="a" href="#/login" variant="primary" size="sm">Sign in to set an alert</Button>
        </>
      ) : (
        <>
          <p className="rv-panel-lead">
            {myWatch ? "You're watching this product." : "Tell us what counts as a drop."}
          </p>

          <div className="rv-watch-form">
            <label className="rv-watch-field">
              <span className="rv-eyebrow">Alert me when</span>
              <select
                value={ruleType}
                onChange={(e) => setRuleType(e.target.value as RuleType)}
                className="rv-filter-input"
              >
                <option value="any_drop">The price drops at all</option>
                <option value="percent_drop">It drops by at least a percentage</option>
                <option value="target_price">It reaches a price I name</option>
              </select>
            </label>
            {ruleType !== "any_drop" && (
              <label className="rv-watch-field">
                <span className="rv-eyebrow">
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

          {errorText && (
            <p className="rv-watch-error" role="alert">{errorText}</p>
          )}
          {saved && !errorText && !pending && (
            <p className="rv-watch-ok" role="status">
              Saved. We&rsquo;ll email you when this rule fires.
            </p>
          )}

          <div className="rv-watch-actions">
            <Button onClick={save} disabled={pending} variant="primary" size="sm">
              {pending ? "Saving…" : myWatch ? "Update alert" : "Alert me"}
            </Button>
            {myWatch && (
              <Button
                onClick={() => deleteWatch.mutate(myWatch.id)}
                disabled={deleteWatch.isPending}
                variant="ghost"
                size="sm"
              >
                Stop watching
              </Button>
            )}
          </div>
        </>
      )}
    </Panel>
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
  const data = verdictQuery.data;

  let aside: ReactNode = undefined;
  let body: ReactNode;

  if (!enabled) {
    body = <p className="rv-panel-body-text">Sign in to read the analysis of this product&rsquo;s statistics.</p>;
  } else if (!hasScore) {
    body = (
      <p className="rv-panel-body-text">
        There isn&rsquo;t enough history to judge yet. Come back once this product has been tracked for a
        couple of weeks.
      </p>
    );
  } else if (verdictQuery.isLoading || data?.state === "pending") {
    body = (
      <div className="rv-verdict-loading">
        <Spinner size={16} />
        <p className="rv-panel-body-text">Reading the statistics&hellip;</p>
      </div>
    );
  } else if (!data || data.state === "unavailable" || !data.verdict) {
    body = <p className="rv-panel-body-text">The analysis isn&rsquo;t available right now.</p>;
  } else {
    const tone = data.verdict === "buy" ? "signal" : data.verdict === "wait" ? "caution" : "quiet";
    aside = data.computed_at ? `analysed ${new Date(data.computed_at).toLocaleDateString()}` : undefined;
    body = (
      <>
        <div className="rv-verdict-head">
          <Stamp tone={tone}>{data.verdict === "buy" ? "Buy now" : data.verdict === "wait" ? "Wait" : "Your call"}</Stamp>
        </div>
        <p className="rv-verdict-text">{data.rationale}</p>
        <p className="rv-panel-foot">
          Written from the computed statistics above &mdash; never from the raw price history.
        </p>
      </>
    );
  }

  return <Panel label="Buy or wait" aside={aside}>{body}</Panel>;
}

const DETAIL_STYLES = `
  .rv-detail { background: var(--ground); color: var(--ink); font-family: var(--font-sans); }
  .rv-detail-main { max-width: 1080px; margin: 0 auto; padding: 26px 24px 88px; }

  .rv-detail-back {
    display: inline-flex; align-items: center; gap: 8px; background: none; cursor: pointer;
    font-size: 13.5px; font-weight: 500; color: var(--ink-muted); padding: 4px 0; margin-bottom: 28px;
    transition: color var(--dur-fast) ease;
  }
  .rv-detail-back:hover { color: var(--ink); }

  .rv-detail-state {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 14px; padding: 96px 0; color: var(--ink-muted); text-align: center;
  }
  .rv-detail-state-title { font-size: 22px; font-weight: 600; color: var(--ink); }
  .rv-detail-state-sub { font-size: 14px; }

  /* ── Identity ── */
  .rv-detail-head {
    display: flex; align-items: flex-start; gap: 20px;
    padding-bottom: 26px; border-bottom: 1px solid var(--rule-strong);
  }
  .rv-detail-thumb { width: 84px; height: 84px; flex: none; border-radius: var(--img-radius); box-shadow: var(--img-ring); }
  .rv-detail-id { flex: 1; min-width: 0; }
  .rv-detail-title {
    margin: 8px 0 0; font-size: clamp(24px, 3.2vw, 34px); font-weight: 700;
    letter-spacing: -0.03em; line-height: 1.1;
  }
  .rv-detail-stamps { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; }
  .rv-detail-visit { flex: none; }
  .rv-detail-demo { display: inline-flex; align-items: center; }

  /* ── Headline figures ── */
  .rv-detail-figures {
    display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px;
    background: var(--rule); border-bottom: 1px solid var(--rule-strong);
  }
  .rv-detail-fig {
    background: var(--paper); padding: 22px 20px 24px;
    display: flex; flex-direction: column; gap: 10px; align-items: flex-start;
  }
  .rv-detail-now { font-size: clamp(26px, 3.4vw, 38px); font-weight: 600; letter-spacing: -0.03em; }
  .rv-detail-usual { font-size: clamp(22px, 2.8vw, 30px); font-weight: 500; letter-spacing: -0.03em; color: var(--ink-muted); }
  .rv-detail-saving { font-size: 12.5px; color: var(--green-deep); font-weight: 500; }
  .rv-detail-score { font-size: clamp(26px, 3.4vw, 38px); font-weight: 600; letter-spacing: -0.03em; }
  .rv-detail-score-of { font-size: 15px; color: var(--ink-fade); font-weight: 500; }
  .rv-detail-score-locked { font-size: 20px; font-weight: 500; color: var(--ink-fade); }

  /* ── Panels ── */
  .rv-detail-chart, .rv-detail-why { margin-top: 44px; }
  .rv-detail-chart-note {
    margin: 18px 0 0; font-size: 12.5px; line-height: 1.6; color: var(--ink-muted); max-width: 76ch;
  }

  .rv-window-toggle { display: inline-flex; gap: 2px; }
  .rv-window-btn {
    font-family: var(--font-mono); font-size: 11px; font-weight: 600; letter-spacing: .08em;
    padding: 5px 10px; cursor: pointer; color: var(--ink-muted); background: none;
    border: 1px solid var(--rule-strong);
    transition: background-color var(--dur-fast) ease, color var(--dur-fast) ease;
  }
  .rv-window-btn:hover { color: var(--ink); }
  .rv-window-btn.is-active { background: var(--ink); color: var(--paper); border-color: var(--ink); }

  .rv-detail-panels { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-top: 44px; }
  .rv-panel-lead { margin: 0 0 8px; font-size: 15px; font-weight: 600; }
  .rv-panel-body-text { margin: 0 0 16px; font-size: 14px; line-height: 1.6; color: var(--ink-muted); max-width: 52ch; }
  .rv-panel-foot { margin: 14px 0 0; font-size: 12px; color: var(--ink-fade); }

  .rv-watch-form { display: flex; gap: 14px; flex-wrap: wrap; margin-top: 16px; }
  .rv-watch-field { display: flex; flex-direction: column; gap: 6px; flex: 1 1 170px; min-width: 0; }
  .rv-watch-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-top: 18px; }
  .rv-watch-error {
    margin: 16px 0 0; font-size: 13.5px; line-height: 1.55; color: var(--red-deep);
    background: var(--red-tint); padding: 10px 12px; border-left: 2px solid var(--red);
  }
  .rv-watch-ok { margin: 16px 0 0; font-size: 13.5px; color: var(--green-deep); }

  .rv-verdict-head { margin-bottom: 12px; }
  .rv-verdict-text { margin: 0; font-size: 15px; line-height: 1.65; }
  .rv-verdict-loading { display: flex; align-items: center; gap: 12px; }
  .rv-verdict-loading .rv-panel-body-text { margin: 0; }

  @media (max-width: 900px) {
    .rv-detail-figures { grid-template-columns: repeat(2, 1fr); }
    .rv-detail-panels { grid-template-columns: 1fr; gap: 36px; }
  }
  @media (max-width: 640px) {
    .rv-detail-main { padding: 20px 18px 64px; }
    .rv-detail-head { flex-wrap: wrap; gap: 16px; }
    .rv-detail-thumb { width: 60px; height: 60px; }
    .rv-detail-visit { width: 100%; }
    .rv-detail-fig { padding: 18px 16px; }
  }
`;
