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
import { Tire, GaugeDial, LicensePlate, Odometer, CarSilhouette } from "./CarGlyphs";
import { sourceCode, extractStateCode } from "./carUtils";
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
  show: { transition: { staggerChildren: 0.07 } },
};
const dashLine: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE_OUT_EXPO } },
};
const dashForm: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, ease: EASE_OUT_EXPO, delay: 0.2 },
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

  // Opacity-only crossfade between routes. No transform — a transformed
  // ancestor would create a containing block and break the landing page's
  // sticky stacking panels + fixed nav / rail / car.
  const fade = prefersReduced
    ? {}
    : {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0.3, ease: EASE_OUT_EXPO },
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
      <div className="flex flex-col items-center gap-5 opacity-90">
        <div className="flex items-center gap-2.5">
          <img
            src="/revveal-logo.png"
            alt=""
            aria-hidden
            className="w-10 h-10 object-contain"
          />
          <span className="display text-[1.5rem] leading-none tracking-[-0.02em] font-semibold">
            Revveal
          </span>
        </div>
        <Tire size={18} />
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

  const issueDate = useMemo(
    () =>
      new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    [],
  );
  const totalSavings = useMemo(
    () => deals.reduce((sum, d) => sum + Math.max(0, d.predicted_price - d.listed_price), 0),
    [deals],
  );

  return (
    <div className="rv-report min-h-screen flex flex-col">
      <style>{REPORT_STYLES}</style>
      <ReportGrain />

      {/* ── MASTHEAD ─────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-[var(--ink)]">
        <div className="border-b border-[var(--paper-rule)]">
          <div className="max-w-[1240px] mx-auto px-6 md:px-10 py-[7px] flex items-center justify-between font-mono text-[9.5px] uppercase tracking-[0.22em] text-[var(--paper-deep)] opacity-90">
            <span>Vol. III · Buyer's intelligence</span>
            <span className="hidden md:inline">{issueDate}</span>
            <span className="flex items-center gap-2">
              <span className="rv-live-dot" />
              {guest ? "Guest copy" : "Subscriber edition"}
            </span>
          </div>
        </div>
        <div className="rv-masthead">
          <div className="max-w-[1240px] mx-auto px-6 md:px-10 h-[58px] flex items-center justify-between gap-6">
            <a href="#" className="flex items-center gap-2.5 min-w-0">
              <img
                src="/revveal-logo.png"
                alt=""
                aria-hidden
                className="w-8 h-8 object-contain"
              />
              <span className="display text-[1.45rem] leading-none tracking-[-0.02em] font-semibold">Revveal</span>
              <span className="hidden sm:inline font-mono text-[9px] uppercase tracking-[0.24em] text-[var(--paper-deep)] border-l border-[var(--paper-rule)] pl-3 ml-1.5 whitespace-nowrap">
                The Buyer's Report
              </span>
            </a>
            {guest ? (
              <div className="flex items-center gap-5">
                <button
                  onClick={onExitGuest}
                  className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-[var(--paper-deep)] hover:text-[var(--red-lift)] transition-colors"
                >
                  Exit
                </button>
                <button onClick={onCreateAccount} className="rv-header-cta">
                  <span>Create account</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M13 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            ) : (
              <button
                onClick={onLogout}
                className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-[var(--paper-deep)] hover:text-[var(--red-lift)] transition-colors flex items-center gap-1.5"
              >
                <span>Sign out</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* ── COMMISSION DESK — headline + survey order form ── */}
        <motion.section
          className="max-w-[1240px] mx-auto w-full px-6 md:px-10 grid lg:grid-cols-[1.1fr_1fr] gap-12 lg:gap-16 pt-12 pb-16"
          variants={dashContainer}
          initial={initial}
          animate="show"
        >
          <div>
            <motion.p
              className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--paper-deep)] mb-6 flex items-center gap-2.5"
              variants={dashLine}
            >
              <span className="rv-live-dot" /> Field survey · live index
            </motion.p>
            <motion.h1
              className="display text-[clamp(2.7rem,5.6vw,4.6rem)] leading-[0.92] tracking-[-0.025em] font-semibold mb-6"
              variants={dashLine}
            >
              Smart buyers don't<br />pay <span className="rv-emph rv-emph--lift">full price.</span>
            </motion.h1>
            <motion.p
              className="text-[16.5px] leading-relaxed text-[var(--paper-deep)] max-w-[42ch] italic"
              variants={dashLine}
            >
              Name a city and a car. The worker walks the live listings, prices
              each against the model, and files every undervalued lot into your
              index below.
            </motion.p>

            <motion.div className="relative mt-12 hidden sm:block max-w-[340px]" variants={dashLine}>
              <div className="rv-photoplate-back" aria-hidden />
              <figure className="rv-photoplate">
                <div className="rv-photoplate-img">
                  <img src="/deal-corvette.png" alt="Corvette Stingray — example filed lot" />
                </div>
                <figcaption className="flex items-center justify-between pt-2.5 px-0.5">
                  <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-[var(--ink-muted)]">
                    Lot 0047 · filed today
                  </span>
                  <span className="rv-stamp rv-stamp--sm" style={{ color: "var(--green-deep)" }}>
                    Best buy
                  </span>
                </figcaption>
              </figure>
            </motion.div>
          </div>

          <motion.form
            onSubmit={handleSearch}
            variants={dashForm}
            className="relative rv-sheet p-6 md:p-8 self-start"
          >
            <div className="flex items-center justify-between mb-7 pb-3 border-b-2 border-[var(--ink)]">
              <span className="font-mono text-[10px] uppercase tracking-[0.22em] font-bold">Survey order form</span>
              <span className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-[var(--ink-muted)]">Form 02-B</span>
            </div>

            <div className="space-y-6">
              <LineInput label="City" value={city} onChange={setCity} placeholder="austin" disabled={guest} />
              <LineInput label="Search query" value={query} onChange={setQuery} placeholder="honda civic" disabled={guest} />
              <div className="grid grid-cols-2 gap-x-8 gap-y-6">
                <LineInput label="Max results" value={maxResults} type="number" onChange={(v) => setMaxResults(Number(v))} disabled={guest} />
                <LineInput label="Min save %" value={minUndervalue} type="number" onChange={(v) => setMinUndervalue(Number(v))} disabled={guest} />
              </div>
            </div>

            <div className="mt-8 flex items-center justify-between gap-4 flex-wrap">
              <button type="submit" disabled={loading || guest} className="rv-primary">
                <span>{loading ? (stage ?? "Querying") : "Run survey"}</span>
                {loading ? (
                  <Tire size={14} />
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
                )}
              </button>
              <span className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-[var(--ink-fade)]">
                No. {jobId ? jobId.slice(0, 8) : "— pending —"}
              </span>
            </div>

            {error && (
              <p className="mt-5 text-[13.5px] italic text-[var(--err)] flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-4 h-4 bg-[var(--red)] text-[var(--paper-pale)] font-mono font-bold text-[10px] not-italic">!</span>
                {error}
              </p>
            )}

            {jobSummary && !loading && (
              <div className="mt-5 flex items-center gap-2 text-[var(--ink-muted)]">
                <span className="rv-live-dot rv-live-dot-green" />
                <p className="font-mono text-[10.5px] uppercase tracking-[0.16em]">
                  Filed · {jobSummary.fetched} fetched · {jobSummary.inserted} inserted · {jobSummary.skipped} skipped
                </p>
              </div>
            )}

            {guest && <GuestLock onCreateAccount={onCreateAccount} />}
          </motion.form>
        </motion.section>

        {/* ── THE INDEX — the printed report sheet on the desk ── */}
        <div className="px-4 md:px-8 pb-12">
          <div className="rv-bodysheet max-w-[1280px] mx-auto">
            <section className="grid lg:grid-cols-[1fr_300px] gap-10 lg:gap-14 px-6 md:px-12 pt-10 pb-16">
          <div>
            <div className="flex items-baseline justify-between gap-4 mb-5">
              <h2 className="display text-[1.9rem] leading-tight tracking-[-0.02em] font-semibold">
                The index <span className="rv-emph">— this run</span>
              </h2>
              <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-[var(--ink-muted)] whitespace-nowrap">
                {loading ? (stage ?? "fetching") : `${deals.length} lots on file`}
              </span>
            </div>

            {loading && (
              <div className="flex items-center gap-3 border-y border-dashed border-[var(--ink-fade)] py-3 mb-4 text-[var(--ink-soft)]">
                <Tire size={14} />
                <p className="font-mono text-[10.5px] uppercase tracking-[0.18em]">Wire transmission · {stage ?? "starting"}…</p>
              </div>
            )}

            {!loading && deals.length === 0 && (
              <div className="border-t-2 border-[var(--ink)] pt-16 pb-12 text-center">
                <CarSilhouette size={72} className="mx-auto mb-6 text-[var(--ink-fade)]" />
                <p className="display text-[1.5rem] mb-2 font-semibold">No lots on file.</p>
                <p className="text-[14.5px] italic text-[var(--ink-muted)]">
                  Commission a survey above to open today's index.
                </p>
              </div>
            )}

            {deals.length > 0 && (
              <motion.ol
                className="rv-lotindex list-none m-0 p-0"
                variants={cardGrid}
                initial="hidden"
                animate="show"
                key={`${deals.length}-${dealsQuery.dataUpdatedAt}`}
              >
                {deals.map((deal, i) => (
                  <motion.li key={deal.id} variants={cardItem}>
                    <a
                      href={deal.url}
                      target="_blank"
                      rel="noreferrer"
                      className="rv-lotrow group"
                    >
                      <span className="rv-lotrow-num display" aria-hidden>
                        {String(i + 1).padStart(2, "0")}
                      </span>

                      <span className="rv-lotrow-thumb" aria-hidden>
                        <CarSilhouette size={46} />
                      </span>

                      <div className="min-w-0">
                        <h3 className="display text-[clamp(1.25rem,2.2vw,1.6rem)] leading-tight tracking-[-0.015em] font-semibold mb-2">
                          {deal.year} {deal.make} {deal.model}
                        </h3>
                        <div className="flex items-center flex-wrap gap-x-3.5 gap-y-2 mb-4 text-[var(--ink-muted)]">
                          <LicensePlate className="text-[var(--ink-soft)]">
                            {extractStateCode(deal.location) ?? sourceCode(deal.source)} · {String(i + 1).padStart(4, "0")} · {sourceCode(deal.source)}
                          </LicensePlate>
                          <span className="text-[13px] italic">{deal.location}</span>
                          {deal.mileage != null && <Odometer value={deal.mileage} />}
                        </div>
                        <div className="max-w-[380px] space-y-1.5">
                          <div className="rv-leader">
                            <span className="text-[var(--ink-muted)]">Listed</span>
                            <span className="rv-leader-dots" />
                            <span className="font-semibold">${deal.listed_price.toLocaleString()}</span>
                          </div>
                          <div className="rv-leader">
                            <span className="text-[var(--ink-muted)]">Fair value</span>
                            <span className="rv-leader-dots" />
                            <span className="text-[var(--ink-soft)]">${deal.predicted_price.toLocaleString()}</span>
                          </div>
                          <div className="rv-leader">
                            <span className="text-[var(--ink-muted)]">You save</span>
                            <span className="rv-leader-dots" />
                            <span className="font-bold text-[var(--red)]">
                              ${Math.max(0, deal.predicted_price - deal.listed_price).toLocaleString()} · −{deal.undervalue_percent.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="rv-lotrow-right">
                        <GaugeDial value={deal.undervalue_percent} size={54} className="text-[var(--ink-soft)]" />
                        <VerdictStamp value={deal.undervalue_percent} />
                        <span className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-[var(--ink-muted)] inline-flex items-center gap-1.5 group-hover:text-[var(--red)] transition-colors whitespace-nowrap">
                          Open listing
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17L17 7M9 7h8v8"/></svg>
                        </span>
                      </div>
                    </a>
                  </motion.li>
                ))}
              </motion.ol>
            )}
          </div>

          {/* Margin column — figures + survey notes */}
          <aside className="space-y-6 lg:sticky lg:top-[112px] self-start">
            {!loading && deals.length > 0 && (
              <>
                <figure className="rv-sheet p-5 m-0">
                  <figcaption className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--ink-muted)] mb-3">
                    Fig. 1 — Undervalue distribution
                  </figcaption>
                  <UndervalueHistogram deals={deals} />
                </figure>
                <figure className="rv-sheet p-5 m-0">
                  <figcaption className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--ink-muted)] mb-3">
                    Fig. 2 — Asking vs fair value
                  </figcaption>
                  <PriceScatter deals={deals} />
                </figure>
              </>
            )}
            <div className="border-t-2 border-[var(--ink)] pt-4">
              <h3 className="font-mono text-[10px] uppercase tracking-[0.22em] font-bold mb-3">Survey notes</h3>
              <p className="text-[13.5px] italic leading-relaxed text-[var(--ink-soft)]">
                Fair value is the model's estimate from comparable listings.
                Verdicts: <span className="text-[var(--green)] font-semibold not-italic">green</span> means
                safe to proceed, <span className="text-[var(--amber-deep)] font-semibold not-italic">amber</span> means
                a thin cushion. Red figures are money left on the table.
              </p>
              {deals.length > 0 && (
                <p className="mt-4 font-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--ink-soft)]">
                  Combined savings on file:{" "}
                  <span className="text-[var(--red)] font-bold">${totalSavings.toLocaleString()}</span>
                </p>
              )}
            </div>
              </aside>
            </section>
          </div>
        </div>
      </main>

      {/* ── COLOPHON ─────────────────────────────────────── */}
      <footer className="border-t border-[var(--paper-rule)]">
        <div className="max-w-[1240px] mx-auto px-6 md:px-10 py-8 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <span className="display text-[1.1rem] leading-none">
            Revveal <span className="italic font-normal text-[var(--paper-deep)]">— the buyer's report.</span>
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] opacity-70">
            © 2026 · Model v3.2 · Set in Fraunces &amp; Newsreader
          </span>
        </div>
      </footer>
    </div>
  );
}

const cardGrid: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
};
const cardItem: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE_OUT_EXPO } },
};

// Fill-in-the-blank form line: mono label, italic serif "handwriting" input.
function LineInput({
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
    <label className="flex items-baseline gap-3">
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--ink-muted)] whitespace-nowrap w-[96px] shrink-0">
        {label}
      </span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="rv-input-line"
      />
    </label>
  );
}

function GuestLock({ onCreateAccount }: { onCreateAccount?: () => void }) {
  return (
    <div className="rv-guest-lock">
      <div className="rv-guest-lock-card">
        <span className="rv-stamp text-[11px] mb-5" style={{ color: "var(--red)" }}>
          Account required
        </span>
        <p className="display text-[1.25rem] leading-tight tracking-[-0.015em] font-semibold mb-1.5">
          Live surveys are <span className="rv-emph">subscriber-only</span>
        </p>
        <p className="text-[13.5px] italic text-[var(--ink-soft)] max-w-[34ch] mb-5 leading-relaxed">
          Create a free account to commission live marketplace surveys.
          Browsing today's index stays free.
        </p>
        <button onClick={onCreateAccount} className="rv-primary">
          <span>Create a free account</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 5l7 7-7 7" /></svg>
        </button>
      </div>
    </div>
  );
}

// Rubber-stamp verdict — green means "safe to proceed", amber means "thin
// cushion". The red savings figure on the row carries urgency; never the stamp.
function VerdictStamp({ value }: { value: number }) {
  const tier = value >= 25 ? "best" : value >= 15 ? "rec" : "thin";
  const verdict = {
    best: { color: "var(--green-deep)", label: "Best buy" },
    rec:  { color: "var(--green)",      label: "Recommended" },
    thin: { color: "var(--amber-deep)", label: "Thin margin" },
  }[tier];
  return (
    <span className="rv-stamp" style={{ color: verdict.color }}>
      {verdict.label}
    </span>
  );
}

// Same fractal-noise paper texture the landing page uses.
function ReportGrain() {
  return (
    <svg className="rv-report-grain" aria-hidden>
      <filter id="rv-report-grain-f">
        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" />
        <feColorMatrix values="0 0 0 0 0.05  0 0 0 0 0.04  0 0 0 0 0.03  0 0 0 0.5 0" />
      </filter>
      <rect width="100%" height="100%" filter="url(#rv-report-grain-f)" />
    </svg>
  );
}

const REPORT_STYLES = `
  ${FONT_IMPORT}

  .rv-report {
    ${THEME_TOKENS}

    background: var(--ink);
    color: var(--paper);
    font-family: 'Newsreader', Georgia, serif;
    font-feature-settings: "ss01", "ss02", "liga";
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
  }

  .rv-report .display {
    font-family: 'Fraunces', 'Times New Roman', serif;
    font-variation-settings: "opsz" 144, "SOFT" 50, "WONK" 0;
    font-weight: 600;
    letter-spacing: -0.018em;
  }

  /* Red italic — used sparingly, mirrors the landing page's rv-emph. */
  .rv-report .rv-emph {
    font-style: italic;
    color: var(--red);
    font-variation-settings: "opsz" 144, "SOFT" 100, "WONK" 1;
  }
  /* Brighter red for emphasis sitting directly on the charcoal frame. */
  .rv-report .rv-emph--lift { color: var(--red-lift); }

  /* Tailwind's font-mono doesn't know about JetBrains Mono — align it. */
  .rv-report .font-mono { font-family: 'JetBrains Mono', ui-monospace, monospace; }

  /* Paper grain overlay */
  .rv-report .rv-report-grain {
    position: fixed; inset: 0;
    width: 100vw; height: 100vh;
    pointer-events: none;
    z-index: 100;
    opacity: 0.28;
    mix-blend-mode: multiply;
  }

  /* Masthead — classic newspaper double rule, inked in cream on charcoal. */
  .rv-report .rv-masthead { border-bottom: 4px double rgba(236,226,205,0.55); }

  /* Report sheet — cream panel floating on the charcoal desk. */
  .rv-report .rv-sheet {
    background: var(--paper-pale);
    color: var(--ink);
    border: 1px solid var(--ink);
    border-radius: 3px;
    box-shadow: 8px 8px 0 rgba(0,0,0,0.32);
  }

  /* The body sheet — the printed report itself, laid on the desk. */
  .rv-report .rv-bodysheet {
    background: var(--paper);
    color: var(--ink);
    border-radius: 5px;
    box-shadow: 0 22px 60px rgba(0,0,0,0.45);
  }

  /* Filed photo plates — polaroid-style cards fanned on the charcoal. */
  .rv-report .rv-photoplate {
    position: relative;
    z-index: 1;
    margin: 0;
    background: var(--paper-pale);
    color: var(--ink);
    border: 1px solid var(--ink);
    border-radius: 3px;
    padding: 10px;
    transform: rotate(-2deg);
    box-shadow: 10px 12px 0 rgba(0,0,0,0.35);
  }
  .rv-report .rv-photoplate-back {
    position: absolute; inset: 0;
    background: var(--paper-deep);
    border: 1px solid rgba(0,0,0,0.5);
    border-radius: 3px;
    transform: rotate(3deg) translate(16px, -8px);
    opacity: 0.9;
  }
  .rv-report .rv-photoplate-img {
    background: #ffffff;
    border: 1px solid var(--ink-fade);
    overflow: hidden;
  }
  .rv-report .rv-photoplate-img img {
    display: block;
    width: 100%;
    height: 160px;
    object-fit: contain;
    padding: 6px 14px;
  }

  /* Live scan dot — red per the palette (live/urgent), green when complete. */
  .rv-report .rv-live-dot {
    width: 6px; height: 6px; border-radius: 50%;
    background: var(--red);
    animation: liveBeat 1.6s ease-in-out infinite;
    display: inline-block;
    flex-shrink: 0;
  }
  .rv-report .rv-live-dot-green { background: var(--green); animation: liveBeatGreen 1.6s ease-in-out infinite; }
  @keyframes liveBeat {
    0%, 100% { box-shadow: 0 0 0 0 rgba(184,49,46,0.5); }
    50% { box-shadow: 0 0 0 5px rgba(184,49,46,0); }
  }
  @keyframes liveBeatGreen {
    0%, 100% { box-shadow: 0 0 0 0 rgba(45,106,79,0.5); }
    50% { box-shadow: 0 0 0 5px rgba(45,106,79,0); }
  }

  /* Order-form inputs — fill-in-the-blank lines, italic serif "handwriting". */
  .rv-report .rv-input-line {
    width: 100%;
    min-width: 0;
    background: transparent;
    border: none;
    border-bottom: 1.5px dotted var(--ink-fade);
    border-radius: 0;
    font-family: 'Newsreader', Georgia, serif;
    font-style: italic;
    font-size: 16.5px;
    color: var(--ink);
    padding: 1px 2px 5px;
    outline: none;
    transition: border-color 0.15s ease;
  }
  .rv-report .rv-input-line:focus { border-bottom: 1.5px solid var(--red); }
  .rv-report .rv-input-line:disabled { opacity: 0.55; cursor: not-allowed; }
  .rv-report .rv-input-line::placeholder { color: var(--ink-fade); }
  .rv-report .rv-input-line::-webkit-outer-spin-button,
  .rv-report .rv-input-line::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
  .rv-report .rv-input-line[type="number"] { -moz-appearance: textfield; appearance: textfield; }

  /* Primary action — letterpress red stamp. */
  .rv-report .rv-primary {
    display: inline-flex; align-items: center; gap: 10px;
    padding: 13px 24px;
    background: var(--red);
    color: var(--paper-pale);
    font-family: 'JetBrains Mono', monospace;
    font-size: 12.5px; font-weight: 600;
    text-transform: uppercase; letter-spacing: 0.12em;
    border-radius: 2px;
    transition: background-color 0.2s ease, transform 0.15s ease, box-shadow 0.15s ease;
    box-shadow: 3px 3px 0 rgba(24,19,10,0.2);
  }
  .rv-report .rv-primary:hover:not(:disabled) {
    background: var(--red-deep);
    transform: translate(-1px, -1px);
    box-shadow: 4px 4px 0 rgba(24,19,10,0.24);
  }
  .rv-report .rv-primary:disabled { opacity: 0.65; cursor: wait; }

  /* Guest header CTA — compact version of the primary stamp */
  .rv-report .rv-header-cta {
    display: inline-flex; align-items: center; gap: 7px;
    padding: 8px 16px;
    background: var(--red);
    color: var(--paper-pale);
    font-family: 'JetBrains Mono', monospace;
    font-size: 11.5px; font-weight: 600;
    text-transform: uppercase; letter-spacing: 0.1em;
    border-radius: 2px;
    transition: background-color 0.2s ease, transform 0.15s ease;
    box-shadow: 2px 2px 0 rgba(24,19,10,0.2);
  }
  .rv-report .rv-header-cta:hover { background: var(--red-deep); transform: translateY(-1px); }
  .rv-report .rv-header-cta svg { transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1); }
  .rv-report .rv-header-cta:hover svg { transform: translateX(3px); }

  /* Rubber-stamp verdict — double border, tilted, pressed into the paper. */
  .rv-report .rv-stamp {
    position: relative;
    display: inline-block;
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px; font-weight: 700;
    letter-spacing: 0.16em; text-transform: uppercase;
    line-height: 1;
    padding: 6px 9px;
    border: 2px solid currentColor;
    border-radius: 3px;
    transform: rotate(-5deg);
    mix-blend-mode: multiply;
    opacity: 0.92;
  }
  .rv-report .rv-stamp::after {
    content: "";
    position: absolute; inset: 2px;
    border: 1px solid currentColor;
    border-radius: 2px;
    opacity: 0.5;
  }
  .rv-report .rv-stamp--sm { font-size: 8.5px; padding: 4px 7px; }

  /* The index — full-width lot register rows. */
  .rv-report .rv-lotindex { border-top: 2px solid var(--ink); }
  .rv-report .rv-lotindex li:first-child .rv-lotrow { border-top: none; }
  .rv-report .rv-lotrow {
    display: grid;
    grid-template-columns: 64px 88px minmax(0, 1fr) auto;
    gap: 8px 22px;
    padding: 24px 6px;
    text-decoration: none;
    color: inherit;
    border-top: 1px solid var(--ink-fade);
    transition: background-color 0.2s ease;
  }
  .rv-report .rv-lotrow:hover { background: var(--paper-pale); }

  /* Spec plate thumbnail — listings carry no photos, so file a silhouette. */
  .rv-report .rv-lotrow-thumb {
    display: flex; align-items: center; justify-content: center;
    width: 88px; height: 58px;
    background: var(--paper-deep);
    border: 1px solid var(--ink-fade);
    border-radius: 2px;
    color: var(--ink-soft);
    margin-top: 6px;
  }

  /* Outlined lot numerals — hollow type that inks in red on hover. */
  .rv-report .rv-lotrow-num {
    font-size: 3.1rem;
    line-height: 0.85;
    color: var(--paper-deep);
    transition: color 0.2s ease;
  }
  @supports (-webkit-text-stroke: 1px black) {
    .rv-report .rv-lotrow-num {
      color: transparent;
      -webkit-text-stroke: 1.3px var(--ink-fade);
      transition: -webkit-text-stroke-color 0.2s ease, color 0.2s ease;
    }
  }
  .rv-report .rv-lotrow:hover .rv-lotrow-num {
    color: var(--red);
    -webkit-text-stroke-color: var(--red);
  }

  .rv-report .rv-lotrow-right {
    display: flex; flex-direction: column;
    align-items: flex-end; justify-content: space-between;
    gap: 12px;
  }
  @media (max-width: 760px) {
    .rv-report .rv-lotrow { grid-template-columns: 46px minmax(0, 1fr); }
    .rv-report .rv-lotrow-thumb { display: none; }
    .rv-report .rv-lotrow-num { font-size: 2rem; -webkit-text-stroke-width: 1px; }
    .rv-report .rv-lotrow-right {
      grid-column: 1 / -1;
      flex-direction: row; align-items: center;
      margin-top: 6px;
    }
  }

  /* Dot leaders — catalog-style price lines: "Listed ······· $8,900". */
  .rv-report .rv-leader {
    display: flex; align-items: baseline; gap: 8px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 12.5px;
  }
  .rv-report .rv-leader-dots {
    flex: 1;
    min-width: 28px;
    border-bottom: 2px dotted var(--ink-fade);
    transform: translateY(-3px);
  }

  /* Guest lock — paper-frosted overlay over the locked order form */
  .rv-report .rv-guest-lock {
    position: absolute; inset: 0;
    display: flex; align-items: center; justify-content: center;
    padding: 24px;
    border-radius: 3px;
    background: rgba(236, 226, 205, 0.62);
    backdrop-filter: blur(7px);
    -webkit-backdrop-filter: blur(7px);
    z-index: 5;
    animation: rv-guest-lock-in 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
  }
  @keyframes rv-guest-lock-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  .rv-report .rv-guest-lock-card {
    display: flex; flex-direction: column; align-items: center;
    text-align: center;
  }

  @media (prefers-reduced-motion: reduce) {
    .rv-report .rv-guest-lock { animation: none; }
    .rv-report .rv-header-cta:hover { transform: none; }
    .rv-report .rv-live-dot, .rv-report .rv-live-dot-green { animation: none; }
  }
`;
