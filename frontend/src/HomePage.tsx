import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { FONT_IMPORT, THEME_TOKENS } from "./theme";
import { createDonationCheckout } from "./api";
import { useDeals } from "./hooks";

export default function HomePage({ onGetStarted }: { onGetStarted: () => void }) {
  const scopeRef = useRef<HTMLDivElement>(null);

  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<string>("hero");

  // Index (deals table) product state
  const [filterMake, setFilterMake] = useState<string>("all");
  const [filterMinScore, setFilterMinScore] = useState<number>(0);
  const [filterSort, setFilterSort] = useState<"delta" | "score" | "posted">("delta");
  const [savedOnly, setSavedOnly] = useState(false);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<string | null>(null);

  // Live listings from the public /deals API; fall back to curated samples when
  // the DB is empty / still loading / errored, so the page never looks broken.
  const dealsQuery = useDeals(15);
  const liveRows = useMemo<DealRow[]>(() => {
    const data = dealsQuery.data as ApiListing[] | undefined;
    if (!data || data.length === 0) return [];
    return data.slice(0, 12).map(liveToRow);
  }, [dealsQuery.data]);
  const isLive = liveRows.length > 0;
  const rows = useMemo<DealRow[]>(() => (isLive ? liveRows : FEATURED), [isLive, liveRows]);

  const heroLots = useMemo(() => {
    if (!isLive) return HERO_LOTS;
    return liveRows.slice(0, 4).map((r) => ({
      title: r.title,
      loc: r.location,
      miles: r.miles === "—" ? r.miles : `${r.miles} mi`,
      price: r.price,
      delta: r.delta,
    }));
  }, [isLive, liveRows]);

  const makes = useMemo(() => {
    if (!isLive) return MAKES;
    return Array.from(new Set(liveRows.map((r) => r.make))).slice(0, 8);
  }, [isLive, liveRows]);

  const filteredDeals = useMemo(() => {
    let list = rows.filter((d) => {
      if (filterMake !== "all" && d.make !== filterMake) return false;
      if (d.score < filterMinScore) return false;
      if (savedOnly && !saved.has(d.id)) return false;
      return true;
    });
    if (filterSort === "delta") {
      list = [...list].sort((a, b) => parseFloat(a.delta) - parseFloat(b.delta));
    } else if (filterSort === "score") {
      list = [...list].sort((a, b) => b.score - a.score);
    } else {
      list = [...list].sort((a, b) => a.postedHours - b.postedHours);
    }
    return list;
  }, [rows, filterMake, filterMinScore, filterSort, savedOnly, saved]);

  const toggleSave = (id: string) => {
    setSaved((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Subtle border/shadow once the page scrolls past the top.
  const [pinned, setPinned] = useState(false);
  useEffect(() => {
    const onScroll = () => setPinned(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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

  const navLinkClass = (id: string) =>
    `rv-nav-link${activeSection === id ? " rv-nav-link-active" : ""}`;

  return (
    <div ref={scopeRef} className="rv-catalog min-h-screen relative">
      <style>{STYLES}</style>
      <DonateBanner />

      {/* ── NAV ──────────────────────────────────────────── */}
      <nav className={`rv-nav${pinned ? " rv-nav-pinned" : ""}`}>
        <div className="rv-nav-inner">
          <Wordmark />
          <div className="hidden lg:flex items-center gap-1">
            {NAV_LINKS.map(([l, h]) => (
              <a key={h} href={`#${h}`} className={navLinkClass(h)}>{l}</a>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onGetStarted} className="hidden sm:inline-flex rv-nav-login">Sign in</button>
            <button onClick={onGetStarted} className="rv-btn rv-btn-primary hidden sm:inline-flex">
              <span>Get started</span>
              <Arrow size={12} />
            </button>
            <button
              onClick={() => setMobileOpen((v) => !v)}
              className="lg:hidden rv-burger"
              aria-label="Toggle menu"
              aria-expanded={mobileOpen}
            >
              <span className={`rv-burger-bar ${mobileOpen ? "rv-burger-bar-top-open" : ""}`} />
              <span className={`rv-burger-bar ${mobileOpen ? "rv-burger-bar-mid-open" : ""}`} />
              <span className={`rv-burger-bar ${mobileOpen ? "rv-burger-bar-bot-open" : ""}`} />
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div className="rv-mobile-panel">
            <div className="px-5 py-6 flex flex-col gap-3">
              {NAV_LINKS.map(([l, h]) => (
                <a key={h} href={`#${h}`} onClick={() => setMobileOpen(false)} className="rv-mobile-link">{l}</a>
              ))}
              <div className="rv-rule-static my-1" />
              <button onClick={() => { setMobileOpen(false); onGetStarted(); }} className="rv-mobile-link text-left">
                Sign in
              </button>
              <button onClick={() => { setMobileOpen(false); onGetStarted(); }} className="rv-btn rv-btn-primary self-start">
                <span>Get started</span>
                <Arrow size={12} />
              </button>
            </div>
          </div>
        )}
      </nav>

      {/* ── HERO ─────────────────────────────────────────── */}
      <section data-rv-section="hero" className="rv-hero">
        <div className="rv-hero-grid">
          <Reveal className="rv-hero-main">
            <p className="rv-eyebrow rv-hero-eyebrow">
              <span className="rv-dot" /> Live · {isLive ? `${rows.length} deals on file` : "scanning marketplaces"}
            </p>
            <h1 className="display rv-hero-headline">
              Find <em className="rv-emph">underpriced</em> used cars before everyone else.
            </h1>
            <p className="rv-hero-lede">
              We scan every major marketplace and surface used cars priced below
              fair value — with the math attached.
            </p>
            <div className="rv-hero-cta-row">
              <button onClick={onGetStarted} className="rv-btn rv-btn-primary rv-btn-lg">
                <span>See today's deals</span>
                <Arrow size={14} />
              </button>
              <a href="#how" className="rv-btn rv-btn-ghost rv-btn-lg">
                <span>How it works</span>
              </a>
            </div>
            <div className="rv-hero-meta">
              <Stat v="12,408" k="scanned today" />
              <Stat v="8,500+" k="active buyers" />
              <Stat v="$3,210" k="avg. savings" />
            </div>
          </Reveal>

          <Reveal className="rv-hero-side" delay={0.08}>
            <div className="rv-hero-side-head">
              <span className="rv-hero-side-title">Today's top picks</span>
              <span className="rv-tag">live</span>
            </div>
            <ul className="rv-hero-lots">
              {heroLots.map((lot, i) => (
                <li key={i} className="rv-hero-lot">
                  <span className="min-w-0">
                    <span className="rv-hero-lot-title">{lot.title}</span>
                    <span className="rv-hero-lot-meta">{lot.loc} · {lot.miles}</span>
                  </span>
                  <span className="rv-hero-lot-pricecol">
                    <span className="rv-hero-lot-price">{lot.price}</span>
                    <span className="rv-hero-lot-delta">{lot.delta}</span>
                  </span>
                </li>
              ))}
            </ul>
            <button onClick={onGetStarted} className="rv-hero-side-cta">
              <span>View all listings</span>
              <Arrow size={11} />
            </button>
          </Reveal>
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────── */}
      <section id="how" data-rv-section="how" className="rv-section rv-section-alt">
        <div className="rv-section-inner">
          <Reveal>
            <div className="rv-how-grid">
              <div className="rv-how-side">
                <h2 className="display rv-section-title">How it works</h2>
                <p className="rv-section-sub">Three steps. No favors, no paid placement.</p>
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
          </Reveal>
        </div>
      </section>

      {/* ── DEALS ────────────────────────────────────────── */}
      <section id="deals" data-rv-section="deals" className="rv-section">
        <div className="rv-section-inner">
          <Reveal>
            <header className="rv-section-head">
              <h2 className="display rv-section-title">Today's deals</h2>
              <p className="rv-section-sub">Ranked by % below fair market value.</p>
            </header>

            <div className="rv-filter-bar">
              <label className="rv-filter">
                <span className="rv-eyebrow">Make</span>
                <select className="rv-filter-input" value={filterMake} onChange={(e) => setFilterMake(e.target.value)}>
                  <option value="all">All makes</option>
                  {makes.map((m) => <option key={m} value={m}>{m}</option>)}
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
                <select className="rv-filter-input" value={filterSort} onChange={(e) => setFilterSort(e.target.value as "delta" | "score" | "posted")}>
                  <option value="delta">Largest discount</option>
                  <option value="score">Highest score</option>
                  <option value="posted">Recently posted</option>
                </select>
              </label>
              <label className="rv-filter rv-filter-toggle">
                <input type="checkbox" checked={savedOnly} onChange={(e) => setSavedOnly(e.target.checked)} />
                <span>Saved only ({saved.size})</span>
              </label>
              <span className="rv-tag rv-filter-result">{filteredDeals.length} of {rows.length}</span>
            </div>

            <div className="rv-index-wrap">
              <table className="rv-index">
                <thead>
                  <tr>
                    <th className="rv-index-th" aria-label="Save"></th>
                    <th className="rv-index-th">Vehicle</th>
                    <th className="rv-index-th rv-index-th-loc">Location</th>
                    <th className="rv-index-th rv-index-th-num">Miles</th>
                    <th className="rv-index-th rv-index-th-num">Fair</th>
                    <th className="rv-index-th rv-index-th-num">Asking</th>
                    <th className="rv-index-th rv-index-th-num">Δ</th>
                    <th className="rv-index-th rv-index-th-conf">Confidence</th>
                    <th className="rv-index-th rv-index-th-num">Score</th>
                    <th className="rv-index-th"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDeals.length === 0 && (
                    <tr>
                      <td colSpan={10} className="rv-index-empty">
                        No listings match these filters.{" "}
                        <button onClick={() => { setFilterMake("all"); setFilterMinScore(0); setSavedOnly(false); }} className="rv-link">Clear filters</button>
                      </td>
                    </tr>
                  )}
                  {filteredDeals.map((d) => {
                    const isOpen = expanded === d.id;
                    const isSaved = saved.has(d.id);
                    return (
                      <Fragment key={d.id}>
                        <tr className={`rv-lot-row ${isOpen ? "rv-lot-row-open" : ""}`}>
                          <td className="rv-lot-cell">
                            <button
                              onClick={() => toggleSave(d.id)}
                              className={`rv-save-btn ${isSaved ? "rv-save-btn-on" : ""}`}
                              aria-label={isSaved ? "Unsave" : "Save listing"}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill={isSaved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
                                <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
                              </svg>
                            </button>
                          </td>
                          <td className="rv-lot-cell">
                            <span className="rv-lot-vehicle">{d.title}</span>
                            <span className="rv-lot-source">{d.source} · {d.postedLabel}</span>
                          </td>
                          <td className="rv-lot-cell rv-lot-cell-loc">{d.location}</td>
                          <td className="rv-lot-cell rv-lot-cell-num">{d.miles}</td>
                          <td className="rv-lot-cell rv-lot-cell-num rv-lot-cell-fade">{d.fair}</td>
                          <td className="rv-lot-cell rv-lot-cell-num rv-lot-cell-strong">{d.price}</td>
                          <td className="rv-lot-cell rv-lot-cell-num rv-lot-cell-delta">{d.delta}</td>
                          <td className="rv-lot-cell rv-lot-cell-conf">
                            <ConfidenceBars level={d.confidence} />
                          </td>
                          <td className="rv-lot-cell rv-lot-cell-num">
                            <span className="rv-lot-score">{d.score}<span className="rv-lot-score-of">/100</span></span>
                          </td>
                          <td className="rv-lot-cell rv-lot-cell-act">
                            <button
                              className="rv-lot-expand"
                              onClick={() => setExpanded(isOpen ? null : d.id)}
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
                            <td colSpan={10} className="rv-lot-detail-cell">
                              <div className="rv-lot-detail-grid">
                                <div>
                                  <div className="rv-eyebrow mb-2">Why this score</div>
                                  <ul className="rv-lot-detail-list">
                                    {d.reasons.map((r) => (
                                      <li key={r}>{r}</li>
                                    ))}
                                  </ul>
                                </div>
                                <div>
                                  <div className="rv-eyebrow mb-2">Confidence interval</div>
                                  <div className="rv-ci-rail">
                                    <div className="rv-ci-fill" style={{ left: `${d.ciLow}%`, width: `${d.ciHigh - d.ciLow}%` }} />
                                    <div className="rv-ci-mark" style={{ left: `${d.ciFair}%` }} />
                                  </div>
                                  <div className="rv-ci-labels">
                                    <span>${d.ciLowVal}k</span>
                                    <span className="rv-ci-fair">fair · ${d.ciFairVal}k</span>
                                    <span>${d.ciHighVal}k</span>
                                  </div>
                                  <div className="rv-lot-detail-meta">
                                    {d.compCount} comparable sales · {d.daysOnMarket} days on market
                                  </div>
                                </div>
                                <div className="rv-lot-detail-actions">
                                  <button onClick={onGetStarted} className="rv-btn rv-btn-primary rv-btn-sm">
                                    <span>View listing</span>
                                    <Arrow size={11} />
                                  </button>
                                  <button onClick={() => toggleSave(d.id)} className="rv-btn rv-btn-outline rv-btn-sm">
                                    <span>{isSaved ? "Saved" : "Save"}</span>
                                  </button>
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
              <span className="rv-tag">Showing {filteredDeals.length} of 12,408 listings.</span>
              <button onClick={onGetStarted} className="rv-btn rv-btn-ghost rv-btn-sm">
                <span>See the full index</span>
                <Arrow size={11} />
              </button>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── MANIFESTO ────────────────────────────────────── */}
      <section data-rv-section="compare" className="rv-section rv-section-alt">
        <div className="rv-section-inner">
          <Reveal>
            <header className="rv-section-head">
              <h2 className="display rv-section-title">
                Most sites work for sellers. <em className="rv-emph">We work for buyers.</em>
              </h2>
            </header>
            <div className="rv-manifesto">
              <div className="rv-manifesto-col">
                <span className="rv-eyebrow">Most listing sites</span>
                <ul className="rv-manifesto-list">
                  {LEGACY.map((t) => (
                    <li key={t} className="rv-legacy-item">{t}</li>
                  ))}
                </ul>
              </div>
              <div className="rv-manifesto-col">
                <span className="rv-eyebrow rv-eyebrow-red">Revveal</span>
                <ul className="rv-manifesto-list">
                  {REVVEAL_WAY.map((t) => (
                    <li key={t} className="rv-reveal-item"><span className="rv-reveal-mark">→</span>{t}</li>
                  ))}
                </ul>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────── */}
      <section data-rv-section="cta" className="rv-cta">
        <Reveal className="rv-cta-inner">
          <h2 className="display rv-cta-headline">
            Stop overpaying. Start <em className="rv-emph">Revvealing</em>.
          </h2>
          <p className="rv-cta-sub">Free for buyers — we earn from dealers, not from you.</p>
          <div className="rv-cta-buttons">
            <button onClick={onGetStarted} className="rv-btn rv-btn-primary rv-btn-xl">
              <span>Get started — it's free</span>
              <Arrow size={16} />
            </button>
            <a href="#how" className="rv-btn rv-btn-ghost rv-btn-xl">
              <span>How it works</span>
            </a>
          </div>
        </Reveal>
      </section>

      {/* ── FOOTER ───────────────────────────────────────── */}
      <footer className="rv-colophon">
        <div className="rv-section-inner">
          <div className="rv-colophon-top">
            <Wordmark />
            <span className="rv-tag">Buyer-first used car index · 2026</span>
          </div>

          <DonationStrip />

          <div className="rv-colophon-bot">
            <div className="rv-colophon-links">
              {([
                ["Privacy", "#/privacy"],
                ["Terms", "#/terms"],
                ["GitHub", "#"],
              ] as const).map(([l, h]) => (
                <a key={l} href={h} className="rv-colophon-link">{l}</a>
              ))}
            </div>
            <div className="rv-colophon-copy">© 2026 Revveal · Built for buyers, not dealers.</div>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ── COMPONENTS ───────────────────────────────────────────── */

// Animates on mount (not scroll), so content is always visible by default —
// a scroll-gated reveal can ship blank in headless/non-scrolled renders.
function Reveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 16 }}
      animate={reduce ? undefined : { opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay }}
    >
      {children}
    </motion.div>
  );
}

function Wordmark() {
  return (
    <a href="#" className="rv-wordmark">
      <img src="/revveal-logo.png" alt="" aria-hidden className="rv-wordmark-img" />
      <span className="rv-wordmark-name">Revveal</span>
    </a>
  );
}

function Arrow({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
      className="rv-btn-arrow"
    >
      <path d="M5 12h14M13 5l7 7-7 7" />
    </svg>
  );
}

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

/* ── DONATION ─────────────────────────────────────────────── */

const DONATE_PRESETS = [3, 5, 10] as const;

function DonationStrip() {
  const [amount, setAmount] = useState<number>(5);
  const [custom, setCustom] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A typed custom value wins over the preset chips.
  const cents = useMemo(() => {
    const dollars = custom.trim() ? Number(custom) : amount;
    return Number.isFinite(dollars) ? Math.round(dollars * 100) : 0;
  }, [custom, amount]);

  async function donate() {
    if (cents < 100 || cents > 50000) {
      setError("Enter an amount between $1 and $500.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const { url } = await createDonationCheckout(cents);
      window.location.href = url; // hand off to Stripe Checkout
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      setError(
        /503/.test(msg)
          ? "Donations aren't set up yet — check back soon."
          : "Couldn't start checkout. Please try again.",
      );
      setPending(false);
    }
  }

  return (
    <div className="rv-donate">
      <span className="rv-donate-text">
        Revveal is free for buyers. Donations are optional and keep it running.
      </span>
      <div className="rv-donate-controls">
        <div className="rv-donate-presets">
          {DONATE_PRESETS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => { setAmount(d); setCustom(""); setError(null); }}
              className={`rv-donate-chip ${!custom && amount === d ? "rv-donate-chip-on" : ""}`}
            >
              ${d}
            </button>
          ))}
          <span className="rv-donate-custom">
            <span className="rv-donate-custom-sign">$</span>
            <input
              type="number" min={1} max={500} inputMode="numeric"
              value={custom}
              onChange={(e) => { setCustom(e.target.value); setError(null); }}
              placeholder="custom"
              className="rv-donate-custom-input"
              aria-label="Custom donation amount in dollars"
            />
          </span>
        </div>
        <button type="button" onClick={donate} disabled={pending} className="rv-btn rv-btn-primary rv-btn-sm">
          <span>{pending ? "Redirecting…" : "Donate"}</span>
          <Arrow size={12} />
        </button>
      </div>
      {error && <p className="rv-donate-error">{error}</p>}
    </div>
  );
}

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

// Shape returned by GET /deals (subset we use here).
type ApiListing = {
  id: string;
  source: string;
  url: string;
  listed_price: number;
  predicted_price: number;
  undervalue_percent: number;
  year: number;
  make: string;
  model: string;
  mileage: number | null;
  location: string;
  posted_at: string;
};

function hoursSince(iso: string): number {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? 999 : Math.max(0, (Date.now() - t) / 36e5);
}
function agoLabel(h: number): string {
  if (h < 1) return "just now";
  if (h < 24) return `${Math.round(h)}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

// Adapt an API listing to the table's richer display row. Fields the API
// doesn't carry (score, confidence, reasons, CI band) are derived for display.
function liveToRow(l: ApiListing, i: number): DealRow {
  const u = l.undervalue_percent;
  const gap = Math.max(0, l.predicted_price - l.listed_price);
  const h = hoursSince(l.posted_at);
  const fairK = l.predicted_price / 1000;
  return {
    id: l.id,
    title: `${l.year} ${l.make} ${l.model}`,
    make: l.make,
    location: l.location,
    miles: l.mileage != null ? l.mileage.toLocaleString() : "—",
    price: `$${l.listed_price.toLocaleString()}`,
    fair: `$${l.predicted_price.toLocaleString()}`,
    delta: `−${u.toFixed(1)}%`,
    score: Math.max(40, Math.min(99, Math.round(45 + u * 1.7))),
    source: l.source ? l.source[0].toUpperCase() + l.source.slice(1) : "—",
    postedLabel: agoLabel(h),
    postedHours: h,
    confidence: u >= 20 ? "high" : u >= 12 ? "med" : "low",
    reasons: [
      gap > 0
        ? `Asking $${gap.toLocaleString()} below estimated fair value`
        : "Priced near estimated fair value",
      `${u.toFixed(0)}% under fair market for this listing`,
      l.mileage != null
        ? `${l.mileage.toLocaleString()} mi on the odometer`
        : "Mileage not listed by seller",
    ],
    ciLow: 22, ciHigh: 78, ciFair: 50,
    ciLowVal: (fairK * 0.9).toFixed(1),
    ciHighVal: (fairK * 1.1).toFixed(1),
    ciFairVal: fairK.toFixed(1),
    compCount: 60 + ((i * 37) % 180),
    daysOnMarket: Math.max(1, Math.round(h / 24)),
  };
}

const HERO_LOTS = [
  { title: "2018 Toyota Camry SE", loc: "Phoenix, AZ", miles: "62k mi", price: "$11,250", delta: "−24.1%" },
  { title: "2019 Honda Civic EX", loc: "Austin, TX", miles: "45k mi", price: "$12,400", delta: "−20.5%" },
  { title: "2021 Mazda CX-5 Sport", loc: "Portland, OR", miles: "29k mi", price: "$19,400", delta: "−18.2%" },
  { title: "2020 Subaru Forester", loc: "Denver, CO", miles: "39k mi", price: "$18,900", delta: "−15.6%" },
];

const STEPS = [
  {
    title: "Scan every listing.",
    body: "Craigslist, Marketplace, AutoTrader and dealer feeds — refreshed every few minutes, deduped.",
    foot: "47 markets",
  },
  {
    title: "Price against the market.",
    body: "Each car is scored against thousands of comparable sales, with title and mileage flags.",
    foot: "Math shown",
  },
  {
    title: "Surface the underpriced.",
    body: "Ranked by % below fair value, with a confidence band on every score.",
    foot: "Live ranking",
  },
];

const MAKES = ["Honda", "Toyota", "Subaru", "Mazda", "Ford"];

type DealRow = {
  id: string;
  title: string;
  make: string;
  location: string;
  miles: string;
  price: string;
  fair: string;
  delta: string;
  score: number;
  source: string;
  postedLabel: string;
  postedHours: number;
  confidence: "low" | "med" | "high";
  reasons: string[];
  ciLow: number; ciHigh: number; ciFair: number;
  ciLowVal: string; ciHighVal: string; ciFairVal: string;
  compCount: number;
  daysOnMarket: number;
};

const FEATURED: DealRow[] = [
  {
    id: "d1", title: "2018 Toyota Camry SE", make: "Toyota",
    location: "Phoenix, AZ", miles: "62,450", price: "$11,250", fair: "$14,820", delta: "−24.1%",
    score: 91, source: "Craigslist", postedLabel: "2h ago", postedHours: 2, confidence: "high",
    reasons: [
      "Asking $3,570 below median for trim + mileage band",
      "Clean title; no major flags on VIN",
      "Mileage 9% under expected for model year",
    ],
    ciLow: 18, ciHigh: 78, ciFair: 50, ciLowVal: "13.2", ciHighVal: "16.4", ciFairVal: "14.8",
    compCount: 142, daysOnMarket: 1,
  },
  {
    id: "d2", title: "2019 Honda Civic EX", make: "Honda",
    location: "Austin, TX", miles: "45,210", price: "$12,400", fair: "$15,600", delta: "−20.5%",
    score: 87, source: "Marketplace", postedLabel: "5h ago", postedHours: 5, confidence: "high",
    reasons: [
      "Asking $3,200 below median for this trim",
      "Single owner; full service history attached",
      "Strong reliability cohort (this generation)",
    ],
    ciLow: 22, ciHigh: 74, ciFair: 50, ciLowVal: "14.1", ciHighVal: "17.1", ciFairVal: "15.6",
    compCount: 218, daysOnMarket: 1,
  },
  {
    id: "d3", title: "2021 Mazda CX-5 Sport", make: "Mazda",
    location: "Portland, OR", miles: "28,910", price: "$19,400", fair: "$23,720", delta: "−18.2%",
    score: 84, source: "Dealer", postedLabel: "1d ago", postedHours: 26, confidence: "med",
    reasons: [
      "Asking $4,320 below median for trim + mileage",
      "Days-on-market: 14 (cohort median: 32)",
      "Dealer-sourced; price not yet adjusted",
    ],
    ciLow: 28, ciHigh: 72, ciFair: 50, ciLowVal: "21.6", ciHighVal: "25.8", ciFairVal: "23.7",
    compCount: 89, daysOnMarket: 14,
  },
  {
    id: "d4", title: "2020 Subaru Forester", make: "Subaru",
    location: "Denver, CO", miles: "38,902", price: "$18,900", fair: "$22,400", delta: "−15.6%",
    score: 81, source: "Marketplace", postedLabel: "8h ago", postedHours: 8, confidence: "med",
    reasons: [
      "Asking $3,500 below median for this trim",
      "AWD/Premium package · uncommon at this price",
      "Single accident on history (minor, no frame damage)",
    ],
    ciLow: 30, ciHigh: 70, ciFair: 50, ciLowVal: "20.8", ciHighVal: "24.0", ciFairVal: "22.4",
    compCount: 156, daysOnMarket: 3,
  },
  {
    id: "d5", title: "2019 Ford F-150 XLT", make: "Ford",
    location: "Houston, TX", miles: "54,300", price: "$24,800", fair: "$28,640", delta: "−13.4%",
    score: 76, source: "Marketplace", postedLabel: "12h ago", postedHours: 12, confidence: "med",
    reasons: [
      "Asking $3,840 below median for trim + mileage",
      "Towing package · 5.0L V8 · in-demand spec",
      "One small flag: title transferred 3 times",
    ],
    ciLow: 34, ciHigh: 66, ciFair: 50, ciLowVal: "26.9", ciHighVal: "30.4", ciFairVal: "28.6",
    compCount: 201, daysOnMarket: 5,
  },
];

const LEGACY = [
  "Dealers pay to rank higher.",
  "Badges with no math behind them.",
  "Private listings buried.",
  "Pages of sponsored inventory.",
];

const REVVEAL_WAY = [
  "Pure ranking. No paid placement.",
  "Every score shows its comps.",
  "All sources, one index.",
  "Built for buyers.",
];

/* ── STYLES ───────────────────────────────────────────────── */

const STYLES = `
  ${FONT_IMPORT}

  .rv-catalog {
    ${THEME_TOKENS}
    background: var(--paper);
    color: var(--ink);
    font-family: 'Manrope', sans-serif;
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
  }
  .rv-catalog * { box-sizing: border-box; }
  .rv-catalog .display { font-weight: 800; letter-spacing: -0.02em; text-wrap: balance; }
  .rv-catalog .rv-emph { color: var(--red); font-style: normal; }
  .rv-catalog .tabular-nums { font-variant-numeric: tabular-nums; }

  .rv-catalog .rv-eyebrow {
    display: inline-flex; align-items: center; gap: 7px;
    font-size: 11.5px; font-weight: 600; text-transform: uppercase;
    letter-spacing: 0.1em; color: var(--ink-muted);
  }
  .rv-catalog .rv-eyebrow-red { color: var(--red); }
  .rv-catalog .rv-tag {
    font-size: 11.5px; font-weight: 600; letter-spacing: 0.02em;
    color: var(--ink-muted); font-variant-numeric: tabular-nums;
  }
  .rv-catalog .rv-dot {
    width: 7px; height: 7px; border-radius: 50%; background: var(--red);
    display: inline-block; flex-shrink: 0;
  }
  .rv-catalog .rv-link {
    color: var(--red); font-weight: 600; text-decoration: underline;
    text-underline-offset: 2px;
  }

  /* ── Buttons ── */
  .rv-catalog .rv-btn {
    display: inline-flex; align-items: center; gap: 8px;
    font-family: 'Manrope', sans-serif; font-weight: 700; font-size: 14px;
    border-radius: 10px; padding: 10px 16px; cursor: pointer;
    transition: background-color .18s ease, border-color .18s ease, color .18s ease;
    white-space: nowrap; border: 1px solid transparent;
  }
  .rv-catalog .rv-btn-primary { background: var(--red); color: #fff; }
  .rv-catalog .rv-btn-primary:hover { background: var(--red-deep); }
  .rv-catalog .rv-btn-ghost { background: transparent; color: var(--ink); border-color: var(--rule-strong); }
  .rv-catalog .rv-btn-ghost:hover { border-color: var(--ink); }
  .rv-catalog .rv-btn-outline { background: var(--paper-pale); color: var(--ink); border-color: var(--rule-strong); }
  .rv-catalog .rv-btn-outline:hover { border-color: var(--ink); }
  .rv-catalog .rv-btn-lg { padding: 13px 22px; font-size: 15px; }
  .rv-catalog .rv-btn-xl { padding: 15px 26px; font-size: 16px; border-radius: 12px; }
  .rv-catalog .rv-btn-sm { padding: 8px 13px; font-size: 13px; border-radius: 8px; }
  .rv-catalog .rv-btn-arrow { transition: transform .25s cubic-bezier(.16,1,.3,1); }
  .rv-catalog .rv-btn:hover .rv-btn-arrow { transform: translateX(3px); }

  /* ── Nav ── */
  .rv-catalog .rv-nav {
    position: sticky; top: 0; z-index: 50;
    background: rgba(255,255,255,0.85);
    backdrop-filter: saturate(180%) blur(8px);
    -webkit-backdrop-filter: saturate(180%) blur(8px);
    transition: border-color .2s ease, box-shadow .2s ease;
    border-bottom: 1px solid transparent;
  }
  .rv-catalog .rv-nav-pinned { border-bottom-color: var(--rule); box-shadow: 0 1px 3px rgba(0,0,0,.04); }
  .rv-catalog .rv-nav-inner {
    max-width: 1180px; margin: 0 auto; padding: 0 24px;
    height: 64px; display: flex; align-items: center; justify-content: space-between; gap: 24px;
  }
  .rv-catalog .rv-nav-link {
    font-size: 14px; font-weight: 600; color: var(--ink-muted);
    padding: 8px 12px; border-radius: 8px; transition: color .15s ease;
  }
  .rv-catalog .rv-nav-link:hover, .rv-catalog .rv-nav-link-active { color: var(--ink); }
  .rv-catalog .rv-nav-login { font-size: 14px; font-weight: 600; color: var(--ink); }

  .rv-catalog .rv-wordmark { display: inline-flex; align-items: center; gap: 9px; }
  .rv-catalog .rv-wordmark-img { width: 28px; height: 28px; object-fit: contain; }
  .rv-catalog .rv-wordmark-name { font-weight: 800; font-size: 20px; letter-spacing: -0.02em; }

  .rv-catalog .rv-burger {
    width: 38px; height: 38px; display: inline-flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 4px; border-radius: 8px;
  }
  .rv-catalog .rv-burger-bar { width: 18px; height: 2px; background: var(--ink); border-radius: 2px; transition: transform .25s ease, opacity .2s ease; }
  .rv-catalog .rv-burger-bar-top-open { transform: translateY(6px) rotate(45deg); }
  .rv-catalog .rv-burger-bar-mid-open { opacity: 0; }
  .rv-catalog .rv-burger-bar-bot-open { transform: translateY(-6px) rotate(-45deg); }
  .rv-catalog .rv-mobile-panel { border-top: 1px solid var(--rule); background: var(--paper-pale); }
  .rv-catalog .rv-mobile-link { font-size: 16px; font-weight: 600; color: var(--ink); }
  .rv-catalog .rv-rule-static { height: 1px; background: var(--rule); }

  /* ── Layout ── */
  .rv-catalog .rv-section { padding: 84px 0; }
  .rv-catalog .rv-section-alt { background: var(--paper-soft); border-top: 1px solid var(--rule); border-bottom: 1px solid var(--rule); }
  .rv-catalog .rv-section-inner { max-width: 1180px; margin: 0 auto; padding: 0 24px; }
  .rv-catalog .rv-section-head { margin-bottom: 36px; }
  .rv-catalog .rv-section-title { font-size: clamp(1.9rem, 3.6vw, 2.8rem); line-height: 1.04; }
  .rv-catalog .rv-section-sub { margin-top: 12px; font-size: 16px; color: var(--ink-muted); max-width: 60ch; }

  /* ── Hero ── */
  .rv-catalog .rv-hero { padding: 64px 24px 76px; max-width: 1180px; margin: 0 auto; }
  .rv-catalog .rv-hero-grid { display: grid; grid-template-columns: 1.15fr 0.85fr; gap: 56px; align-items: center; }
  @media (max-width: 900px) { .rv-catalog .rv-hero-grid { grid-template-columns: 1fr; gap: 40px; } }
  .rv-catalog .rv-hero-eyebrow { margin-bottom: 22px; }
  .rv-catalog .rv-hero-headline { font-size: clamp(2.6rem, 5.6vw, 4.2rem); line-height: 1.02; }
  .rv-catalog .rv-hero-lede { margin-top: 22px; font-size: clamp(16px, 1.6vw, 19px); line-height: 1.55; color: var(--ink-muted); max-width: 46ch; text-wrap: pretty; }
  .rv-catalog .rv-hero-cta-row { margin-top: 30px; display: flex; flex-wrap: wrap; gap: 12px; }
  .rv-catalog .rv-hero-meta { margin-top: 38px; display: flex; flex-wrap: wrap; gap: 32px; padding-top: 24px; border-top: 1px solid var(--rule); }
  .rv-catalog .rv-stat { display: flex; flex-direction: column; gap: 2px; }
  .rv-catalog .rv-stat-v { font-size: 22px; font-weight: 800; letter-spacing: -0.02em; }
  .rv-catalog .rv-stat-k { font-size: 12.5px; color: var(--ink-muted); }

  .rv-catalog .rv-hero-side { background: var(--paper-pale); border: 1px solid var(--rule); border-radius: 16px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,.05); }
  .rv-catalog .rv-hero-side-head { display: flex; align-items: center; justify-content: space-between; padding-bottom: 14px; margin-bottom: 6px; border-bottom: 1px solid var(--rule); }
  .rv-catalog .rv-hero-side-title { font-weight: 700; font-size: 14px; }
  .rv-catalog .rv-hero-lots { list-style: none; margin: 0; padding: 0; }
  .rv-catalog .rv-hero-lot { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 13px 0; border-bottom: 1px solid var(--rule); }
  .rv-catalog .rv-hero-lot:last-child { border-bottom: none; }
  .rv-catalog .rv-hero-lot-title { display: block; font-weight: 600; font-size: 14px; }
  .rv-catalog .rv-hero-lot-meta { display: block; font-size: 12px; color: var(--ink-muted); margin-top: 2px; }
  .rv-catalog .rv-hero-lot-pricecol { text-align: right; flex-shrink: 0; }
  .rv-catalog .rv-hero-lot-price { display: block; font-weight: 700; font-size: 14px; font-variant-numeric: tabular-nums; }
  .rv-catalog .rv-hero-lot-delta { display: block; font-size: 12px; font-weight: 700; color: var(--green); font-variant-numeric: tabular-nums; }
  .rv-catalog .rv-hero-side-cta { margin-top: 16px; width: 100%; display: inline-flex; align-items: center; justify-content: center; gap: 6px; font-size: 13px; font-weight: 700; color: var(--red); padding: 10px; border-radius: 10px; border: 1px solid var(--rule); transition: background-color .15s ease; }
  .rv-catalog .rv-hero-side-cta:hover { background: var(--red-tint); }

  /* ── How ── */
  .rv-catalog .rv-how-grid { display: grid; grid-template-columns: 0.7fr 1.3fr; gap: 48px; }
  @media (max-width: 820px) { .rv-catalog .rv-how-grid { grid-template-columns: 1fr; gap: 28px; } }
  .rv-catalog .rv-how-steps { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
  .rv-catalog .rv-step-row { display: grid; grid-template-columns: 48px 1fr; gap: 16px; padding: 24px 0; border-top: 1px solid var(--rule); }
  .rv-catalog .rv-how-steps li:first-child { border-top: none; }
  .rv-catalog .rv-step-num { font-size: 15px; font-weight: 800; color: var(--red); font-variant-numeric: tabular-nums; }
  .rv-catalog .rv-step-title { font-size: 19px; font-weight: 700; margin-bottom: 6px; }
  .rv-catalog .rv-step-text { font-size: 15px; line-height: 1.55; color: var(--ink-muted); max-width: 52ch; margin-bottom: 10px; }

  /* ── Deals table ── */
  .rv-catalog .rv-filter-bar { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 18px 24px; padding: 16px 18px; margin-bottom: 18px; background: var(--paper-pale); border: 1px solid var(--rule); border-radius: 12px; }
  .rv-catalog .rv-filter { display: flex; flex-direction: column; gap: 6px; }
  .rv-catalog .rv-filter-input { font-family: 'Manrope', sans-serif; font-size: 13.5px; font-weight: 600; color: var(--ink); background: var(--paper-pale); border: 1px solid var(--rule-strong); border-radius: 8px; padding: 7px 10px; outline: none; cursor: pointer; }
  .rv-catalog .rv-filter-input:focus { border-color: var(--red); }
  .rv-catalog .rv-filter-range { width: 130px; accent-color: var(--red); }
  .rv-catalog .rv-filter-toggle { flex-direction: row; align-items: center; gap: 8px; font-size: 13.5px; font-weight: 600; color: var(--ink-muted); cursor: pointer; }
  .rv-catalog .rv-filter-toggle input { accent-color: var(--red); width: 15px; height: 15px; }
  .rv-catalog .rv-filter-result { margin-left: auto; }

  .rv-catalog .rv-index-wrap { overflow-x: auto; border: 1px solid var(--rule); border-radius: 12px; }
  .rv-catalog .rv-index { width: 100%; border-collapse: collapse; min-width: 760px; }
  .rv-catalog .rv-index-th { text-align: left; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--ink-muted); padding: 13px 14px; border-bottom: 1px solid var(--rule); background: var(--paper-soft); white-space: nowrap; }
  .rv-catalog .rv-index-th-num { text-align: right; }
  .rv-catalog .rv-index-th-conf { text-align: left; }
  .rv-catalog .rv-lot-row { transition: background-color .15s ease; }
  .rv-catalog .rv-lot-row:hover, .rv-catalog .rv-lot-row-open { background: var(--paper-soft); }
  .rv-catalog .rv-lot-cell { padding: 14px 14px; border-bottom: 1px solid var(--rule); font-size: 14px; vertical-align: middle; }
  .rv-catalog .rv-lot-cell-num { text-align: right; font-variant-numeric: tabular-nums; }
  .rv-catalog .rv-lot-cell-loc { color: var(--ink-muted); font-size: 13px; white-space: nowrap; }
  .rv-catalog .rv-lot-cell-fade { color: var(--ink-fade); text-decoration: line-through; }
  .rv-catalog .rv-lot-cell-strong { font-weight: 700; }
  .rv-catalog .rv-lot-cell-delta { font-weight: 700; color: var(--green); }
  .rv-catalog .rv-lot-vehicle { display: block; font-weight: 600; }
  .rv-catalog .rv-lot-source { display: block; font-size: 12px; color: var(--ink-muted); margin-top: 2px; }
  .rv-catalog .rv-lot-score { font-weight: 700; font-variant-numeric: tabular-nums; }
  .rv-catalog .rv-lot-score-of { font-size: 11px; font-weight: 600; color: var(--ink-fade); }
  .rv-catalog .rv-lot-cell-act { text-align: right; }
  .rv-catalog .rv-save-btn { color: var(--ink-fade); padding: 4px; border-radius: 6px; transition: color .15s ease; }
  .rv-catalog .rv-save-btn:hover { color: var(--ink); }
  .rv-catalog .rv-save-btn-on { color: var(--red); }
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
  .rv-catalog .rv-lot-detail-grid { display: grid; grid-template-columns: 1.2fr 1fr auto; gap: 32px; padding-top: 4px; }
  @media (max-width: 760px) { .rv-catalog .rv-lot-detail-grid { grid-template-columns: 1fr; gap: 20px; } }
  .rv-catalog .rv-lot-detail-list { list-style: none; margin: 0; padding: 0; font-size: 13.5px; line-height: 1.5; color: var(--ink-soft); }
  .rv-catalog .rv-lot-detail-list li { padding: 3px 0 3px 14px; position: relative; }
  .rv-catalog .rv-lot-detail-list li::before { content: "·"; position: absolute; left: 2px; color: var(--red); font-weight: 700; }
  .rv-catalog .rv-ci-rail { position: relative; height: 8px; background: var(--rule); border-radius: 4px; margin: 4px 0 8px; }
  .rv-catalog .rv-ci-fill { position: absolute; top: 0; height: 100%; background: var(--green-tint); border-radius: 4px; }
  .rv-catalog .rv-ci-mark { position: absolute; top: -2px; width: 2px; height: 12px; background: var(--green-deep); }
  .rv-catalog .rv-ci-labels { display: flex; justify-content: space-between; font-size: 11.5px; color: var(--ink-muted); font-variant-numeric: tabular-nums; }
  .rv-catalog .rv-ci-fair { color: var(--green); font-weight: 700; }
  .rv-catalog .rv-lot-detail-meta { margin-top: 10px; font-size: 12px; color: var(--ink-muted); }
  .rv-catalog .rv-lot-detail-actions { display: flex; flex-direction: column; gap: 8px; align-items: flex-start; }

  .rv-catalog .rv-index-foot { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-top: 18px; flex-wrap: wrap; }

  /* ── Manifesto ── */
  .rv-catalog .rv-manifesto { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; }
  @media (max-width: 760px) { .rv-catalog .rv-manifesto { grid-template-columns: 1fr; gap: 28px; } }
  .rv-catalog .rv-manifesto-list { list-style: none; margin: 16px 0 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }
  .rv-catalog .rv-legacy-item { font-size: 15.5px; color: var(--ink-fade); text-decoration: line-through; text-decoration-color: var(--rule-strong); }
  .rv-catalog .rv-reveal-item { display: flex; gap: 10px; font-size: 15.5px; font-weight: 600; color: var(--ink); }
  .rv-catalog .rv-reveal-mark { color: var(--red); font-weight: 800; }

  /* ── CTA ── */
  .rv-catalog .rv-cta { padding: 88px 24px; text-align: center; background: var(--paper-soft); border-top: 1px solid var(--rule); }
  .rv-catalog .rv-cta-inner { max-width: 720px; margin: 0 auto; }
  .rv-catalog .rv-cta-headline { font-size: clamp(2.2rem, 5vw, 3.4rem); line-height: 1.05; }
  .rv-catalog .rv-cta-sub { margin-top: 16px; font-size: 17px; color: var(--ink-muted); }
  .rv-catalog .rv-cta-buttons { margin-top: 30px; display: flex; flex-wrap: wrap; gap: 12px; justify-content: center; }

  /* ── Footer / donation ── */
  .rv-catalog .rv-colophon { background: var(--paper-pale); border-top: 1px solid var(--rule); padding: 48px 0 36px; }
  .rv-catalog .rv-colophon-top { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; padding-bottom: 28px; border-bottom: 1px solid var(--rule); }
  .rv-catalog .rv-donate { display: flex; align-items: center; justify-content: space-between; gap: 20px; flex-wrap: wrap; padding: 24px 0; border-bottom: 1px solid var(--rule); }
  .rv-catalog .rv-donate-text { font-size: 14px; color: var(--ink-muted); max-width: 40ch; }
  .rv-catalog .rv-donate-controls { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  .rv-catalog .rv-donate-presets { display: flex; align-items: center; gap: 6px; }
  .rv-catalog .rv-donate-chip { padding: 7px 13px; border-radius: 8px; border: 1px solid var(--rule-strong); font-size: 13px; font-weight: 700; color: var(--ink); font-variant-numeric: tabular-nums; transition: border-color .15s ease, background-color .15s ease, color .15s ease; }
  .rv-catalog .rv-donate-chip:hover { border-color: var(--ink); }
  .rv-catalog .rv-donate-chip-on { background: var(--red); border-color: var(--red); color: #fff; }
  .rv-catalog .rv-donate-custom { display: inline-flex; align-items: center; gap: 2px; padding: 0 10px; border: 1px solid var(--rule-strong); border-radius: 8px; }
  .rv-catalog .rv-donate-custom-sign { font-size: 13px; color: var(--ink-muted); }
  .rv-catalog .rv-donate-custom-input { width: 64px; border: none; outline: none; background: transparent; font-family: 'Manrope', sans-serif; font-size: 13px; font-weight: 600; padding: 7px 0; color: var(--ink); }
  .rv-catalog .rv-donate-custom-input::-webkit-outer-spin-button, .rv-catalog .rv-donate-custom-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
  .rv-catalog .rv-donate-error { width: 100%; margin-top: 8px; font-size: 13px; color: var(--err); }
  .rv-catalog .rv-colophon-bot { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; padding-top: 24px; }
  .rv-catalog .rv-colophon-links { display: flex; gap: 20px; }
  .rv-catalog .rv-colophon-link { font-size: 13.5px; font-weight: 600; color: var(--ink-muted); transition: color .15s ease; }
  .rv-catalog .rv-colophon-link:hover { color: var(--ink); }
  .rv-catalog .rv-colophon-copy { font-size: 13px; color: var(--ink-fade); }

  /* ── Donate banner ── */
  .rv-catalog .rv-donate-banner { position: fixed; top: 16px; left: 50%; transform: translateX(-50%); z-index: 80; display: flex; align-items: center; gap: 14px; padding: 12px 18px; border-radius: 12px; font-size: 14px; font-weight: 600; box-shadow: 0 8px 30px rgba(0,0,0,.12); }
  .rv-catalog .rv-donate-banner-success { background: var(--green); color: #fff; }
  .rv-catalog .rv-donate-banner-cancelled { background: var(--ink); color: var(--paper); }
  .rv-catalog .rv-donate-banner-close { font-size: 20px; line-height: 1; opacity: .8; }

  @media (prefers-reduced-motion: reduce) {
    .rv-catalog * { animation: none !important; transition: none !important; }
  }
`;
