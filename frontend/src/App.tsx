import { useMemo, useState } from "react";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { getToken, isGuest, setGuestMode } from "./api";
import {
  useDeals,
  useLogoutMutation,
  useMe,
  useScrapeJob,
  useScrapeMutation,
} from "./hooks";
import LoginPage from "./LoginPage";
import HomePage from "./HomePage";
import { Tire, sourceCode, extractStateCode } from "./CarGlyphs";

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

export default function App() {
  const me = useMe();
  const [showLogin, setShowLogin] = useState(false);
  const [guest, setGuest] = useState(isGuest);
  const logoutMut = useLogoutMutation();

  const bootstrapping = !!getToken() && me.isLoading;

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

  if (bootstrapping) return <BootSplash />;
  if (me.data) return <Dashboard onLogout={handleLogout} />;
  if (guest)
    return (
      <Dashboard guest onCreateAccount={goCreateAccount} onExitGuest={exitGuest} />
    );
  if (showLogin) return <LoginPage onLogin={handleRealLogin} onGuest={enterGuest} />;
  return <HomePage onGetStarted={() => setShowLogin(true)} />;
}

function BootSplash() {
  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: "#ffffff", color: "#0a1530", fontFamily: "'Geist', system-ui, sans-serif" }}
    >
      <style>{SHARED_STYLES}</style>
      <div className="flex flex-col items-center gap-5 opacity-90">
        <div className="flex items-center gap-2.5">
          <img
            src="/assets/revveal-icon.png"
            alt=""
            aria-hidden
            className="w-9 h-9 rounded-[9px] shadow-[0_4px_14px_rgba(31,95,255,0.22)]"
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
    <div className="min-h-screen bg-[var(--paper-warm)] text-[var(--ink)]" style={{ fontFamily: "'Geist', system-ui, sans-serif" }}>
      <style>{SHARED_STYLES}</style>

      {/* ── HEADER ───────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-white/85 backdrop-blur-md border-b border-[var(--rule)]">
        <div className="px-6 md:px-10 h-[68px] flex items-center justify-between max-w-[1280px] mx-auto">
          <div className="flex items-center gap-8">
            <a href="#" className="flex items-center gap-2.5">
              <img
                src="/assets/revveal-icon.png"
                alt=""
                aria-hidden
                className="w-8 h-8 rounded-[8px]"
              />
              <span className="display text-[1.4rem] leading-none tracking-[-0.02em] font-semibold">Revveal</span>
            </a>
            <span className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded-full bg-[var(--blue-tint)] text-[var(--blue-deep)] font-mono text-[10px] uppercase tracking-[0.18em]">
              <span className="rv-live-dot" /> {guest ? "Guest preview" : "Buyer's Console · v3.2"}
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
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--blue-tint)] border border-[var(--blue)]/15 mb-6"
            variants={dashLine}
          >
            <span className="rv-sparkle">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0l2.39 8.61L23 11l-8.61 2.39L12 22l-2.39-8.61L1 11l8.61-2.39z"/></svg>
            </span>
            <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-[var(--blue-deep)] font-medium">Run a Search</span>
          </motion.div>
          <motion.h1
            className="display text-[clamp(2.2rem,4.5vw,3.6rem)] leading-[0.98] tracking-[-0.025em] mb-3 font-semibold"
            variants={dashLine}
          >
            Find a deal <span className="text-[var(--blue)] italic">worth</span> the drive.
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
            className="relative bg-white border border-[var(--rule)] rounded-[20px] p-7 md:p-9 shadow-soft"
          >
            <div className="flex items-center gap-3 mb-7">
              <span className="rv-tag rv-tag-blue">Parameters</span>
              <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--ink-muted)]">Cluster 02 · live index</span>
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
                <p className="text-[13px] text-[#dc2626] flex items-center gap-2">
                  <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-[#fee2e2] font-bold text-[10px]">!</span>
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
        <div className="flex items-end justify-between mb-8 border-b border-[var(--rule)] pb-4">
          <h2 className="display text-[1.7rem] leading-tight tracking-[-0.02em] font-semibold">
            Results <span className="text-[var(--blue)] italic">— this run</span>
          </h2>
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--ink-muted)]">
            {loading ? (stage ?? "fetching...") : `${deals.length} listings`}
          </span>
        </div>

        {!loading && deals.length === 0 && (
          <div className="border border-dashed border-[var(--rule-strong)] rounded-[20px] p-16 text-center bg-white">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[var(--blue-tint)] text-[var(--blue)] mb-5">
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
                <span className="rv-plate-chip">
                  <span className="rv-plate-dot" />
                  {extractStateCode(deal.location) ?? sourceCode(deal.source)} · {String(i + 1).padStart(4, "0")} · {sourceCode(deal.source)}
                  <span className="rv-plate-dot" />
                </span>
                <DealScorePill value={deal.undervalue_percent} />
              </div>

              <h3 className="display text-[1.3rem] leading-tight tracking-[-0.015em] mb-1 font-semibold">
                {deal.year} {deal.make} {deal.model}
              </h3>
              <p className="text-[12.5px] text-[var(--ink-muted)] mb-5">
                {deal.location}
                {deal.mileage ? ` · ${deal.mileage.toLocaleString()} mi` : ""}
              </p>

              <div className="space-y-2 text-[13px] font-mono pt-4 border-t border-dashed border-[var(--rule)]">
                <div className="flex items-center justify-between">
                  <span className="text-[var(--ink-muted)]">Listed</span>
                  <span className="font-semibold text-[var(--ink)]">${deal.listed_price.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--ink-muted)]">Fair value</span>
                  <span className="text-[var(--ink-soft)]">${deal.predicted_price.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[var(--ink-muted)]">Differential</span>
                  <span className="font-semibold text-[var(--green)]">−{deal.undervalue_percent.toFixed(1)}%</span>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-[var(--rule)] flex items-center justify-between text-[12px]">
                <span className="font-mono uppercase tracking-[0.15em] text-[var(--ink-muted)]">Open listing</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--blue)] transition-transform group-hover:translate-x-0.5"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
              </div>
            </motion.a>
          ))}
        </motion.div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────── */}
      <footer className="border-t border-[var(--rule)] bg-white px-6 md:px-10 py-7">
        <div className="max-w-[1280px] mx-auto flex items-center justify-between">
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--ink-muted)]">
            © 2026 Revveal · Buyer's Intelligence
          </span>
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--ink-muted)]">
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
  value: any;
  onChange: (v: any) => void;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="text-[12px] font-medium text-[var(--ink-soft)] mb-2 block">
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
          Live search is <span className="text-[var(--blue)] italic">account-only</span>
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
  // map undervalue % to a 0-100ish badge color
  const tier = value >= 25 ? "great" : value >= 15 ? "good" : "ok";
  const palette = {
    great: { bg: "var(--green-soft)", fg: "var(--green)", label: "Great" },
    good:  { bg: "var(--blue-tint)",  fg: "var(--blue-deep)", label: "Solid" },
    ok:    { bg: "#f1f3f8",           fg: "var(--ink-soft)",  label: "Fair" },
  }[tier];
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-mono text-[10.5px] uppercase tracking-[0.14em] font-medium"
      style={{ background: palette.bg, color: palette.fg }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: palette.fg }} />
      {palette.label}
    </span>
  );
}

const SHARED_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=Geist:wght@300..700&family=JetBrains+Mono:wght@400;500;600;700&display=swap');

  :root {
    --paper: #ffffff;
    --paper-warm: #f7f9fc;
    --blue-tint: #ebf1ff;
    --ink: #0a1530;
    --ink-soft: #475574;
    --ink-muted: #8392ad;
    --rule: #e3e9f3;
    --rule-strong: #cfd8e6;
    --blue: #1f5fff;
    --blue-deep: #1648c4;
    --green: #16a34a;
    --green-soft: #d9f4e7;
  }

  .display {
    font-family: 'Bricolage Grotesque', serif;
    font-variation-settings: "wdth" 100, "opsz" 96;
    font-weight: 600;
  }

  .shadow-soft { box-shadow: 0 10px 36px -10px rgba(10,21,48,0.08), 0 4px 12px rgba(10,21,48,0.04); }

  .rv-tag {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 5px 10px; border-radius: 999px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 10.5px; font-weight: 500;
    letter-spacing: 0.06em; text-transform: uppercase;
    line-height: 1;
  }
  .rv-tag-blue { background: var(--blue-tint); color: var(--blue-deep); }

  .rv-live-dot {
    width: 6px; height: 6px; border-radius: 50%;
    background: var(--blue);
    animation: liveBeat 1.6s ease-in-out infinite;
    display: inline-block;
  }
  .rv-live-dot-green { background: var(--green); animation: liveBeatGreen 1.6s ease-in-out infinite; }
  @keyframes liveBeat {
    0%, 100% { box-shadow: 0 0 0 0 rgba(31,95,255,0.55); }
    50% { box-shadow: 0 0 0 5px rgba(31,95,255,0); }
  }
  @keyframes liveBeatGreen {
    0%, 100% { box-shadow: 0 0 0 0 rgba(22,163,74,0.5); }
    50% { box-shadow: 0 0 0 5px rgba(22,163,74,0); }
  }

  .rv-sparkle {
    display: inline-flex; align-items: center; justify-content: center;
    width: 16px; height: 16px; border-radius: 50%;
    background: white; color: var(--blue);
    box-shadow: 0 2px 6px rgba(31,95,255,0.22);
  }

  .rv-input {
    width: 100%;
    padding: 12px 14px;
    background: white;
    border: 1px solid var(--rule-strong);
    border-radius: 10px;
    font-size: 14px;
    color: var(--ink);
    outline: none;
    transition: border-color 0.15s, box-shadow 0.15s;
    font-family: 'Geist', sans-serif;
  }
  .rv-input:focus {
    border-color: var(--blue);
    box-shadow: 0 0 0 4px rgba(31,95,255,0.10);
  }

  .rv-primary {
    display: inline-flex; align-items: center; gap: 10px;
    padding: 13px 22px;
    background: var(--blue);
    color: white;
    font-size: 14px; font-weight: 500;
    border-radius: 999px;
    transition: background-color 0.2s ease;
    box-shadow: 0 4px 14px rgba(31,95,255,0.26), inset 0 1px 0 rgba(255,255,255,0.16);
  }
  .rv-primary:hover:not(:disabled) { background: var(--blue-deep); }
  .rv-primary:disabled { opacity: 0.65; cursor: wait; }

  /* Guest header CTA — compact pill that mirrors the primary action */
  .rv-header-cta {
    display: inline-flex; align-items: center; gap: 7px;
    padding: 8px 16px;
    background: var(--blue);
    color: white;
    font-size: 13px; font-weight: 500;
    border-radius: 999px;
    transition: background-color 0.2s ease, transform 0.15s ease;
    box-shadow: 0 4px 14px rgba(31,95,255,0.26), inset 0 1px 0 rgba(255,255,255,0.16);
  }
  .rv-header-cta:hover { background: var(--blue-deep); transform: translateY(-1px); }
  .rv-header-cta svg { transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1); }
  .rv-header-cta:hover svg { transform: translateX(3px); }

  /* Guest lock — frosted overlay over the locked search form */
  .rv-guest-lock {
    position: absolute; inset: 0;
    display: flex; align-items: center; justify-content: center;
    padding: 24px;
    border-radius: 20px;
    background: rgba(247, 249, 252, 0.62);
    backdrop-filter: blur(7px);
    -webkit-backdrop-filter: blur(7px);
    z-index: 5;
    animation: rv-guest-lock-in 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
  }
  @keyframes rv-guest-lock-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  .rv-guest-lock-card {
    display: flex; flex-direction: column; align-items: center;
    text-align: center;
  }
  .rv-guest-lock-icon {
    display: inline-flex; align-items: center; justify-content: center;
    width: 48px; height: 48px;
    border-radius: 14px;
    background: var(--blue-tint);
    color: var(--blue);
    margin-bottom: 16px;
    box-shadow: 0 4px 14px rgba(31,95,255,0.16);
  }

  @media (prefers-reduced-motion: reduce) {
    .rv-guest-lock { animation: none; }
    .rv-header-cta:hover { transform: none; }
  }

  .rv-deal-card-link {
    display: block;
    background: white;
    border: 1px solid var(--rule);
    border-radius: 18px;
    padding: 20px;
    transition: border-color 0.2s ease, transform 0.2s ease;
  }
  .rv-deal-card-link:hover { border-color: var(--rule-strong); transform: translateY(-2px); }

  .rv-plate-chip {
    display: inline-flex; align-items: center; gap: 7px;
    padding: 5px 10px; border-radius: 6px;
    background: var(--paper-warm);
    border: 1px solid var(--rule);
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px; font-weight: 600;
    letter-spacing: 0.12em; text-transform: uppercase;
    color: var(--ink-soft);
    line-height: 1;
  }
  .rv-plate-dot {
    width: 3px; height: 3px; border-radius: 50%;
    background: var(--ink-muted);
  }
`;
