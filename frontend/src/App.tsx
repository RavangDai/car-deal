import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion, type Variants } from "framer-motion";
import { hasSessionHint, isGuest, setGuestMode } from "./api";
import {
  useDeals,
  useLogoutMutation,
  useMe,
  useScrapeJob,
  useScrapeMutation,
} from "./hooks";
import LoginPage from "./LoginPage";
import HomePage from "./HomePage";
import LegalPage, { type LegalKind } from "./LegalPage";
import { Spinner } from "./Spinner";
import { CarImage } from "./CarImage";
import { thumbFor } from "./images";
import { UndervalueHistogram, PriceScatter } from "./charts";
import { FONT_IMPORT, THEME_TOKENS } from "./theme";

type Deal = {
  id: string;
  source: string;
  url: string;
  title: string;
  description: string;
  listed_price: number;
  predicted_price: number;
  undervalue_percent: number;
  year: number;
  make: string;
  model: string;
  mileage: number | null;
  location: string;
  created_at: string;
  posted_at: string;
};

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

export default function App() {
  const me = useMe();
  // An OAuth failure redirects back to "/?auth_error=..."; land on the login
  // page so LoginPage can surface the message.
  const [showLogin, setShowLogin] = useState(
    () => new URLSearchParams(window.location.search).has("auth_error")
  );
  const [guest, setGuest] = useState(isGuest);
  const [legal, setLegal] = useState<LegalKind | null>(readLegalHash);
  const logoutMut = useLogoutMutation();
  const prefersReduced = useReducedMotion();

  // Hash-based routing for the standalone legal pages (#/terms, #/privacy) so
  // footer/login links navigate without coupling to the auth-derived routing.
  useEffect(() => {
    const onHash = () => setLegal(readLegalHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  function closeLegal() {
    // Drop the fragment without leaving a bare "#" in the URL.
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    setLegal(null);
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

  // Pick the active route. Legal pages are reachable from any state.
  let routeKey: string;
  let routeEl: ReactNode;
  if (legal) {
    routeKey = `legal-${legal}`;
    routeEl = <LegalPage kind={legal} onBack={closeLegal} />;
  } else if (bootstrapping) {
    routeKey = "boot";
    routeEl = <BootSplash />;
  } else if (me.data) {
    routeKey = "dashboard";
    routeEl = <Dashboard onLogout={handleLogout} />;
  } else if (guest) {
    routeKey = "guest";
    routeEl = <Dashboard guest onCreateAccount={goCreateAccount} onExitGuest={exitGuest} />;
  } else if (showLogin) {
    routeKey = "login";
    routeEl = <LoginPage onLogin={handleRealLogin} onGuest={enterGuest} />;
  } else {
    routeKey = "home";
    routeEl = <HomePage onGetStarted={() => setShowLogin(true)} />;
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
    <AnimatePresence mode="wait">
      <motion.div key={routeKey} {...fade}>
        {routeEl}
      </motion.div>
    </AnimatePresence>
  );
}

function BootSplash() {
  return (
    <div className="rv-report min-h-screen flex items-center justify-center">
      <style>{REPORT_STYLES}</style>
      <div className="flex flex-col items-center gap-5">
        <div className="flex items-center gap-2.5">
          <img src="/revveal-logo.png" alt="" aria-hidden className="w-9 h-9 object-contain" />
          <span className="text-[1.5rem] leading-none font-extrabold tracking-[-0.02em]">Revveal</span>
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
}: {
  onLogout?: () => void;
  guest?: boolean;
  onCreateAccount?: () => void;
  onExitGuest?: () => void;
}) {
  const [city, setCity] = useState("austin");
  const [query, setQuery] = useState("honda civic");
  const [maxResults, setMaxResults] = useState(10);
  const [minUndervalue, setMinUndervalue] = useState(10);
  const [jobId, setJobId] = useState<string | null>(null);

  const scrapeMutation = useScrapeMutation();
  const scrapeJob = useScrapeJob(jobId);
  const dealsQuery = useDeals(minUndervalue);
  const prefersReduced = useReducedMotion();
  const initial = prefersReduced ? "show" : "hidden";

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    // Live search is account-only — nudge guests toward sign-up instead.
    if (guest) {
      onCreateAccount?.();
      return;
    }
    scrapeMutation.mutate(
      { city, query, maxResults },
      { onSuccess: (data) => setJobId(data.job_id) },
    );
  }

  const stage = useMemo<string | null>(() => {
    if (scrapeMutation.isPending) return "queueing job";
    const s = scrapeJob.data;
    if (!s) return null;
    if (TERMINAL_STATES.has(s.state)) {
      if (s.state === "SUCCESS" && dealsQuery.isFetching) return "loading deals";
      return null;
    }
    if (s.state === "PROGRESS" && typeof s.progress?.stage === "string") return s.progress.stage;
    if (s.state === "STARTED") return "started";
    if (s.state === "PENDING") return "queued";
    if (s.state === "RETRY") return "retrying";
    return "running";
  }, [scrapeMutation.isPending, scrapeJob.data, dealsQuery.isFetching]);

  const loading = stage !== null;

  const error =
    scrapeMutation.error?.message ??
    (scrapeJob.data?.state === "FAILURE" ? scrapeJob.data.error : null) ??
    scrapeJob.error?.message ??
    dealsQuery.error?.message ??
    null;

  const jobSummary =
    scrapeJob.data?.state === "SUCCESS" ? scrapeJob.data.result : null;

  const dealsData = dealsQuery.data as Deal[] | undefined;
  const deals: Deal[] = useMemo(() => dealsData ?? [], [dealsData]);

  const totalSavings = useMemo(
    () => deals.reduce((sum, d) => sum + Math.max(0, d.predicted_price - d.listed_price), 0),
    [deals],
  );

  return (
    <div className="rv-report min-h-screen flex flex-col">
      <style>{REPORT_STYLES}</style>

      {/* ── HEADER — floating frosted pill (cohesive with marketing nav) ── */}
      <header className="rv-dash-nav">
        <div className="rv-dash-nav-inner">
          <a href="#" className="rv-dash-brand">
            <img src="/revveal-logo.png" alt="" aria-hidden className="w-[26px] h-[26px] object-contain" />
            <span className="rv-dash-name">Revveal</span>
            <span className="rv-dash-tag">Buyer dashboard</span>
          </a>
          {guest ? (
            <div className="rv-dash-actions">
              <button onClick={onExitGuest} className="rv-dash-ghost">Exit</button>
              <button onClick={onCreateAccount} className="rv-primary rv-primary--sm">
                Create account
              </button>
            </div>
          ) : (
            <button onClick={onLogout} className="rv-dash-ghost">Sign out</button>
          )}
        </div>
      </header>

      <main className="flex-1 w-full">
        {/* ── SEARCH ─────────────────────────────────────── */}
        <motion.section
          className="max-w-[1180px] mx-auto w-full px-6 md:px-10 grid lg:grid-cols-[1.05fr_1fr] gap-10 lg:gap-16 pt-12 pb-12"
          variants={dashContainer}
          initial={initial}
          animate="show"
        >
          <div className="self-center">
            <motion.p className="rv-eyebrow mb-5" variants={dashLine}>
              Live index
            </motion.p>
            <motion.h1
              className="display text-[clamp(2.4rem,5vw,3.8rem)] leading-[0.98] mb-5"
              variants={dashLine}
            >
              Find cars priced<br />below market.
            </motion.h1>
            <motion.p
              className="text-[16px] leading-relaxed text-[var(--ink-muted)] max-w-[44ch]"
              variants={dashLine}
            >
              Name a city and a model. We scan the live listings, price each
              against the model, and list every undervalued car below.
            </motion.p>
          </div>

          <motion.form
            onSubmit={handleSearch}
            variants={dashForm}
            className="relative rv-card p-6 md:p-7 self-start"
          >
            <h2 className="text-[15px] font-bold mb-6">New search</h2>

            <div className="space-y-5">
              <Field label="City" value={city} onChange={setCity} placeholder="austin" disabled={guest} />
              <Field label="Search query" value={query} onChange={setQuery} placeholder="honda civic" disabled={guest} />
              <div className="grid grid-cols-2 gap-4">
                <Field label="Max results" value={maxResults} type="number" onChange={(v) => setMaxResults(Number(v))} disabled={guest} />
                <Field label="Min save %" value={minUndervalue} type="number" onChange={(v) => setMinUndervalue(Number(v))} disabled={guest} />
              </div>
            </div>

            <div className="mt-7 flex items-center justify-between gap-4 flex-wrap">
              <button type="submit" disabled={loading || guest} className="rv-primary">
                {loading && <Spinner size={14} className="text-current" />}
                <span>{loading ? (stage ?? "Searching") : "Run search"}</span>
              </button>
              {jobId && (
                <span className="rv-tag">Job {jobId.slice(0, 8)}</span>
              )}
            </div>

            {error && (
              <p className="mt-5 text-[13.5px] text-[var(--err)] flex items-start gap-2">
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-[var(--red)] text-white font-bold text-[10px] mt-0.5 shrink-0">!</span>
                {error}
              </p>
            )}

            {jobSummary && !loading && (
              <p className="mt-5 text-[13px] text-[var(--ink-muted)] flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[var(--green)] shrink-0" />
                Done · {jobSummary.fetched} fetched · {jobSummary.inserted} new · {jobSummary.skipped} skipped
              </p>
            )}

            {guest && <GuestLock onCreateAccount={onCreateAccount} />}
          </motion.form>
        </motion.section>

        {/* ── RESULTS ────────────────────────────────────── */}
        <div className="border-t border-[var(--rule)] bg-[var(--paper-soft)]">
          <section className="max-w-[1180px] mx-auto w-full px-6 md:px-10 grid lg:grid-cols-[1fr_300px] gap-10 lg:gap-14 pt-10 pb-16">
            <div>
              <div className="flex items-baseline justify-between gap-4 mb-5">
                <h2 className="display text-[1.6rem] leading-tight">Results</h2>
                <span className="rv-tag whitespace-nowrap">
                  {loading ? (stage ?? "fetching") : `${deals.length} cars`}
                </span>
              </div>

              {loading && deals.length === 0 ? (
                <ResultsSkeleton />
              ) : !loading && deals.length === 0 ? (
                <EmptyResults />
              ) : (
                <>
                  {loading && (
                    <div className="flex items-center gap-3 border-y border-[var(--rule)] py-3 mb-2 text-[var(--ink-muted)]">
                      <Spinner size={14} />
                      <p className="text-[13px]">Scanning listings · {stage ?? "starting"}…</p>
                    </div>
                  )}
                  <motion.ol
                    className="rv-lotindex list-none m-0 p-0"
                    variants={cardGrid}
                    initial="hidden"
                    animate="show"
                    key={`${deals.length}-${dealsQuery.dataUpdatedAt}`}
                  >
                  {deals.map((deal, i) => {
                    const save = Math.max(0, deal.predicted_price - deal.listed_price);
                    return (
                      <motion.li key={deal.id} variants={cardItem}>
                        <a href={deal.url} target="_blank" rel="noreferrer" className="rv-lotrow group">
                          <span className="rv-lotrow-num" aria-hidden>{i + 1}</span>
                          <CarImage image={thumbFor(i)} ratio="4 / 3" className="rv-lotrow-thumb" />

                          <div className="min-w-0">
                            <h3 className="text-[clamp(1.1rem,2vw,1.35rem)] font-bold leading-tight mb-1.5">
                              {deal.year} {deal.make} {deal.model}
                            </h3>
                            <p className="text-[13px] text-[var(--ink-muted)] mb-3 flex items-center flex-wrap gap-x-2 gap-y-1">
                              <span>{deal.location}</span>
                              {deal.mileage != null && (
                                <>
                                  <span className="text-[var(--rule-strong)]">·</span>
                                  <span className="tabular-nums">{deal.mileage.toLocaleString()} mi</span>
                                </>
                              )}
                            </p>
                            <p className="text-[13.5px] flex items-center flex-wrap gap-x-2 gap-y-1 tabular-nums">
                              <span className="text-[var(--ink-muted)]">Listed</span>
                              <span className="font-semibold">${deal.listed_price.toLocaleString()}</span>
                              <span className="text-[var(--rule-strong)]">·</span>
                              <span className="text-[var(--ink-muted)]">Fair</span>
                              <span className="font-semibold">${deal.predicted_price.toLocaleString()}</span>
                            </p>
                          </div>

                          <div className="rv-lotrow-right">
                            <VerdictBadge value={deal.undervalue_percent} />
                            <span className="text-[15px] font-extrabold text-[var(--red)] tabular-nums whitespace-nowrap">
                              Save ${save.toLocaleString()}
                              <span className="text-[13px] font-bold"> · −{deal.undervalue_percent.toFixed(0)}%</span>
                            </span>
                            <span className="rv-tag inline-flex items-center gap-1 group-hover:text-[var(--red)] transition-colors whitespace-nowrap">
                              Open listing
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17L17 7M9 7h8v8"/></svg>
                            </span>
                          </div>
                        </a>
                      </motion.li>
                    );
                  })}
                  </motion.ol>
                </>
              )}
            </div>

            {/* Side column — figures + note */}
            <aside className="space-y-5 lg:sticky lg:top-[88px] self-start">
              {loading && deals.length === 0 && <SidebarSkeleton />}
              {!loading && deals.length > 0 && (
                <>
                  <figure className="rv-card p-5 m-0">
                    <figcaption className="rv-eyebrow mb-3">Undervalue distribution</figcaption>
                    <UndervalueHistogram deals={deals} />
                  </figure>
                  <figure className="rv-card p-5 m-0">
                    <figcaption className="rv-eyebrow mb-3">Asking vs fair value</figcaption>
                    <PriceScatter deals={deals} />
                  </figure>
                  <div className="rv-card p-5">
                    <p className="text-[13px] leading-relaxed text-[var(--ink-muted)]">
                      <span className="text-[var(--green)] font-semibold">Green</span> verdicts are
                      safe to proceed; <span className="text-[var(--amber-deep)] font-semibold">amber</span> means
                      a thin margin.
                    </p>
                    <p className="mt-3 text-[13px] font-semibold">
                      Total savings on file:{" "}
                      <span className="text-[var(--red)] font-extrabold tabular-nums">${totalSavings.toLocaleString()}</span>
                    </p>
                  </div>
                </>
              )}
            </aside>
          </section>
        </div>
      </main>

      {/* ── FOOTER ───────────────────────────────────────── */}
      <footer className="border-t border-[var(--rule)] bg-[var(--paper-pale)]">
        <div className="max-w-[1180px] mx-auto px-6 md:px-10 py-7 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <span className="text-[14px] font-semibold">Revveal</span>
          <span className="rv-tag">© 2026 · Set in Source Serif &amp; Manrope</span>
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
          Live searches need an account
        </p>
        <p className="text-[13.5px] text-[var(--ink-muted)] max-w-[34ch] mb-5 leading-relaxed">
          Create a free account to run live searches. Browsing today's results stays free.
        </p>
        <button onClick={onCreateAccount} className="rv-primary">
          Create a free account
        </button>
      </div>
    </div>
  );
}

// First-load skeleton for the results list — quiet shimmer, no spinner.
function ResultsSkeleton() {
  return (
    <div className="rv-lotindex" aria-hidden>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="rv-skel-row">
          <div className="rv-skel" style={{ height: 14, width: 14 }} />
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

function SidebarSkeleton() {
  return (
    <>
      {[0, 1].map((i) => (
        <div key={i} className="rv-card p-5" aria-hidden>
          <div className="rv-skel mb-3" style={{ height: 11, width: 130 }} />
          <div className="rv-skel" style={{ height: 130, width: "100%" }} />
        </div>
      ))}
    </>
  );
}

// Empty state that teaches the interface rather than just saying "nothing here".
function EmptyResults() {
  return (
    <div className="rv-card text-center px-6 py-16">
      <span className="rv-empty-mark" aria-hidden>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" />
        </svg>
      </span>
      <p className="display text-[1.4rem] mb-1.5">No results yet.</p>
      <p className="text-[14px] text-[var(--ink-muted)] max-w-[40ch] mx-auto leading-relaxed">
        Name a city and a model above, then run a search to list today's
        undervalued cars — ranked by how far below fair value they sit.
      </p>
    </div>
  );
}

// Verdict pill — green means "safe to proceed", amber means "thin margin".
function VerdictBadge({ value }: { value: number }) {
  const tier = value >= 25 ? "best" : value >= 15 ? "rec" : "thin";
  const v = {
    best: { cls: "rv-badge--best", label: "Best buy" },
    rec:  { cls: "rv-badge--rec",  label: "Recommended" },
    thin: { cls: "rv-badge--thin", label: "Thin margin" },
  }[tier];
  return <span className={`rv-badge ${v.cls}`}>{v.label}</span>;
}

const REPORT_STYLES = `
  ${FONT_IMPORT}

  .rv-report {
    ${THEME_TOKENS}

    background: var(--paper);
    color: var(--ink);
    font-family: 'Manrope', sans-serif;
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
  }

  .rv-report .display {
    font-family: var(--font-display);
    font-weight: 600;
    letter-spacing: -0.02em;
    line-height: 1.06;
    text-wrap: balance;
    font-optical-sizing: auto;
  }

  .rv-report .rv-emph { color: var(--red); }

  /* Dashboard nav — dark frosted floating pill, matched to the marketing nav. */
  .rv-report .rv-dash-nav {
    position: sticky; top: 0; z-index: 40;
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
  .rv-report .rv-dash-actions { display: flex; align-items: center; gap: 12px; }
  .rv-report .rv-dash-ghost { font-size: 13.5px; font-weight: 600; color: rgba(255,255,255,.82); transition: color .15s ease; }
  .rv-report .rv-dash-ghost:hover { color: #fff; }

  /* Tailwind font-mono → Manrope tabular numerals. */
  .rv-report .font-mono { font-family: 'Manrope', sans-serif; font-variant-numeric: tabular-nums; }

  /* Small uppercase label. */
  .rv-report .rv-eyebrow {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--ink-muted);
  }

  /* Mono-ish tag chip for metadata. */
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

  /* Cards — white surfaces, hairline border, soft elevation. */
  .rv-report .rv-card {
    background: var(--paper-pale);
    color: var(--ink);
    border: 1px solid var(--rule);
    border-radius: 14px;
    box-shadow: var(--shadow-sm);
  }

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
    border-color: var(--red);
    box-shadow: 0 0 0 3px var(--red-tint);
  }
  .rv-report .rv-input:disabled { opacity: 0.55; cursor: not-allowed; }
  .rv-report .rv-input::placeholder { color: var(--ink-fade); }
  .rv-report .rv-input::-webkit-outer-spin-button,
  .rv-report .rv-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
  .rv-report .rv-input[type="number"] { -moz-appearance: textfield; appearance: textfield; }

  /* Primary action. */
  .rv-report .rv-primary {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 11px 20px;
    background: var(--red);
    color: #fff;
    font-family: 'Manrope', sans-serif;
    font-size: 14px; font-weight: 700;
    border-radius: 9px;
    transition: background-color 0.18s ease;
  }
  .rv-report .rv-primary:hover:not(:disabled) { background: var(--red-deep); }
  .rv-report .rv-primary:disabled { opacity: 0.6; cursor: wait; }
  .rv-report .rv-primary--sm { padding: 8px 14px; font-size: 13px; }

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

  /* Results list. */
  .rv-report .rv-lotrow {
    display: grid;
    grid-template-columns: 26px 64px minmax(0, 1fr) auto;
    gap: 4px 18px;
    align-items: center;
    padding: 18px 4px;
    text-decoration: none;
    color: inherit;
    border-top: 1px solid var(--rule);
    border-radius: 12px;
    transition: background-color 0.15s ease, box-shadow 0.25s var(--ease-out-expo);
  }
  .rv-report .rv-lotindex > li:first-child .rv-lotrow { border-top: none; }
  .rv-report .rv-lotrow:hover { background: var(--paper-pale); box-shadow: var(--shadow-md); }

  .rv-report .rv-lotrow-num {
    font-size: 14px;
    font-weight: 700;
    color: var(--ink-fade);
    font-variant-numeric: tabular-nums;
    align-self: start;
    padding-top: 2px;
  }
  .rv-report .rv-lotrow-thumb { width: 64px; border-radius: 9px; align-self: center; }

  /* Skeletons — quiet shimmer for first load (no spinner-in-content). */
  .rv-report .rv-skel { position: relative; overflow: hidden; background: var(--paper-soft); border-radius: 7px; }
  .rv-report .rv-skel::after {
    content: ""; position: absolute; inset: 0;
    background: linear-gradient(100deg, rgba(255,255,255,0) 30%, rgba(255,255,255,.6) 50%, rgba(255,255,255,0) 70%);
    background-size: 220% 100%; animation: rv-skel-sh 1.4s var(--ease-out-expo) infinite;
  }
  @keyframes rv-skel-sh { to { background-position: -120% 0; } }
  .rv-report .rv-skel-row {
    display: grid; grid-template-columns: 26px 64px minmax(0, 1fr) auto;
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

  .rv-report .rv-lotrow-right {
    display: flex; flex-direction: column;
    align-items: flex-end; justify-content: center;
    gap: 7px;
    text-align: right;
  }
  @media (max-width: 760px) {
    .rv-report .rv-lotrow,
    .rv-report .rv-skel-row { grid-template-columns: 24px 56px minmax(0, 1fr); }
    .rv-report .rv-lotrow-right {
      grid-column: 1 / -1;
      flex-direction: row; align-items: center; justify-content: flex-start;
      flex-wrap: wrap; gap: 10px;
      margin-top: 8px;
    }
  }

  /* Guest lock — plain frosted card, no blur. */
  .rv-report .rv-guest-lock {
    position: absolute; inset: 0;
    display: flex; align-items: center; justify-content: center;
    padding: 24px;
    border-radius: var(--r-card);
    background: rgba(250, 248, 244, 0.78);
    -webkit-backdrop-filter: var(--frost-blur);
    backdrop-filter: var(--frost-blur);
  }
  .rv-report .rv-guest-lock-card {
    display: flex; flex-direction: column; align-items: center;
    text-align: center;
  }
`;
