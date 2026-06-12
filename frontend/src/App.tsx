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
import { Tire, GaugeDial, LicensePlate, Odometer } from "./CarGlyphs";
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

  const deals: Deal[] = (dealsQuery.data as Deal[] | undefined) ?? [];

  return (
    <div className="rv-report min-h-screen">
      <style>{REPORT_STYLES}</style>

      {/* ── HEADER ───────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-[var(--paper)] border-b border-[var(--ink)]">
        <div className="px-6 md:px-10 h-[68px] flex items-center justify-between max-w-[1280px] mx-auto">
          <div className="flex items-center gap-8">
            <a href="#" className="flex items-center gap-2.5">
              <img
                src="/revveal-logo.png"
                alt=""
                aria-hidden
                className="w-9 h-9 object-contain"
              />
              <span className="display text-[1.4rem] leading-none tracking-[-0.02em] font-semibold">Revveal</span>
            </a>
            <span className="hidden md:flex items-center gap-2 px-2.5 py-[5px] border border-[var(--ink)] bg-[var(--paper-pale)] text-[var(--ink-soft)] font-mono text-[10px] uppercase tracking-[0.18em]">
              <span className="rv-live-dot" /> {guest ? "Guest preview" : "Buyer's Report · No. 047"}
            </span>
          </div>
          {guest ? (
            <div className="flex items-center gap-4">
              <button
                onClick={onExitGuest}
                className="text-[13px] text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors"
              >
                Exit
              </button>
              <button onClick={onCreateAccount} className="rv-header-cta">
                <span>Create account</span>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M13 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          ) : (
            <button
              onClick={onLogout}
              className="text-[13px] text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors flex items-center gap-1.5"
            >
              <span>Sign out</span>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          )}
        </div>
      </header>

      {/* ── PAGE TITLE + FORM (animated as one orchestrated group) ── */}
      <motion.div
        className="max-w-[1280px] mx-auto"
        variants={dashContainer}
        initial={initial}
        animate="show"
      >
        <section className="px-6 md:px-10 pt-14 pb-10">
          <motion.div
            className="inline-flex items-center gap-2.5 px-3 py-1.5 border border-[var(--ink-fade)] bg-[var(--paper-pale)] mb-6"
            variants={dashLine}
          >
            <span className="rv-live-dot" />
            <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-[var(--ink-muted)] font-medium">Field survey · Run a search</span>
          </motion.div>
          <motion.h1
            className="display text-[clamp(2.2rem,4.5vw,3.6rem)] leading-[0.98] tracking-[-0.025em] mb-3 font-semibold"
            variants={dashLine}
          >
            Find a deal <span className="rv-emph">worth</span> the drive.
          </motion.h1>
          <motion.p
            className="text-[15.5px] text-[var(--ink-soft)] max-w-[48ch]"
            variants={dashLine}
          >
            Set your parameters. The model returns each car ranked, scored, and explained.
          </motion.p>
        </section>

        <section className="px-6 md:px-10 mb-12">
          <motion.form
            onSubmit={handleSearch}
            variants={dashForm}
            className="relative rv-sheet p-7 md:p-9"
          >
            <div className="flex items-center gap-3 mb-7">
              <span className="rv-tag rv-tag-red">Parameters</span>
              <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--ink-muted)]">Worksheet 02 · live index</span>
              <span className="h-px flex-1 bg-[var(--rule)]" />
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
              <Input label="City" value={city} onChange={setCity} placeholder="austin" disabled={guest} />
              <Input label="Search query" value={query} onChange={setQuery} placeholder="honda civic" disabled={guest} />
              <Input label="Max results" value={maxResults} type="number" onChange={(v) => setMaxResults(Number(v))} disabled={guest} />
              <Input label="Min undervalue %" value={minUndervalue} type="number" onChange={(v) => setMinUndervalue(Number(v))} disabled={guest} />
            </div>

            <div className="mt-7 flex items-center gap-6 flex-wrap">
              <button
                type="submit"
                disabled={loading || guest}
                className="rv-primary"
              >
                <span>{loading ? (stage ?? "Querying") : "Run search"}</span>
                {loading ? (
                  <Tire size={14} />
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
                )}
              </button>
              {error && (
                <p className="text-[13.5px] italic text-[var(--err)] flex items-center gap-2">
                  <span className="inline-flex items-center justify-center w-4 h-4 bg-[var(--red)] text-[var(--paper-pale)] font-mono font-bold text-[10px] not-italic">!</span>
                  {error}
                </p>
              )}
            </div>

            {jobSummary && !loading && (
              <div className="mt-5 flex items-center gap-2 text-[var(--ink-muted)]">
                <span className="rv-live-dot rv-live-dot-green" />
                <p className="font-mono text-[11px] uppercase tracking-[0.16em]">
                  Job complete · {jobSummary.fetched} fetched · {jobSummary.inserted} inserted · {jobSummary.skipped} skipped
                </p>
              </div>
            )}

            {guest && <GuestLock onCreateAccount={onCreateAccount} />}
          </motion.form>
        </section>
      </motion.div>

      {/* ── RESULTS ──────────────────────────────────────── */}
      <section className="px-6 md:px-10 pb-24 max-w-[1280px] mx-auto">
        <div className="flex items-end justify-between mb-8 border-b border-[var(--ink)] pb-4">
          <h2 className="display text-[1.7rem] leading-tight tracking-[-0.02em] font-semibold">
            Results <span className="rv-emph">— this run</span>
          </h2>
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--ink-muted)]">
            {loading ? (stage ?? "fetching...") : `${deals.length} listings`}
          </span>
        </div>

        {!loading && deals.length > 0 && (
          <div className="grid md:grid-cols-2 gap-5 mb-8">
            <div className="rv-sheet p-5">
              <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-[var(--ink-muted)] mb-3">Fig. 1 — Undervalue distribution</div>
              <UndervalueHistogram deals={deals} />
            </div>
            <div className="rv-sheet p-5">
              <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-[var(--ink-muted)] mb-3">Fig. 2 — Asking vs fair value</div>
              <PriceScatter deals={deals} />
            </div>
          </div>
        )}

        {!loading && deals.length === 0 && (
          <div className="border border-dashed border-[var(--ink-fade)] rounded-[3px] p-16 text-center bg-[var(--paper-soft)]">
            <div className="inline-flex items-center justify-center w-14 h-14 border border-[var(--ink)] bg-[var(--paper-deep)] text-[var(--ink)] mb-5">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" />
              </svg>
            </div>
            <p className="display text-[1.4rem] mb-2 text-[var(--ink)] font-semibold">No results yet.</p>
            <p className="text-[13.5px] text-[var(--ink-muted)]">Run a search to populate your index.</p>
          </div>
        )}

        {loading && (
          <div className="flex items-center gap-2.5 text-[var(--ink-soft)] mb-6">
            <Tire size={14} />
            <p className="font-mono text-[12.5px]">worker · {stage ?? "starting"}…</p>
          </div>
        )}

        <motion.div
          className="grid md:grid-cols-2 lg:grid-cols-3 gap-5"
          variants={cardGrid}
          initial="hidden"
          animate="show"
          key={`${deals.length}-${dealsQuery.dataUpdatedAt}`}
        >
          {deals.map((deal, i) => (
            <motion.a
              key={deal.id}
              href={deal.url}
              target="_blank"
              rel="noreferrer"
              className="rv-deal-card-link group"
              variants={cardItem}
            >
              <div className="flex items-start justify-between mb-4 gap-3">
                <LicensePlate className="text-[var(--ink-soft)]">
                  {extractStateCode(deal.location) ?? sourceCode(deal.source)} · {String(i + 1).padStart(4, "0")} · {sourceCode(deal.source)}
                </LicensePlate>
                <span className="flex items-center gap-2 text-[var(--ink-soft)]">
                  <GaugeDial value={deal.undervalue_percent} size={34} />
                  <DealScorePill value={deal.undervalue_percent} />
                </span>
              </div>

              <h3 className="display text-[1.3rem] leading-tight tracking-[-0.015em] mb-1 font-semibold">
                {deal.year} {deal.make} {deal.model}
              </h3>
              <p className="text-[13px] italic text-[var(--ink-muted)] mb-3">{deal.location}</p>
              <div className="mb-5 text-[var(--ink-muted)]">
                {deal.mileage != null ? (
                  <Odometer value={deal.mileage} />
                ) : (
                  <span className="font-mono text-[10px] uppercase tracking-[0.2em] opacity-70">mileage unlisted</span>
                )}
              </div>

              <div className="space-y-2 text-[13px] font-mono pt-4 border-t border-dashed border-[var(--ink-fade)]">
                <div className="flex items-center justify-between">
                  <span className="text-[var(--ink-muted)]">Listed</span>
                  <span className="font-semibold text-[var(--ink)]">${deal.listed_price.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--ink-muted)]">Fair value</span>
                  <span className="text-[var(--ink-soft)]">${deal.predicted_price.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[var(--ink-muted)]">You save</span>
                  <span className="font-semibold text-[var(--red)]">
                    ${Math.max(0, deal.predicted_price - deal.listed_price).toLocaleString()} · −{deal.undervalue_percent.toFixed(1)}%
                  </span>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-[var(--rule)] flex items-center justify-between text-[12px]">
                <span className="font-mono uppercase tracking-[0.15em] text-[var(--ink-muted)]">Open listing</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--red)] transition-transform group-hover:translate-x-0.5"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
              </div>
            </motion.a>
          ))}
        </motion.div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────── */}
      <footer className="bg-[var(--ink)] text-[var(--paper)] px-6 md:px-10 py-7">
        <div className="max-w-[1280px] mx-auto flex items-center justify-between">
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] opacity-75">
            © 2026 Revveal · Buyer's Intelligence
          </span>
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] opacity-75">
            Model v3.2 · updated 2m ago
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

function Input({
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
    <div>
      <label className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--ink-muted)] mb-2 block">
        {label}
      </label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="rv-input disabled:opacity-55 disabled:cursor-not-allowed"
      />
    </div>
  );
}

function GuestLock({ onCreateAccount }: { onCreateAccount?: () => void }) {
  return (
    <div className="rv-guest-lock">
      <div className="rv-guest-lock-card">
        <span className="rv-guest-lock-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
            <path d="M8 10.5V7a4 4 0 018 0v3.5" />
          </svg>
        </span>
        <p className="display text-[1.25rem] leading-tight tracking-[-0.015em] font-semibold mb-1.5">
          Live search is <span className="rv-emph">account-only</span>
        </p>
        <p className="text-[13.5px] text-[var(--ink-soft)] max-w-[34ch] mb-5 leading-relaxed">
          Create a free account to run live marketplace searches. Browsing today&apos;s deals stays free.
        </p>
        <button onClick={onCreateAccount} className="rv-primary">
          <span>Create a free account</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 5l7 7-7 7" /></svg>
        </button>
      </div>
    </div>
  );
}

function DealScorePill({ value }: { value: number }) {
  // Verdict stamp — green means "safe to proceed", amber means "thin cushion".
  // The red savings figure on the card carries urgency; the stamp never does.
  const tier = value >= 25 ? "best" : value >= 15 ? "rec" : "thin";
  const palette = {
    best: { bg: "var(--green-tint)", fg: "var(--green-deep)", bd: "var(--green)", label: "Best buy" },
    rec:  { bg: "transparent",       fg: "var(--green)",      bd: "var(--green)", label: "Recommended" },
    thin: { bg: "var(--amber-tint)", fg: "var(--amber-deep)", bd: "var(--amber)", label: "Thin margin" },
  }[tier];
  return (
    <span
      className="inline-flex items-center px-2 py-[5px] rounded-[2px] border-[1.5px] font-mono text-[9.5px] uppercase tracking-[0.16em] font-semibold leading-none whitespace-nowrap"
      style={{ background: palette.bg, color: palette.fg, borderColor: palette.bd }}
    >
      {palette.label}
    </span>
  );
}

const REPORT_STYLES = `
  ${FONT_IMPORT}

  .rv-report {
    ${THEME_TOKENS}

    background: var(--paper);
    color: var(--ink);
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

  /* Tailwind's font-mono doesn't know about JetBrains Mono — align it. */
  .rv-report .font-mono { font-family: 'JetBrains Mono', ui-monospace, monospace; }

  /* Report sheet — the one card surface: worksheet, figures, deal reports. */
  .rv-report .rv-sheet {
    background: var(--paper-pale);
    border: 1px solid var(--ink);
    border-radius: 3px;
    box-shadow: 5px 5px 0 rgba(24,19,10,0.07);
  }

  .rv-report .rv-tag {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 5px 10px; border-radius: 2px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 10.5px; font-weight: 600;
    letter-spacing: 0.1em; text-transform: uppercase;
    line-height: 1;
  }
  .rv-report .rv-tag-red { border: 1.5px solid var(--red); color: var(--red-deep); background: transparent; }

  /* Live scan dot — red per the palette (live/urgent), green when complete. */
  .rv-report .rv-live-dot {
    width: 6px; height: 6px; border-radius: 50%;
    background: var(--red);
    animation: liveBeat 1.6s ease-in-out infinite;
    display: inline-block;
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

  .rv-report .rv-input {
    width: 100%;
    padding: 11px 13px;
    background: var(--paper-pale);
    border: 1px solid var(--ink-fade);
    border-radius: 2px;
    font-size: 14.5px;
    color: var(--ink);
    outline: none;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
    font-family: 'Newsreader', Georgia, serif;
  }
  .rv-report .rv-input:focus {
    border-color: var(--ink);
    box-shadow: 3px 3px 0 var(--paper-deep);
  }

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

  /* Guest lock — paper-frosted overlay over the locked worksheet */
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
  .rv-report .rv-guest-lock-icon {
    display: inline-flex; align-items: center; justify-content: center;
    width: 48px; height: 48px;
    border: 1px solid var(--ink);
    background: var(--paper-deep);
    color: var(--ink);
    margin-bottom: 16px;
  }

  @media (prefers-reduced-motion: reduce) {
    .rv-report .rv-guest-lock { animation: none; }
    .rv-report .rv-header-cta:hover { transform: none; }
    .rv-report .rv-live-dot, .rv-report .rv-live-dot-green { animation: none; }
  }

  /* Deal card — a filed report sheet with a masthead rule. */
  .rv-report .rv-deal-card-link {
    display: block;
    background: var(--paper-pale);
    border: 1px solid var(--ink);
    border-top-width: 3px;
    border-radius: 3px;
    padding: 20px;
    transition: box-shadow 0.2s ease, transform 0.2s ease;
  }
  .rv-report .rv-deal-card-link:hover {
    transform: translateY(-2px);
    box-shadow: 5px 5px 0 var(--paper-deep);
  }
`;
