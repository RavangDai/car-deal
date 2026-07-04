import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion, type Variants } from "framer-motion";
import { hasSessionHint, isGuest, setGuestMode } from "./api";
import type { Product, Watch } from "./api";
import {
  useDeleteWatch,
  useLogoutMutation,
  useMe,
  usePriceHistory,
  useProducts,
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
import { formatMoney } from "./format";
import ProductDetailPage from "./ProductDetailPage";
import AlertsPage from "./AlertsPage";
import { Sparkline, ScoreHistogram } from "./charts";
import { Arrow, PRIMITIVE_STYLES } from "./primitives";

const TERMINAL_STATES: ReadonlySet<string> = new Set(["SUCCESS", "FAILURE"]);

const EASE_OUT_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1];

const dashContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};
const dashLine: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE_OUT_EXPO } },
};
const dashForm: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: EASE_OUT_EXPO, delay: 0.12 },
  },
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

export default function App() {
  const me = useMe();
  // An OAuth failure redirects back to "/?auth_error=..."; land on the login
  // page so LoginPage can surface the message.
  const [showLogin, setShowLogin] = useState(
    () => new URLSearchParams(window.location.search).has("auth_error")
  );
  const [guest, setGuest] = useState(isGuest);
  const [legal, setLegal] = useState<LegalKind | null>(readLegalHash);
  const [productId, setProductId] = useState<string | null>(readProductHash);
  const [onAlerts, setOnAlerts] = useState<boolean>(readIsAlertsHash);
  const [pendingUrl, setPendingUrl] = useState<string | undefined>(undefined);
  const logoutMut = useLogoutMutation();
  const prefersReduced = useReducedMotion();

  // Hash-based routing for the standalone legal pages (#/terms, #/privacy),
  // the per-product detail page (#/product/:id), and the alerts page
  // (#/alerts) — all reachable without coupling to the auth-derived routing.
  useEffect(() => {
    const onHash = () => {
      setLegal(readLegalHash());
      setProductId(readProductHash());
      setOnAlerts(readIsAlertsHash());
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
    setShowLogin(false);
  }

  // Enter the dashboard without an account (browse-only).
  function enterGuest() {
    setGuestMode(true);
    setGuest(true);
    setShowLogin(false);
  }

  // Leave guest mode to make a real account (kicks the login page into view).
  function goCreateAccount() {
    setGuestMode(false);
    setGuest(false);
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
  }

  // From the marketing homepage: "Get started" (optionally with a URL the
  // visitor already typed into the paste box) always routes to sign-in.
  function goToSignIn(url?: string) {
    if (url) setPendingUrl(url);
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
  } else if (bootstrapping) {
    routeKey = "boot";
    routeEl = <BootSplash />;
  } else if (me.data) {
    routeKey = "dashboard";
    routeEl = <Dashboard onLogout={handleLogout} initialTrackUrl={pendingUrl} />;
  } else if (guest) {
    routeKey = "guest";
    routeEl = <Dashboard guest onCreateAccount={goCreateAccount} onExitGuest={exitGuest} />;
  } else if (showLogin) {
    routeKey = "login";
    routeEl = <LoginPage onLogin={handleRealLogin} onGuest={enterGuest} />;
  } else {
    routeKey = "home";
    routeEl = <HomePage onGetStarted={goToSignIn} />;
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
      <style>{PRIMITIVE_STYLES}</style>
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
      <div className="flex flex-col items-center gap-5">
        <div className="flex items-center gap-2.5">
          <img src="/wic-logo.svg" alt="" aria-hidden className="w-9 h-9 object-contain" />
          <span className="text-[1.5rem] leading-none font-extrabold tracking-[-0.02em]">WasItCheaper</span>
        </div>
        <Spinner size={20} className="text-[var(--ink-muted)]" />
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

  const trackMutation = useTrackUrl();
  const trackJob = useTrackJob(jobId);
  const watchesQuery = useWatches(!guest);
  const browseQuery = useProducts(guest ? { sort: "deal_score", limit: 30 } : { limit: 1 });
  const deleteWatchMutation = useDeleteWatch();
  const prefersReduced = useReducedMotion();
  const initial = prefersReduced ? "show" : "hidden";

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

  return (
    <div className="rv-report min-h-screen flex flex-col">
      <style>{REPORT_STYLES}</style>

      {/* ── HEADER — floating frosted pill ── */}
      <header className="rv-dash-nav">
        <div className="rv-dash-nav-inner">
          <a href="#" className="rv-dash-brand">
            <img src="/wic-logo.svg" alt="" aria-hidden className="w-[26px] h-[26px] object-contain" />
            <span className="rv-dash-name">WasItCheaper</span>
            <span className="rv-dash-tag">Tracked products</span>
          </a>
          <div className="rv-dash-actions">
            {!guest && <a href="#/alerts" className="rv-dash-ghost">Alerts</a>}
            {guest ? (
              <>
                <button onClick={onExitGuest} className="rv-dash-ghost">Exit</button>
                <button onClick={onCreateAccount} className="rv-btn rv-btn-primary rv-btn-sm">
                  Create account
                </button>
              </>
            ) : (
              <button onClick={onLogout} className="rv-dash-ghost">Sign out</button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 w-full">
        {/* ── TRACK ─────────────────────────────────── */}
        <motion.section
          className="max-w-[1180px] mx-auto w-full px-6 md:px-10 grid lg:grid-cols-[1.05fr_1fr] gap-10 lg:gap-16 pt-12 pb-12"
          variants={dashContainer}
          initial={initial}
          animate="show"
        >
          <div className="self-center">
            <motion.p className="rv-eyebrow mb-5" variants={dashLine}>
              Track anything
            </motion.p>
            <motion.h1
              className="display text-[clamp(2.4rem,5vw,3.8rem)] leading-[0.98] mb-5"
              variants={dashLine}
            >
              Paste a link.<br />We'll watch the price.
            </motion.h1>
            <motion.p
              className="text-[16px] leading-relaxed text-[var(--ink-muted)] max-w-[44ch]"
              variants={dashLine}
            >
              We extract the product, track its price daily, and score every
              drop against real history — then alert you the moment it's
              genuinely cheaper.
            </motion.p>
          </div>

          <motion.form
            onSubmit={handleTrack}
            variants={dashForm}
            className="relative rv-bezel self-start"
          >
            <div className="rv-bezel-core p-6 md:p-7">
              <h2 className="text-[15px] font-bold mb-6">Track a product</h2>

              <div className="space-y-5">
                <Field
                  label="Product URL"
                  value={pasteUrl}
                  onChange={setPasteUrl}
                  placeholder="https://shop.example.com/p/widget"
                  disabled={guest}
                />
              </div>

              <div className="mt-7 flex items-center justify-between gap-4 flex-wrap">
                <button type="submit" disabled={loadingTrack || guest} className="rv-btn rv-btn-primary">
                  {loadingTrack && <Spinner size={14} className="text-current" />}
                  <span>{loadingTrack ? (stage ?? "Tracking") : "Track it"}</span>
                  {!loadingTrack && (
                    <span className="rv-btn-icon"><Arrow size={12} /></span>
                  )}
                </button>
                {jobId && (
                  <span className="rv-tag">Job {jobId.slice(0, 8)}</span>
                )}
              </div>

              {trackError && (
                <p className="mt-5 text-[13.5px] text-[var(--err)] flex items-start gap-2">
                  <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-[var(--red)] text-white font-bold text-[10px] mt-0.5 shrink-0">!</span>
                  {trackError}
                </p>
              )}

              {trackResult && !loadingTrack && (
                <p className="mt-5 text-[13px] text-[var(--ink-muted)] flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[var(--green)] shrink-0" />
                  {trackResult.created ? "Tracking started." : "Already tracked — added to your list."}{" "}
                  <a href={`#/product/${trackResult.product_id}`} className="rv-link">View product</a>
                </p>
              )}

              {guest && <GuestLock onCreateAccount={onCreateAccount} />}
            </div>
          </motion.form>
        </motion.section>

        {/* ── WATCHLIST / BROWSE ────────────────────────── */}
        <div className="border-t border-[var(--rule)] bg-[var(--paper-soft)]">
          <section className="max-w-[1180px] mx-auto w-full px-6 md:px-10 grid lg:grid-cols-[1fr_300px] gap-10 lg:gap-14 pt-10 pb-16">
            <div>
              <div className="flex items-baseline justify-between gap-4 mb-5">
                <h2 className="display text-[1.6rem] leading-tight">
                  {guest ? "Today's deals" : "Your tracked products"}
                </h2>
                <span className="rv-tag whitespace-nowrap">
                  {guest ? `${guestProducts.length} products` : `${watches.length} tracked`}
                </span>
              </div>

              {watchlistLoading ? (
                <ResultsSkeleton />
              ) : guest && guestProducts.length === 0 ? (
                <EmptyResults guest />
              ) : !guest && watches.length === 0 ? (
                <EmptyResults guest={false} />
              ) : (
                <WatchRows
                  rows={
                    guest
                      ? guestProducts.map((p) => ({ product: p, watch: null }))
                      : watches.map((w) => ({ product: w.product, watch: w }))
                  }
                  onUnwatch={(id) => deleteWatchMutation.mutate(id)}
                />
              )}
            </div>

            <aside className="space-y-5 lg:sticky lg:top-[88px] self-start">
              {!guest && watches.length > 0 && (
                <div className="rv-bezel m-0">
                  <figure className="rv-bezel-core p-5 m-0">
                    <figcaption className="rv-eyebrow mb-3">Score distribution</figcaption>
                    <ScoreHistogram products={watches.map((w) => ({ deal_score: w.product.deal_score }))} />
                  </figure>
                </div>
              )}
              {guest && guestProducts.length > 0 && (
                <div className="rv-bezel m-0">
                  <figure className="rv-bezel-core p-5 m-0">
                    <figcaption className="rv-eyebrow mb-3">Score distribution</figcaption>
                    <ScoreHistogram products={guestProducts.map((p) => ({ deal_score: p.deal_score }))} />
                  </figure>
                </div>
              )}
              <div className="rv-bezel">
                <div className="rv-bezel-core p-5">
                  <p className="text-[13px] leading-relaxed text-[var(--ink-muted)]">
                    <span className="text-[var(--green)] font-semibold">Great price</span> means a
                    verified discount against 90 days of real history;{" "}
                    <span className="text-[var(--amber-deep)] font-semibold">wait</span> means the
                    math says it isn't a real drop yet.
                  </p>
                </div>
              </div>
            </aside>
          </section>
        </div>
      </main>

      {/* ── FOOTER ───────────────────────────────────────── */}
      <footer className="border-t border-[var(--rule)] bg-[var(--paper-pale)]">
        <div className="max-w-[1180px] mx-auto px-6 md:px-10 py-7 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <span className="text-[14px] font-semibold">WasItCheaper</span>
          <span className="rv-tag">© 2026 · Set in Manrope</span>
        </div>
      </footer>
    </div>
  );
}

const cardGrid: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05, delayChildren: 0.04 } },
};
const cardItem: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE_OUT_EXPO } },
};

function WatchRows({
  rows,
  onUnwatch,
}: {
  rows: { product: Product; watch: Watch | null }[];
  onUnwatch?: (watchId: string) => void;
}) {
  return (
    <motion.ol
      className="rv-lotindex list-none m-0 p-0"
      variants={cardGrid}
      initial="hidden"
      animate="show"
      key={rows.length}
    >
      {rows.map(({ product, watch }) => (
        <motion.li key={product.id} variants={cardItem}>
          <WatchRow product={product} watch={watch} onUnwatch={onUnwatch} />
        </motion.li>
      ))}
    </motion.ol>
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

  return (
    <div className="rv-lotrow group">
      <a href={`#/product/${product.id}`} className="rv-lotrow-link">
        <ProductImage
          image={productImage(product.image_url, product.title ?? product.domain)}
          ratio="4 / 3"
          className="rv-lotrow-thumb"
        />
        <div className="min-w-0">
          <h3 className="rv-lotrow-title">{product.title ?? product.domain}</h3>
          <p className="rv-lotrow-domain">{product.domain}</p>
          <div className="rv-lotrow-spark"><Sparkline points={points} /></div>
        </div>
        <div className="rv-lotrow-right">
          <ScoreBadge score={product.deal_score} isLowestEver={product.is_lowest_ever} />
          <span className="rv-lotrow-price tabular-nums">
            {product.latest_price != null ? formatMoney(product.latest_price, currency) : "—"}
          </span>
        </div>
      </a>
      {watch ? (
        <button onClick={() => onUnwatch?.(watch.id)} className="rv-lotrow-unwatch">Unwatch</button>
      ) : (
        <span />
      )}
    </div>
  );
}

function ScoreBadge({ score, isLowestEver }: { score: number | null; isLowestEver: boolean }) {
  if (score == null) {
    return <span className="rv-tag">score locked</span>;
  }
  const tier = score >= 70 ? "best" : score >= 40 ? "rec" : "thin";
  const label = tier === "best" ? "Great price" : tier === "rec" ? "Fair" : "Wait";
  return (
    <span className="flex items-center gap-1.5 flex-wrap justify-end">
      {isLowestEver && <span className="rv-badge rv-badge--best">Lowest ever</span>}
      <span className={`rv-badge rv-badge--${tier}`}>{label} · {Math.round(score)}</span>
    </span>
  );
}

// Clean labeled input.
function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  disabled = false,
}: {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="block rv-eyebrow mb-1.5">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="rv-input"
      />
    </label>
  );
}

function GuestLock({ onCreateAccount }: { onCreateAccount?: () => void }) {
  return (
    <div className="rv-guest-lock">
      <div className="rv-guest-lock-card">
        <p className="text-[1.15rem] font-bold leading-tight mb-1.5">
          Tracking needs an account
        </p>
        <p className="text-[13.5px] text-[var(--ink-muted)] max-w-[34ch] mb-5 leading-relaxed">
          Create a free account to track products and get price-drop alerts. Browsing today's deals stays free.
        </p>
        <button onClick={onCreateAccount} className="rv-btn rv-btn-primary">
          Create a free account
        </button>
      </div>
    </div>
  );
}

// First-load skeleton — quiet shimmer, no spinner.
function ResultsSkeleton() {
  return (
    <div className="rv-lotindex" aria-hidden>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="rv-skel-row">
          <div className="rv-skel" style={{ aspectRatio: "4 / 3", width: "100%" }} />
          <div className="flex flex-col gap-2.5">
            <div className="rv-skel" style={{ height: 17, width: "54%" }} />
            <div className="rv-skel" style={{ height: 11, width: "34%" }} />
            <div className="rv-skel" style={{ height: 12, width: "46%" }} />
          </div>
          <div className="hidden sm:flex flex-col items-end gap-2.5">
            <div className="rv-skel" style={{ height: 18, width: 90, borderRadius: 999 }} />
            <div className="rv-skel" style={{ height: 13, width: 104 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// Empty state that teaches the interface rather than just saying "nothing here".
function EmptyResults({ guest }: { guest: boolean }) {
  return (
    <div className="rv-bezel">
      <div className="rv-bezel-core text-center px-6 py-16">
        <span className="rv-empty-mark" aria-hidden>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" />
          </svg>
        </span>
        <p className="display text-[1.4rem] mb-1.5">{guest ? "No deals to show yet." : "Nothing tracked yet."}</p>
        <p className="text-[14px] text-[var(--ink-muted)] max-w-[40ch] mx-auto leading-relaxed">
          {guest
            ? "Check back soon — new products are tracked and scored daily."
            : "Paste a product URL above to start tracking its price history."}
        </p>
      </div>
    </div>
  );
}

const REPORT_STYLES = `
  .rv-report {
    background: var(--paper);
    color: var(--ink);
    font-family: 'Manrope', sans-serif;
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
  }

  .rv-report .display {
    font-family: var(--font-display);
    font-weight: 800;
    letter-spacing: -0.03em;
    line-height: 1.06;
    text-wrap: balance;
  }

  .rv-report .rv-emph { color: var(--primary); }

  /* Dashboard nav — dark frosted floating pill, matched to the marketing nav. */
  .rv-report .rv-dash-nav {
    position: sticky; top: 0; z-index: var(--z-sticky-nav);
    display: flex; justify-content: center;
    padding: 14px 16px 0; pointer-events: none;
  }
  .rv-report .rv-dash-nav-inner {
    pointer-events: auto; width: min(1180px, 100%);
    display: flex; align-items: center; justify-content: space-between; gap: 18px;
    padding: 9px 11px 9px 18px;
    background: var(--frost-dark);
    -webkit-backdrop-filter: var(--frost-blur);
    backdrop-filter: var(--frost-blur);
    border: 1px solid rgba(255,255,255,.10);
    border-radius: var(--r-pill);
    box-shadow: var(--pill-shadow);
  }
  .rv-report .rv-dash-brand { display: inline-flex; align-items: center; gap: 10px; min-width: 0; }
  .rv-report .rv-dash-name { font-weight: 800; font-size: 18px; letter-spacing: -0.02em; color: #fff; line-height: 1; }
  .rv-report .rv-dash-tag {
    font-size: 12px; font-weight: 600; color: rgba(255,255,255,.62);
    border-left: 1px solid rgba(255,255,255,.22); padding-left: 11px; white-space: nowrap;
  }
  @media (max-width: 560px) { .rv-report .rv-dash-tag { display: none; } }
  .rv-report .rv-dash-actions { display: flex; align-items: center; gap: 16px; }
  .rv-report .rv-dash-ghost { font-size: 13.5px; font-weight: 600; color: rgba(255,255,255,.82); transition: color .15s ease; }
  .rv-report .rv-dash-ghost:hover { color: #fff; }

  .rv-report .font-mono { font-family: 'Manrope', sans-serif; font-variant-numeric: tabular-nums; }

  .rv-report .rv-tag {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.04em;
    color: var(--ink-muted);
    font-variant-numeric: tabular-nums;
  }

  .rv-report .rv-link {
    font-size: 13.5px;
    font-weight: 600;
    color: var(--ink-muted);
    transition: color 0.15s ease;
  }
  .rv-report .rv-link:hover { color: var(--ink); }

  /* Inputs. */
  .rv-report .rv-input {
    width: 100%;
    min-width: 0;
    background: var(--paper-pale);
    border: 1px solid var(--rule-strong);
    border-radius: 9px;
    font-family: 'Manrope', sans-serif;
    font-size: 14.5px;
    font-variant-numeric: tabular-nums;
    color: var(--ink);
    padding: 10px 12px;
    outline: none;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
  }
  .rv-report .rv-input:focus {
    border-color: var(--primary);
    box-shadow: 0 0 0 3px var(--primary-tint);
  }
  .rv-report .rv-input:disabled { opacity: 0.55; cursor: not-allowed; }
  .rv-report .rv-input::placeholder { color: var(--ink-fade); }

  /* Verdict pills. */
  .rv-report .rv-badge {
    display: inline-flex; align-items: center;
    padding: 3px 10px;
    border-radius: 999px;
    font-size: 11px; font-weight: 700;
    letter-spacing: 0.01em;
    white-space: nowrap;
  }
  .rv-report .rv-badge--best { background: var(--green-tint); color: var(--green-deep); }
  .rv-report .rv-badge--rec  { background: var(--green-tint); color: var(--green); }
  .rv-report .rv-badge--thin { background: var(--amber-tint); color: var(--amber-deep); }

  /* Tracked-products list. */
  .rv-report .rv-lotrow {
    display: grid;
    grid-template-columns: 64px minmax(0, 1fr) auto auto;
    gap: 4px 18px;
    align-items: center;
    padding: 18px 4px;
    border-top: 1px solid var(--rule);
    border-radius: 12px;
    transition: background-color 0.15s ease, box-shadow 0.25s var(--ease-out-expo);
  }
  .rv-report .rv-lotindex > li:first-child .rv-lotrow { border-top: none; }
  .rv-report .rv-lotrow:hover { background: var(--paper-pale); box-shadow: var(--shadow-md); }

  .rv-report .rv-lotrow-link { display: contents; text-decoration: none; color: inherit; }
  .rv-report .rv-lotrow-thumb { width: 64px; border-radius: 9px; align-self: center; }
  .rv-report .rv-lotrow-title {
    font-size: clamp(1.05rem, 2vw, 1.2rem); font-weight: 700; line-height: 1.25;
    display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden;
  }
  .rv-report .rv-lotrow-domain { font-size: 13px; color: var(--ink-muted); margin: 3px 0 6px; }
  .rv-report .rv-lotrow-spark { width: 120px; }
  .rv-report .rv-lotrow-right {
    display: flex; flex-direction: column;
    align-items: flex-end; justify-content: center;
    gap: 7px; text-align: right;
  }
  .rv-report .rv-lotrow-price { font-size: 16px; font-weight: 800; }
  .rv-report .rv-lotrow-unwatch {
    font-size: 12.5px; font-weight: 600; color: var(--ink-muted);
    padding: 6px 10px; border-radius: 999px; border: 1px solid var(--rule-strong);
    transition: color .15s ease, border-color .15s ease;
    white-space: nowrap; justify-self: end; align-self: center;
  }
  .rv-report .rv-lotrow-unwatch:hover { color: var(--err); border-color: var(--err); }

  /* Skeletons — quiet shimmer for first load (no spinner-in-content). */
  .rv-report .rv-skel { position: relative; overflow: hidden; background: var(--paper-soft); border-radius: 7px; }
  .rv-report .rv-skel::after {
    content: ""; position: absolute; inset: 0;
    background: linear-gradient(100deg, rgba(255,255,255,0) 30%, rgba(255,255,255,.6) 50%, rgba(255,255,255,0) 70%);
    background-size: 220% 100%; animation: rv-skel-sh 1.4s var(--ease-out-expo) infinite;
  }
  @keyframes rv-skel-sh { to { background-position: -120% 0; } }
  .rv-report .rv-skel-row {
    display: grid; grid-template-columns: 64px minmax(0, 1fr) auto;
    gap: 4px 18px; align-items: center; padding: 18px 4px; border-top: 1px solid var(--rule);
  }
  .rv-report .rv-skel-row:first-child { border-top: none; }

  /* Empty state mark. */
  .rv-report .rv-empty-mark {
    display: inline-flex; align-items: center; justify-content: center;
    width: 46px; height: 46px; margin-bottom: 16px;
    border-radius: 50%; background: var(--paper-soft); color: var(--ink-muted);
    border: 1px solid var(--rule);
  }

  @media (max-width: 760px) {
    .rv-report .rv-lotrow,
    .rv-report .rv-skel-row { grid-template-columns: 56px minmax(0, 1fr); }
    .rv-report .rv-lotrow-right {
      grid-column: 1 / -1;
      flex-direction: row; align-items: center; justify-content: flex-start;
      flex-wrap: wrap; gap: 10px;
      margin-top: 8px;
    }
    .rv-report .rv-lotrow-unwatch { grid-column: 1 / -1; justify-self: start; }
  }

  /* Guest lock — plain frosted card, no blur. */
  .rv-report .rv-guest-lock {
    position: absolute; inset: 0;
    display: flex; align-items: center; justify-content: center;
    padding: 24px;
    border-radius: var(--r-card);
    background: var(--frost-light);
    -webkit-backdrop-filter: var(--frost-blur);
    backdrop-filter: var(--frost-blur);
  }
  .rv-report .rv-guest-lock-card {
    display: flex; flex-direction: column; align-items: center;
    text-align: center;
  }
`;
