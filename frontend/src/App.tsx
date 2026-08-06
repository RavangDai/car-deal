import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { hasSessionHint, isGuest, setGuestMode } from "./api";
import type { Product, Watch } from "./api";
import {
  useDeleteWatch,
  useLogoutMutation,
  useMe,
  usePriceHistory,
  usePreferences,
  useProducts,
  useSaveOnboarding,
  useTrackJob,
  useTrackUrl,
  useWatches,
} from "./hooks";
import LoginPage from "./LoginPage";
import HomePage from "./HomePage";
import LegalPage, { type LegalKind } from "./LegalPage";
import { Spinner } from "./Spinner";
import { ProductImage } from "./ProductImage";
import { productImage } from "./images";
import { categoryLabel } from "./taxonomy";
import { formatMoney } from "./format";
import ProductDetailPage from "./ProductDetailPage";
import AlertsPage from "./AlertsPage";
import OnboardingFlow from "./OnboardingFlow";
import {
  flushLocalOnboarding,
  fromPayload,
  hasSeenOnboarding,
  markOnboardingSeen,
  readLocalOnboarding,
  SENSITIVITY_MIN_SCORE,
  toPayload,
  type OnboardingAnswers,
} from "./onboarding";
import { Sparkline, ScoreHistogram, EmptyAxis, CHART_STYLES } from "./charts";
import { SCOREBAR_STYLES } from "./ScoreBar";
import { SCORE_COMPOSITION_STYLES } from "./ScoreComposition";
import { CHART_UI_STYLES } from "./chartUI";
import { PRICE_VIEW_STYLES } from "./priceViews";
import { Arrow, Button, Delta, Panel, PRIMITIVE_STYLES, Stamp, TopBar, Wordmark } from "./primitives";
import { PRODUCT_FAN_STYLES } from "./ProductFan";
import { SCORE_MODEL_STYLES } from "./ScoreExplainer";

const TERMINAL_STATES: ReadonlySet<string> = new Set(["SUCCESS", "FAILURE"]);

const EASE_OUT_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1];

// Progress stages reported by the track_url Celery task, in the user's
// vocabulary rather than the pipeline's.
const STAGE_LABELS: Record<string, string> = {
  queueing: "Queueing",
  queued: "Queued",
  started: "Opening the page",
  fetching: "Opening the page",
  parsing: "Reading the price",
  llm_fallback: "Reading the price",
  saving: "Saving the first reading",
  retrying: "Retrying",
  running: "Working",
};

function readLegalHash(): LegalKind | null {
  const h = window.location.hash;
  if (h === "#/terms") return "terms";
  if (h === "#/privacy") return "privacy";
  return null;
}

function readProductHash(): string | null {
  const m = window.location.hash.match(/^#\/product\/(.+)$/);
  return m ? decodeURIComponent(m[1]) : null;
}

function readIsAlertsHash(): boolean {
  return window.location.hash === "#/alerts";
}

function readIsLoginHash(): boolean {
  return window.location.hash === "#/login";
}

function readIsOnboardingHash(): boolean {
  return window.location.hash === "#/onboarding";
}

export default function App() {
  const me = useMe();
  // Sign-in is its own route (#/login), not a detached boolean: it gets a URL
  // you can link to, bookmark and reload, and the browser Back button works
  // between it and the landing page. An OAuth failure redirects back to
  // "/?auth_error=..." with no hash, so seed the route from that too.
  const [showLogin, setShowLogin] = useState(
    () => readIsLoginHash() || new URLSearchParams(window.location.search).has("auth_error")
  );
  const [guest, setGuest] = useState(isGuest);
  const [legal, setLegal] = useState<LegalKind | null>(readLegalHash);
  const [productId, setProductId] = useState<string | null>(readProductHash);
  const [onAlerts, setOnAlerts] = useState<boolean>(readIsAlertsHash);
  const [onOnboarding, setOnOnboarding] = useState<boolean>(readIsOnboardingHash);
  const [pendingUrl, setPendingUrl] = useState<string | undefined>(undefined);
  const logoutMut = useLogoutMutation();
  const prefersReduced = useReducedMotion();
  const saveOnboardingMut = useSaveOnboarding();
  // Shared by key with the Dashboard's call, so this is one request, not two.
  const appPrefs = usePreferences(!!me.data);

  // Hash-based routing for the standalone legal pages (#/terms, #/privacy),
  // the per-product detail page (#/product/:id), and the alerts page
  // (#/alerts) — all reachable without coupling to the auth-derived routing.
  useEffect(() => {
    const onHash = () => {
      setLegal(readLegalHash());
      setProductId(readProductHash());
      setOnAlerts(readIsAlertsHash());
      setShowLogin(readIsLoginHash());
      setOnOnboarding(readIsOnboardingHash());
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  function clearHash() {
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
  }

  function closeLegal() {
    clearHash();
    setLegal(null);
  }

  // Landing on #/login while already signed in is a dead end. The route order
  // below already renders the dashboard in that case (me.data is checked
  // first), so this only tidies the URL to match what is on screen — no state
  // to sync, and therefore no cascading render.
  useEffect(() => {
    if (showLogin && me.data) clearHash();
  }, [showLogin, me.data]);

  function closeProduct() {
    clearHash();
    setProductId(null);
  }

  function closeAlerts() {
    clearHash();
    setOnAlerts(false);
  }

  const bootstrapping = hasSessionHint() && me.isLoading;

  function handleLogout() {
    logoutMut.mutate();
    setGuest(false);
    clearHash();
    setShowLogin(false);
  }

  // Enter the dashboard without an account (browse-only). First-time guests
  // are routed through onboarding so the browse feed has something to filter
  // on; returning guests (or anyone who skipped) go straight in.
  function enterGuest() {
    setGuestMode(true);
    setGuest(true);
    setShowLogin(false);
    if (!hasSeenOnboarding()) {
      window.location.hash = "#/onboarding";
      setOnOnboarding(true);
      return;
    }
    clearHash();
  }

  // Finishing onboarding. A signed-in user's answers go to the server; a
  // guest's stay in localStorage until they create an account, at which point
  // flushLocalOnboarding() pushes them. Either way the local copy is written
  // first by the component, so a failed save is never a lost answer.
  function finishOnboarding(answers: OnboardingAnswers) {
    markOnboardingSeen();
    if (me.data) {
      saveOnboardingMut.mutate(toPayload(answers), {
        // Settled, not success: a preferences write that fails must not trap
        // the user on the onboarding screen.
        onSettled: () => {
          clearHash();
          setOnOnboarding(false);
        },
      });
      return;
    }
    clearHash();
    setOnOnboarding(false);
  }

  function skipOnboarding() {
    markOnboardingSeen();
    clearHash();
    setOnOnboarding(false);
  }

  // Leave guest mode to make a real account (kicks the login page into view).
  function goCreateAccount() {
    setGuestMode(false);
    setGuest(false);
    window.location.hash = "#/login";
    setShowLogin(true);
  }

  // Leave guest mode back to the marketing page.
  function exitGuest() {
    setGuestMode(false);
    setGuest(false);
  }

  // A real sign-in always supersedes a lingering guest flag.
  function handleRealLogin() {
    setGuestMode(false);
    setGuest(false);
    setShowLogin(false);

    // Push any answers given as a guest onto the account that now exists.
    // Fire-and-forget: it is silent on failure and keeps the local copy.
    void flushLocalOnboarding();

    // A brand-new account that never onboarded gets the flow now, so the
    // dashboard it lands on is already filtered to what they said they want.
    if (!hasSeenOnboarding()) {
      window.location.hash = "#/onboarding";
      setOnOnboarding(true);
      return;
    }
    clearHash();
  }

  // From the marketing homepage: "Start tracking" (optionally with a URL the
  // visitor already typed into the paste box) always routes to sign-in.
  function goToSignIn(url?: string) {
    if (url) setPendingUrl(url);
    window.location.hash = "#/login";
    setShowLogin(true);
  }

  // Pick the active route. Legal pages are reachable from any state.
  let routeKey: string;
  let routeEl: ReactNode;
  if (legal) {
    routeKey = `legal-${legal}`;
    routeEl = <LegalPage kind={legal} onBack={closeLegal} />;
  } else if (productId) {
    routeKey = `product-${productId}`;
    routeEl = <ProductDetailPage id={productId} onBack={closeProduct} />;
  } else if (onAlerts && me.data) {
    routeKey = "alerts";
    routeEl = <AlertsPage onBack={closeAlerts} />;
  } else if (onOnboarding) {
    // Checked before the auth branches so it works identically for a
    // signed-in user and a guest — it is the same four questions either way.
    routeKey = "onboarding";
    routeEl = (
      <OnboardingFlow
        onFinish={finishOnboarding}
        onSkip={skipOnboarding}
        saving={saveOnboardingMut.isPending}
        isGuest={!me.data}
        initial={
          appPrefs.data?.onboarding
            ? fromPayload(appPrefs.data.onboarding)
            : null
        }
      />
    );
  } else if (bootstrapping) {
    routeKey = "boot";
    routeEl = <BootSplash />;
  } else if (me.data) {
    routeKey = "dashboard";
    routeEl = <Dashboard onLogout={handleLogout} initialTrackUrl={pendingUrl} />;
  } else if (showLogin) {
    // Checked BEFORE guest: an explicit #/login URL is authoritative, so a
    // guest who navigates there gets the sign-in page rather than being
    // bounced back to the browse-only dashboard.
    routeKey = "login";
    routeEl = <LoginPage onLogin={handleRealLogin} onGuest={enterGuest} />;
  } else if (guest) {
    routeKey = "guest";
    routeEl = <Dashboard guest onCreateAccount={goCreateAccount} onExitGuest={exitGuest} />;
  } else {
    routeKey = "home";
    routeEl = <HomePage onGetStarted={goToSignIn} onBrowse={enterGuest} />;
  }

  // Simple opacity crossfade between routes.
  const fade = prefersReduced
    ? {}
    : {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0.25, ease: EASE_OUT_EXPO },
      };

  return (
    <>
      <style>
        {PRIMITIVE_STYLES + CHART_UI_STYLES + CHART_STYLES + PRICE_VIEW_STYLES +
          SCOREBAR_STYLES + SCORE_COMPOSITION_STYLES + PRODUCT_FAN_STYLES +
          SCORE_MODEL_STYLES}
      </style>
      <AnimatePresence mode="wait">
        <motion.div key={routeKey} {...fade}>
          {routeEl}
        </motion.div>
      </AnimatePresence>
    </>
  );
}

function BootSplash() {
  return (
    <div className="rv-report min-h-screen flex items-center justify-center">
      <style>{REPORT_STYLES}</style>
      <div className="flex flex-col items-center gap-6">
        <Wordmark size={30} />
        <Spinner size={18} className="text-[var(--ink-muted)]" />
      </div>
    </div>
  );
}

function Dashboard({
  onLogout,
  guest = false,
  onCreateAccount,
  onExitGuest,
  initialTrackUrl,
}: {
  onLogout?: () => void;
  guest?: boolean;
  onCreateAccount?: () => void;
  onExitGuest?: () => void;
  initialTrackUrl?: string;
}) {
  const [pasteUrl, setPasteUrl] = useState(initialTrackUrl ?? "");
  const [jobId, setJobId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const trackMutation = useTrackUrl();
  const trackJob = useTrackJob(jobId);
  const watchesQuery = useWatches(!guest);

  // Onboarding answers decide what the browse feed shows. A signed-in user's
  // profile lives server-side, so the API applies it (personalized=1). A guest
  // has no server row at all, so their localStorage answers are translated
  // into the same query params here — same feed either way.
  const guestPrefs = useMemo(() => (guest ? readLocalOnboarding() : null), [guest]);
  const browseParams = useMemo(() => {
    if (!guest) return { limit: 1 };
    const base = { sort: "deal_score" as const, limit: 30 };
    if (!guestPrefs || guestPrefs.completed_at === null) return base;
    return {
      ...base,
      minScore: SENSITIVITY_MIN_SCORE[guestPrefs.sensitivity],
      // The API takes one category per request; a multi-select guest gets
      // their first pick rather than an unfiltered feed.
      ...(guestPrefs.categories.length === 1
        ? { category: guestPrefs.categories[0] }
        : {}),
    };
  }, [guest, guestPrefs]);

  const browseQuery = useProducts(browseParams);

  // Suggestions for a signed-in user, filtered server-side by their stored
  // onboarding profile. Only fetched once they have actually onboarded —
  // otherwise it would just be the global feed under a "picked for you"
  // heading, which is a lie the user can see through immediately.
  const prefsQuery = usePreferences(!guest);
  const onboarded = prefsQuery.data?.onboarded === true;
  const suggestionsQuery = useProducts(
    { sort: "deal_score", personalized: true, limit: 6 },
    onboarded,
  );
  const suggestions = onboarded ? (suggestionsQuery.data ?? []) : [];

  const deleteWatchMutation = useDeleteWatch();

  function handleTrack(e: React.FormEvent) {
    e.preventDefault();
    if (guest) {
      onCreateAccount?.();
      return;
    }
    const url = pasteUrl.trim();
    if (!url) return;
    trackMutation.mutate(url, {
      onSuccess: (data) => setJobId(data.job_id),
    });
  }

  const stage = useMemo<string | null>(() => {
    if (trackMutation.isPending) return "queueing";
    const j = trackJob.data;
    if (!j) return null;
    if (TERMINAL_STATES.has(j.state)) return null;
    if (j.state === "PROGRESS" && typeof j.progress?.stage === "string") return j.progress.stage;
    if (j.state === "STARTED") return "started";
    if (j.state === "PENDING") return "queued";
    if (j.state === "RETRY") return "retrying";
    return "running";
  }, [trackMutation.isPending, trackJob.data]);

  const loadingTrack = stage !== null;

  const trackError =
    trackMutation.error?.message ??
    (trackJob.data?.state === "FAILURE" ? trackJob.data.error : null) ??
    trackJob.error?.message ??
    null;

  const trackResult = trackJob.data?.state === "SUCCESS" ? trackJob.data.result : null;

  const watches = guest ? [] : (watchesQuery.data ?? []);
  const guestProducts = guest ? (browseQuery.data ?? []) : [];
  const watchlistLoading = guest ? browseQuery.isLoading : watchesQuery.isLoading;

  const rows: { product: Product; watch: Watch | null }[] = guest
    ? guestProducts.map((p) => ({ product: p, watch: null }))
    : watches.map((w) => ({ product: w.product, watch: w }));

  const scored = rows.filter((r) => r.product.deal_score != null);
  const atLowest = rows.filter((r) => r.product.is_lowest_ever).length;

  return (
    <div className="rv-report rv-page min-h-screen flex flex-col">
      <style>{REPORT_STYLES}</style>

      <TopBar
        links={[
          { href: "#", label: "Today's deals" },
          ...(!guest ? [{ href: "#/alerts", label: "Alerts" }] : []),
        ]}
        activeHref="#"
        status={guest ? `${guestProducts.length} products` : `${watches.length} tracked`}
        actions={
          guest ? (
            <>
              <Button variant="quiet" size="sm" onClick={onExitGuest}>Leave</Button>
              <Button variant="primary" size="sm" onClick={onCreateAccount}>Create account</Button>
            </>
          ) : (
            <Button variant="quiet" size="sm" onClick={onLogout}>Sign out</Button>
          )
        }
        menuOpen={menuOpen}
        onToggleMenu={() => setMenuOpen((v) => !v)}
      />

      <main className="flex-1 w-full">
        {/* ── TRACK ─────────────────────────────────── */}
        <section className="rv-dash-track">
          <div className="rv-dash-track-copy">
            <p className="rv-eyebrow">Track anything</p>
            <h1 className="rv-display rv-dash-title">
              Paste a link.<br />We&rsquo;ll watch the price.
            </h1>
            <p className="rv-dash-lede">
              We read the product off the page, record its price every day, and score every drop against
              its own history &mdash; then email you the moment it&rsquo;s genuinely cheaper.
            </p>
          </div>

          {/* Guests get the real reason instead of a form they can't submit —
              a disabled field behind a translucent wash explains nothing. */}
          {guest ? (
            <Panel label="Tracking a product">
              <p className="rv-panel-lead">Tracking needs an account.</p>
              <p className="rv-dash-guest-body">
                Create a free account to track your own products and get price-drop alerts.
                Browsing today&rsquo;s deals stays free, and you can keep doing it without one.
              </p>
              <Button variant="primary" onClick={onCreateAccount}>Create a free account</Button>
            </Panel>
          ) : (
          <Panel label="Add a product" className="rv-dash-form-panel">
            <form onSubmit={handleTrack} className="rv-dash-form">
              <label className="rv-dash-field">
                <span className="rv-eyebrow">Product URL</span>
                <input
                  type="url"
                  value={pasteUrl}
                  placeholder="https://shop.example.com/p/widget"
                  onChange={(e) => setPasteUrl(e.target.value)}
                  className="rv-input"
                />
              </label>

              <div className="rv-dash-form-actions">
                <Button type="submit" variant="primary" disabled={loadingTrack}>
                  {loadingTrack && <Spinner size={14} className="text-current" />}
                  <span>{loadingTrack ? (STAGE_LABELS[stage!] ?? "Working") : "Track it"}</span>
                  {!loadingTrack && <Arrow size={12} />}
                </Button>
                {jobId && <span className="rv-tag">job {jobId.slice(0, 8)}</span>}
              </div>

              {trackError && (
                <p className="rv-dash-error" role="alert">{trackError}</p>
              )}

              {trackResult && !loadingTrack && (
                <p className="rv-dash-ok">
                  {trackResult.created
                    ? "Tracking started. The first reading is recorded."
                    : "Already tracked — it's on your list."}{" "}
                  <a href={`#/product/${trackResult.product_id}`} className="rv-link">See its history</a>
                </p>
              )}
            </form>
          </Panel>
          )}
        </section>

        {/* ── WATCHLIST / BROWSE ────────────────────────── */}
        <div className="rv-dash-list-band">
          <section className="rv-dash-list">
            <div className="rv-dash-list-main">
              <Panel
                label={guest ? "Today's deals" : "Your tracked products"}
                aside={
                  rows.length > 0
                    ? `${rows.length} tracked · ${atLowest} at lowest ever`
                    : undefined
                }
              >
                {watchlistLoading ? (
                  <ResultsSkeleton />
                ) : rows.length === 0 ? (
                  <EmptyResults guest={guest} />
                ) : (
                  <ol className="rv-watchlist">
                    {rows.map(({ product, watch }) => (
                      <li key={product.id}>
                        <WatchRow
                          product={product}
                          watch={watch}
                          onUnwatch={(id) => deleteWatchMutation.mutate(id)}
                        />
                      </li>
                    ))}
                  </ol>
                )}
              </Panel>
            </div>

            <aside className="rv-dash-aside">
              {/* Suggestions from the onboarding answers. Only rendered once
                  there is something to show — an empty "picked for you" is
                  worse than no panel at all. */}
              {/* Onboarded, but nothing in their categories clears their
                  threshold. Said plainly — the server deliberately does not
                  substitute unrelated products to fill the panel. */}
              {!guest && onboarded && !suggestionsQuery.isLoading &&
                suggestions.length === 0 && (
                  <Panel label="Picked for you">
                    <p className="rv-dash-note">
                      Nothing in{" "}
                      {prefsQuery.data?.onboarding?.categories.length
                        ? prefsQuery.data.onboarding.categories
                            .map(categoryLabel)
                            .join(" or ")
                        : "your categories"}{" "}
                      clears your score threshold right now. We would rather
                      show you nothing than pad this with products you did not
                      ask for.{" "}
                      <a href="#/onboarding" className="rv-link">
                        Loosen your answers
                      </a>
                    </p>
                  </Panel>
                )}

              {!guest && suggestions.length > 0 && (
                <Panel
                  label="Picked for you"
                  aside={
                    prefsQuery.data?.onboarding?.categories.length
                      ? prefsQuery.data.onboarding.categories
                          .map(categoryLabel)
                          .join(" · ")
                      : undefined
                  }
                >
                  <ol className="rv-suggest">
                    {suggestions.map((p) => (
                      <li key={p.id}>
                        <a className="rv-suggest-row" href={`#/product/${p.id}`}>
                          <ProductImage
                            image={productImage(p.image_url, p.title ?? "Product")}
                            ratio="1 / 1"
                            className="rv-suggest-thumb"
                          />
                          <span className="rv-suggest-text">
                            <span className="rv-suggest-title">
                              {p.title ?? p.domain}
                            </span>
                            <span className="rv-suggest-figures">
                              <b className="rv-num">
                                {p.latest_price != null
                                  ? formatMoney(p.latest_price, p.currency ?? "USD")
                                  : "—"}
                              </b>
                              <Delta
                                pct={
                                  p.stats?.discount_vs_median_pct ?? null
                                }
                                size="sm"
                              />
                            </span>
                          </span>
                          {p.deal_score != null && (
                            <span className="rv-suggest-score rv-num">
                              {Math.round(p.deal_score)}
                            </span>
                          )}
                        </a>
                      </li>
                    ))}
                  </ol>
                  <p className="rv-dash-note">
                    Matched to what you told us you shop for, then ranked by the
                    same score as everything else.{" "}
                    <a href="#/onboarding" className="rv-link">Change your answers</a>
                  </p>
                </Panel>
              )}

              {scored.length > 0 && (
                <Panel label="Score distribution" aside={`${scored.length} scored`}>
                  <ScoreHistogram products={scored.map((r) => ({ deal_score: r.product.deal_score }))} />
                  <p className="rv-dash-note">
                    How the products you follow are spread across the 0&ndash;100 scale. Only the top
                    band is a genuinely strong deal.
                  </p>
                </Panel>
              )}
              <Panel label="Reading a score">
                <dl className="rv-legend">
                  <div>
                    <dt><Stamp tone="signal">70 and up</Stamp></dt>
                    <dd>A deep discount, rarely this cheap, off a price that was stable beforehand.</dd>
                  </div>
                  <div>
                    <dt><Stamp tone="quiet">40 to 69</Stamp></dt>
                    <dd>A real but modest drop, or a good price on a product whose price moves often.</dd>
                  </div>
                  <div>
                    <dt><Stamp tone="caution">Under 40</Stamp></dt>
                    <dd>The arithmetic doesn&rsquo;t back the claim. Often a price raised, then &ldquo;dropped&rdquo; to baseline.</dd>
                  </div>
                </dl>
              </Panel>
            </aside>
          </section>
        </div>
      </main>

      <footer className="rv-dash-footer">
        <Wordmark size={18} />
        <span className="rv-tag">&copy; 2026 &middot; Prices recorded daily, never overwritten</span>
      </footer>
    </div>
  );
}

function WatchRow({
  product,
  watch,
  onUnwatch,
}: {
  product: Product;
  watch: Watch | null;
  onUnwatch?: (watchId: string) => void;
}) {
  const historyQuery = usePriceHistory(product.id, "90");
  const points = historyQuery.data?.points ?? [];
  const currency = product.currency ?? "USD";
  const delta = product.stats?.discount_vs_median_pct ?? null;

  return (
    <div className="rv-wrow">
      <a href={`#/product/${product.id}`} className="rv-wrow-product">
        <ProductImage
          image={productImage(product.image_url, product.title ?? product.domain)}
          ratio="1 / 1"
          className="rv-wrow-thumb"
        />
        <span className="rv-wrow-names">
          <span className="rv-wrow-title">{product.title ?? product.domain}</span>
          <span className="rv-wrow-domain rv-num">{product.domain}</span>
        </span>
      </a>

      <span className="rv-wrow-spark">
        <Sparkline points={points} median={product.median_90d} />
      </span>

      <span className="rv-wrow-price rv-num">
        {product.latest_price != null ? formatMoney(product.latest_price, currency) : "—"}
      </span>

      <span className="rv-wrow-delta">
        <Delta pct={delta} size="md" />
      </span>

      <span className="rv-wrow-score">
        {product.deal_score != null ? (
          <b className="rv-wrow-score-v rv-num">{Math.round(product.deal_score)}</b>
        ) : (
          <Stamp tone="quiet">{Math.max(0, 14 - (product.stats?.coverage_days ?? 0))}d</Stamp>
        )}
        {product.is_lowest_ever && <Stamp tone="signal">Lowest</Stamp>}
      </span>

      {watch ? (
        <button onClick={() => onUnwatch?.(watch.id)} className="rv-wrow-unwatch">Stop</button>
      ) : (
        <span />
      )}
    </div>
  );
}

// First-load skeleton — quiet, no spinner.
function ResultsSkeleton() {
  return (
    <div aria-hidden>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="rv-skel-row">
          <div className="rv-skel rv-skel-thumb" />
          <div className="rv-skel-lines">
            <div className="rv-skel" style={{ height: 14, width: "48%" }} />
            <div className="rv-skel" style={{ height: 11, width: "26%" }} />
          </div>
          <div className="rv-skel" style={{ height: 20, width: 90 }} />
        </div>
      ))}
    </div>
  );
}

// An empty screen is an invitation to act, so it names the next action and
// sets the expectation that follows from it.
function EmptyResults({ guest }: { guest: boolean }) {
  return (
    <div className="rv-empty">
      <EmptyAxis width={620} height={180} label="No readings recorded yet" />
      <p className="rv-empty-title">
        {guest ? "No products are being tracked yet." : "You aren't tracking anything yet."}
      </p>
      <p className="rv-empty-body">
        {guest
          ? "Once products are tracked, the best-scoring ones appear here, ranked by how well each drop stands up to its own price history."
          : "Paste a product URL above. We record its price from today and recheck it every day — the score unlocks once there are fourteen days of history behind it."}
      </p>
    </div>
  );
}

const REPORT_STYLES = `
  /* ── Picked-for-you suggestions ── */
  .rv-suggest { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
  .rv-suggest > li + li { border-top: 1px solid var(--rule); }
  .rv-suggest-row {
    display: flex; align-items: center; gap: 11px; padding: 10px 0;
    text-decoration: none; min-width: 0;
  }
  .rv-suggest-thumb {
    width: 40px; height: 40px; flex: none;
    border-radius: var(--r-sm); box-shadow: var(--img-ring);
  }
  .rv-suggest-text { display: flex; flex-direction: column; gap: 3px; min-width: 0; flex: 1; }
  .rv-suggest-title {
    font-size: 13.5px; font-weight: 600; color: var(--ink); letter-spacing: -0.01em;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .rv-suggest-row:hover .rv-suggest-title { text-decoration: underline; text-underline-offset: 3px; }
  .rv-suggest-figures { display: flex; align-items: baseline; gap: 9px; }
  .rv-suggest-figures b { font-size: 14px; font-weight: 600; color: var(--ink); }
  .rv-suggest-score {
    flex: none; font-size: 13px; font-weight: 600; color: var(--ink-muted);
    padding: 3px 8px; border-radius: var(--r-pill); background: var(--paper-deep);
  }

  .rv-report { background: var(--paper); color: var(--ink); font-family: var(--font-sans); }

  /* ── Track ── */
  .rv-dash-track {
    max-width: 1180px; margin: 0 auto; width: 100%; padding: 56px 24px 56px;
    display: grid; grid-template-columns: 1.05fr 1fr; gap: 56px; align-items: start;
  }
  .rv-dash-track-copy { align-self: center; }
  .rv-dash-title { font-size: clamp(34px, 4.6vw, 56px); margin: 14px 0 0; }
  .rv-dash-lede { margin: 20px 0 0; font-size: 16px; line-height: 1.62; color: var(--ink-muted); max-width: 46ch; }

  .rv-dash-form-panel { position: relative; }
  .rv-dash-form { position: relative; }
  .rv-dash-field { display: flex; flex-direction: column; gap: 7px; }
  .rv-dash-form-actions { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; margin-top: 20px; }
  .rv-dash-error {
    margin: 18px 0 0; font-size: 13.5px; line-height: 1.55; color: var(--red-deep);
    background: var(--red-tint); padding: 10px 12px; border-left: 2px solid var(--red);
  }
  .rv-dash-ok { margin: 18px 0 0; font-size: 13.5px; color: var(--green-deep); }
  .rv-dash-guest-body { margin: 0 0 20px; font-size: 14px; line-height: 1.62; color: var(--ink-muted); max-width: 48ch; }

  /* ── List ── */
  .rv-dash-list-band { border-top: 1px solid var(--rule); background: var(--paper-soft); }
  .rv-dash-list {
    max-width: 1180px; margin: 0 auto; width: 100%; padding: 48px 24px 72px;
    display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 48px; align-items: start;
  }
  .rv-dash-aside { display: flex; flex-direction: column; gap: 32px; position: sticky; top: 80px; }
  .rv-dash-note { margin: 14px 0 0; font-size: 12.5px; line-height: 1.6; color: var(--ink-muted); }

  .rv-legend { margin: 0; display: flex; flex-direction: column; gap: 16px; }
  .rv-legend dt { margin-bottom: 6px; }
  .rv-legend dd { margin: 0; font-size: 13px; line-height: 1.55; color: var(--ink-muted); }

  /* ── Watchlist rows ── */
  .rv-watchlist { list-style: none; margin: 0; padding: 0; }
  .rv-watchlist > li { border-bottom: 1px solid var(--rule); }
  .rv-watchlist > li:last-child { border-bottom: 0; }
  .rv-wrow {
    display: grid; grid-template-columns: minmax(0, 1fr) 132px 108px 92px 92px 52px;
    gap: 16px; align-items: center; padding: 14px 0;
  }
  .rv-wrow-product { display: flex; align-items: center; gap: 12px; min-width: 0; text-decoration: none; }
  .rv-wrow-thumb { width: 38px; height: 38px; flex: none; border-radius: var(--img-radius); box-shadow: var(--img-ring); }
  .rv-wrow-names { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
  .rv-wrow-title {
    font-size: 14px; font-weight: 600; color: var(--ink); letter-spacing: -0.01em;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .rv-wrow-product:hover .rv-wrow-title { text-decoration: underline; text-underline-offset: 3px; }
  .rv-wrow-domain { font-size: 11.5px; color: var(--ink-muted); }
  .rv-wrow-spark { display: flex; }
  .rv-wrow-price { text-align: right; font-size: 15px; font-weight: 600; }
  .rv-wrow-delta { display: flex; justify-content: flex-end; }
  .rv-wrow-score { display: flex; flex-direction: column; align-items: flex-end; gap: 5px; }
  .rv-wrow-score-v { font-size: 20px; font-weight: 600; letter-spacing: -0.02em; }
  .rv-wrow-unwatch {
    font-family: var(--font-mono); font-size: 11px; font-weight: 600; letter-spacing: .08em;
    text-transform: uppercase; color: var(--ink-muted); background: none; cursor: pointer;
    padding: 6px 4px; justify-self: end; transition: color var(--dur-fast) ease;
  }
  .rv-wrow-unwatch:hover { color: var(--red); }

  /* ── Skeleton + empty ── */
  .rv-skel-row {
    display: grid; grid-template-columns: 38px minmax(0, 1fr) 90px; gap: 14px;
    align-items: center; padding: 16px 0; border-bottom: 1px solid var(--rule);
  }
  .rv-skel-thumb { width: 38px; height: 38px; }
  .rv-skel-lines { display: flex; flex-direction: column; gap: 8px; }
  .rv-skel {
    background: linear-gradient(90deg, var(--paper-deep) 25%, var(--paper-soft) 37%, var(--paper-deep) 63%);
    background-size: 400% 100%; animation: rv-shimmer 1.5s ease-in-out infinite;
  }
  @keyframes rv-shimmer { 0% { background-position: 100% 0; } 100% { background-position: 0 0; } }

  .rv-empty { padding: 24px 0 32px; text-align: center; }
  .rv-empty-title { margin: 20px 0 0; font-size: 17px; font-weight: 600; color: var(--ink); }
  .rv-empty-body { margin: 10px auto 0; font-size: 14px; line-height: 1.6; color: var(--ink-muted); max-width: 50ch; }

  /* ── Footer ── */
  .rv-dash-footer {
    border-top: 1px solid var(--rule); background: var(--paper-pale);
    max-width: none; padding: 24px;
    display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;
  }

  @media (max-width: 1024px) {
    .rv-dash-track { grid-template-columns: 1fr; gap: 40px; }
    .rv-dash-list { grid-template-columns: 1fr; gap: 40px; }
    .rv-dash-aside { position: static; flex-direction: row; flex-wrap: wrap; }
    .rv-dash-aside > * { flex: 1 1 280px; }
  }

  @media (max-width: 760px) {
    .rv-dash-track { padding: 40px 18px; }
    .rv-dash-list { padding: 36px 18px 56px; }
    .rv-wrow {
      grid-template-columns: minmax(0, 1fr) auto;
      grid-template-areas:
        "product product"
        "spark   spark"
        "price   score"
        "delta   unwatch";
      gap: 12px;
    }
    .rv-wrow-product { grid-area: product; }
    .rv-wrow-spark { grid-area: spark; }
    .rv-wrow-spark svg { width: 100%; height: 38px; }
    .rv-wrow-price { grid-area: price; text-align: left; }
    .rv-wrow-delta { grid-area: delta; justify-content: flex-start; }
    .rv-wrow-score { grid-area: score; flex-direction: row; align-items: center; }
    .rv-wrow-unwatch { grid-area: unwatch; }
    .rv-wrow-domain { overflow-wrap: anywhere; }
    .rv-wrow-title { white-space: normal; overflow: visible; }
  }

  @media (prefers-reduced-motion: reduce) {
    .rv-skel { animation: none; }
  }
`;
