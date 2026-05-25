import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { gsap, ScrollTrigger, SplitText } from "./lib/gsap";
import { createDonationCheckout } from "./api";
import { useDeals } from "./hooks";
import ScrollRail from "./ScrollRail";

export default function HomePage({ onGetStarted }: { onGetStarted: () => void }) {
  const scopeRef = useRef<HTMLDivElement>(null);
  const heroHeadlineRef = useRef<HTMLHeadingElement>(null);
  const heroUnderlineRef = useRef<SVGPathElement>(null);
  const indexCounterRef = useRef<HTMLSpanElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    const onScroll = () => {
      const nav = document.querySelector(".rv-nav");
      if (!nav) return;
      if (window.scrollY > 12) nav.classList.add("rv-nav-pinned");
      else nav.classList.remove("rv-nav-pinned");
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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
    const panel = mobileMenuRef.current;
    if (!panel) return;
    if (mobileOpen) {
      gsap.set(panel, { display: "block" });
      gsap.fromTo(panel, { y: -16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.3, ease: "expo.out" });
      gsap.fromTo(
        panel.querySelectorAll(".rv-mobile-link"),
        { x: -10, opacity: 0 },
        { x: 0, opacity: 1, duration: 0.35, stagger: 0.04, ease: "expo.out", delay: 0.05 },
      );
    } else {
      gsap.to(panel, {
        opacity: 0, y: -8, duration: 0.2, ease: "expo.in",
        onComplete: () => gsap.set(panel, { display: "none" }),
      });
    }
  }, [mobileOpen]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMobileOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  useLayoutEffect(() => {
    if (!scopeRef.current) return;
    const root = scopeRef.current;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const ctx = gsap.context(() => {
      const formatInt = (n: number) => Math.round(n).toLocaleString();

      if (reduce) {
        gsap.set("[data-rv-reveal], [data-rv-cta-sub]", { opacity: 1, y: 0 });
        gsap.set(".rv-draw", { drawSVG: "100%" });
        if (indexCounterRef.current) indexCounterRef.current.innerText = "12,408";
        return;
      }

      gsap.set("[data-rv-reveal]", { opacity: 0, y: 20 });
      gsap.set("[data-rv-cta-sub]", { opacity: 0, y: 14 });
      gsap.set(".rv-draw", { drawSVG: "0% 0%" });
      gsap.set(".rv-hero-lot-preview", { opacity: 0, x: 14 });
      if (indexCounterRef.current) indexCounterRef.current.innerText = "0";

      // ── HERO ─────────────────────────────────────────
      const splitHero = heroHeadlineRef.current
        ? new SplitText(heroHeadlineRef.current, { type: "chars,words", linesClass: "rv-hero-line" })
        : null;
      if (splitHero) gsap.set(splitHero.chars, { opacity: 0, yPercent: 55, rotate: 3 });

      const heroTl = gsap.timeline({ defaults: { ease: "expo.out" }, delay: 0.2 });

      if (splitHero) {
        heroTl.to(splitHero.chars, {
          opacity: 1, yPercent: 0, rotate: 0,
          duration: 0.9, stagger: 0.011,
        }, 0);
      }
      if (heroUnderlineRef.current) {
        heroTl.to(heroUnderlineRef.current, { drawSVG: "0% 100%", duration: 1.05, ease: "power2.out" }, 0.7);
      }
      heroTl.to("[data-rv-hero-eyebrow]", { opacity: 1, y: 0, duration: 0.55 }, 0);
      heroTl.to("[data-rv-hero-lede]", { opacity: 1, y: 0, duration: 0.65 }, 0.4);
      heroTl.to("[data-rv-hero-cta]", { opacity: 1, y: 0, duration: 0.6, stagger: 0.07 }, 0.55);
      heroTl.to(".rv-hero-lot-preview", { opacity: 1, x: 0, duration: 0.6, stagger: 0.06 }, 0.4);
      heroTl.to(".rv-hero-rule", { drawSVG: "0% 100%", duration: 0.8, stagger: 0.08 }, 0.15);

      if (indexCounterRef.current) {
        const obj = { v: 0 };
        heroTl.to(obj, {
          v: 12408, duration: 1.4, ease: "expo.out",
          onUpdate: () => {
            if (indexCounterRef.current) indexCounterRef.current.innerText = formatInt(obj.v);
          },
        }, 0.3);
      }

      // ── HOW ──────────────────────────────────────────
      ScrollTrigger.create({
        trigger: "[data-rv-section='how']",
        start: "top 78%",
        once: true,
        onEnter: () => {
          const h = root.querySelector<HTMLHeadingElement>("[data-rv-how-headline]");
          if (h) {
            const split = new SplitText(h, { type: "words" });
            gsap.from(split.words, { y: 22, opacity: 0, duration: 0.75, stagger: 0.04, ease: "expo.out" });
          }
          gsap.to("[data-rv-section='how'] .rv-step-row", {
            y: 0, opacity: 1, duration: 0.7, stagger: 0.1, ease: "expo.out", delay: 0.25,
          });
          gsap.utils.toArray<HTMLElement>(".rv-step-num").forEach((el, i) => {
            const obj = { v: 0 };
            gsap.to(obj, {
              v: i + 1, duration: 1.1, ease: "expo.out", delay: 0.4 + i * 0.1,
              onUpdate: () => { el.innerText = String(Math.round(obj.v)).padStart(2, "0"); },
            });
          });
        },
      });

      // ── INDEX (deals table) ──────────────────────────
      ScrollTrigger.create({
        trigger: "[data-rv-section='deals']",
        start: "top 76%",
        once: true,
        onEnter: () => {
          const h = root.querySelector<HTMLHeadingElement>("[data-rv-deals-headline]");
          if (h) {
            const split = new SplitText(h, { type: "words" });
            gsap.from(split.words, { y: 22, opacity: 0, duration: 0.7, stagger: 0.04, ease: "expo.out" });
          }
          gsap.from("[data-rv-section='deals'] .rv-filter-bar > *", {
            opacity: 0, y: 8, duration: 0.5, stagger: 0.05, ease: "expo.out", delay: 0.2,
          });
          gsap.from("[data-rv-section='deals'] .rv-lot-row", {
            opacity: 0, x: -18, duration: 0.55, stagger: 0.06, ease: "expo.out", delay: 0.35,
          });
        },
      });

      // ── MANIFESTO ────────────────────────────────────
      ScrollTrigger.create({
        trigger: "[data-rv-section='compare']",
        start: "top 80%",
        once: true,
        onEnter: () => {
          const h = root.querySelector<HTMLHeadingElement>("[data-rv-compare-headline]");
          if (h) {
            const split = new SplitText(h, { type: "words" });
            gsap.from(split.words, { y: 22, opacity: 0, duration: 0.75, stagger: 0.04, ease: "expo.out" });
          }
          gsap.from(".rv-legacy-item, .rv-reveal-item", {
            opacity: 0, y: 8, duration: 0.5, stagger: 0.05, ease: "expo.out", delay: 0.25,
          });
          gsap.to(".rv-legacy-strike", {
            drawSVG: "0% 100%", duration: 0.45, stagger: 0.06, ease: "power2.out", delay: 0.45,
          });
        },
      });

      // ── CTA ──────────────────────────────────────────
      ScrollTrigger.create({
        trigger: "[data-rv-section='cta']",
        start: "top 82%",
        once: true,
        onEnter: () => {
          const h = root.querySelector<HTMLHeadingElement>("[data-rv-cta-headline]");
          if (h) {
            const split = new SplitText(h, { type: "chars,words" });
            gsap.from(split.chars, {
              opacity: 0, y: 26, rotateX: -45, duration: 0.8, stagger: 0.016, ease: "back.out(1.2)",
            });
          }
          gsap.to("[data-rv-section='cta'] [data-rv-cta-sub]", {
            opacity: 1, y: 0, duration: 0.65, stagger: 0.08, ease: "expo.out", delay: 0.45,
          });
          gsap.to("[data-rv-section='cta'] .rv-cta-flourish", {
            drawSVG: "0% 100%", duration: 1.2, ease: "expo.out", delay: 0.7,
          });
        },
      });

      // ── STACKING DEPTH ───────────────────────────────
      // Each panel is sticky (CSS); as the *next* panel slides up to cover it,
      // ease the covered panel "back" — slight scale-down + dim + rounded
      // corners — so the stack reads as layered cards, not a flat snap.
      // Desktop only; the CSS already drops to normal flow below 900px.
      if (window.matchMedia("(min-width: 901px)").matches) {
        const panels = gsap.utils.toArray<HTMLElement>("[data-rv-panel]");
        panels.forEach((panel, i) => {
          const next = panels[i + 1];
          if (!next) return; // last panel never gets covered
          gsap.fromTo(
            panel,
            { scale: 1, filter: "brightness(1)", borderRadius: "0px" },
            {
              scale: 0.94,
              filter: "brightness(0.82)",
              borderRadius: "22px",
              ease: "none",
              scrollTrigger: {
                trigger: next,
                start: "top bottom",
                end: "top top",
                scrub: true,
              },
            },
          );
        });
      }

      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(() => ScrollTrigger.refresh());
      }
    }, scopeRef);

    // Subtle pointer parallax on the hero's "top picks" card — a quiet premium
    // touch. Desktop + hover-capable only, reduced-motion-safe, and written via
    // gsap.quickTo so it stays on the compositor (transform-only, no layout).
    let cleanupParallax: (() => void) | undefined;
    const heroSide = root.querySelector<HTMLElement>(".rv-hero-side");
    if (
      !reduce &&
      heroSide &&
      window.matchMedia("(min-width: 901px) and (hover: hover)").matches
    ) {
      const xTo = gsap.quickTo(heroSide, "x", { duration: 0.7, ease: "power3.out" });
      const yTo = gsap.quickTo(heroSide, "y", { duration: 0.7, ease: "power3.out" });
      const onMove = (e: PointerEvent) => {
        const dx = e.clientX / window.innerWidth - 0.5; // -0.5 … 0.5
        const dy = e.clientY / window.innerHeight - 0.5;
        xTo(dx * -16); // ≤ 8px drift
        yTo(dy * -12); // ≤ 6px drift
      };
      window.addEventListener("pointermove", onMove, { passive: true });
      cleanupParallax = () => {
        window.removeEventListener("pointermove", onMove);
        gsap.set(heroSide, { clearProps: "transform" });
      };
    }

    return () => {
      ctx.revert();
      cleanupParallax?.();
    };
  }, []);

  const navLinkClass = (id: string) =>
    `rv-nav-link${activeSection === id ? " rv-nav-link-active" : ""}`;

  return (
    <>
    <ScrollRail activeSection={activeSection} />
    <div ref={scopeRef} className="rv-catalog min-h-screen overflow-x-clip relative">
      <style>{STYLES}</style>
      <PaperGrain />
      <DonateBanner />

      {/* ── TOP TICKER ───────────────────────────────────── */}
      <div className="rv-ticker" role="presentation">
        <div className="rv-ticker-track">
          {[...TICKER_ITEMS, ...TICKER_ITEMS].map((t, i) => (
            <span key={i} className="rv-ticker-item">
              <span className="rv-ticker-dot" />
              <span className="rv-ticker-text">{t}</span>
            </span>
          ))}
        </div>
      </div>

      {/* ── NAV ──────────────────────────────────────────── */}
      <nav className="rv-nav">
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

        <div ref={mobileMenuRef} className="rv-mobile-panel" style={{ display: "none" }}>
          <div className="px-5 py-7 flex flex-col gap-4">
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
      </nav>

      {/* ── HERO ─────────────────────────────────────────── */}
      <section data-rv-section="hero" data-rv-panel className="rv-hero" style={{ zIndex: 1 }}>
        <div className="rv-hero-inner">
          <div className="rv-hero-grid">
            <div className="rv-hero-main">
              <div data-rv-hero-eyebrow className="rv-hero-eyebrow">
                <span className="rv-hero-eyebrow-dot" />
                <span>Updated 4 min ago · <span ref={indexCounterRef}>0</span> listings scanned today</span>
              </div>

              <h1 ref={heroHeadlineRef} className="rv-display rv-hero-headline">
                Find <em className="rv-emph">underpriced</em> used cars<br />
                before everyone else does.
              </h1>

              <svg className="rv-hero-underline-svg" viewBox="0 0 200 8" preserveAspectRatio="none" aria-hidden>
                <path
                  ref={heroUnderlineRef}
                  className="rv-draw"
                  d="M2,5 C 40,2 90,2 140,5 C 165,7 185,4 198,5"
                  fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"
                />
              </svg>

              <p data-rv-hero-lede className="rv-hero-lede">
                We scan every major marketplace and surface the used cars priced below fair market value &mdash; with the math attached.
              </p>

              <div className="rv-hero-cta-row">
                <button data-rv-hero-cta onClick={onGetStarted} className="rv-btn rv-btn-primary rv-btn-lg">
                  <span>See today&apos;s deals</span>
                  <Arrow size={14} />
                </button>
                <a data-rv-hero-cta href="#how" className="rv-btn rv-btn-ghost rv-btn-lg">
                  <span>How it works</span>
                </a>
              </div>

              <div className="rv-hero-meta">
                <svg className="rv-hero-meta-svg" viewBox="0 0 100 2" preserveAspectRatio="none" aria-hidden>
                  <path className="rv-draw rv-hero-rule" d="M0,1 L100,1" stroke="currentColor" strokeWidth="1.2" />
                </svg>
                <div className="rv-hero-meta-row">
                  <span className="rv-hero-meta-cell">
                    <span className="rv-hero-meta-v">12,408</span>
                    <span className="rv-hero-meta-k">listings scanned today</span>
                  </span>
                  <span className="rv-hero-meta-cell">
                    <span className="rv-hero-meta-v">8,500+</span>
                    <span className="rv-hero-meta-k">active buyers</span>
                  </span>
                  <span className="rv-hero-meta-cell">
                    <span className="rv-hero-meta-v">$3,210</span>
                    <span className="rv-hero-meta-k">avg. savings per deal</span>
                  </span>
                </div>
              </div>
            </div>

            <aside className="rv-hero-side">
              <div className="rv-hero-side-head">
                <span className="rv-hero-side-title">Today&apos;s top picks</span>
                <span className="rv-hero-side-meta">4 min ago</span>
              </div>

              <ul className="rv-hero-lots">
                {heroLots.map((lot, i) => (
                  <li key={i} className="rv-hero-lot-preview">
                    <span className="rv-hero-lot-body">
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

              <div className="rv-hero-side-foot">
                <button onClick={onGetStarted} className="rv-hero-side-cta">
                  <span>View all 12,408 listings</span>
                  <Arrow size={11} />
                </button>
              </div>
            </aside>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS / WHAT WE DO ──────────────────── */}
      <section id="how" data-rv-section="how" data-rv-panel className="rv-section rv-section-paper" style={{ zIndex: 2 }}>
        <div className="rv-section-inner">
          <div className="rv-how-grid">
            <div className="rv-how-side">
              <h2 data-rv-how-headline className="rv-display rv-how-title">
                How it works
              </h2>
              <p className="rv-how-side-sub">
                Every listing runs the same three steps. No favors, no paid placement.
              </p>
            </div>

            <ol className="rv-how-steps">
              {STEPS.map((s, i) => (
                <li key={s.title} className="rv-step-row">
                  <span className="rv-step-num">{String(i + 1).padStart(2, "0")}</span>
                  <div className="rv-step-body">
                    <h3 className="rv-display rv-step-title">{s.title}</h3>
                    <p className="rv-step-text">{s.body}</p>
                    <span className="rv-step-foot">{s.foot}</span>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* ── INDEX (deals) — full product UI ─────────────── */}
      <section id="deals" data-rv-section="deals" data-rv-panel className="rv-section" style={{ zIndex: 3 }}>
        <div className="rv-section-inner">
          <SectionHead
            title="Today's deals"
            sub="Ranked by % below fair market value. Updated 2 min ago."
            headingRef="deals"
          />

          {/* Filter bar */}
          <div className="rv-filter-bar">
            <label className="rv-filter">
              <span className="rv-filter-k">Make</span>
              <select
                className="rv-filter-input"
                value={filterMake}
                onChange={(e) => setFilterMake(e.target.value)}
              >
                <option value="all">All makes</option>
                {makes.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </label>
            <label className="rv-filter">
              <span className="rv-filter-k">Min. score</span>
              <div className="rv-filter-score">
                <input
                  type="range" min={0} max={100} step={5}
                  value={filterMinScore}
                  onChange={(e) => setFilterMinScore(Number(e.target.value))}
                  className="rv-filter-range"
                />
                <span className="rv-filter-range-val">{filterMinScore}</span>
              </div>
            </label>
            <label className="rv-filter">
              <span className="rv-filter-k">Sort by</span>
              <select
                className="rv-filter-input"
                value={filterSort}
                onChange={(e) => setFilterSort(e.target.value as "delta" | "score" | "posted")}
              >
                <option value="delta">Largest discount</option>
                <option value="score">Highest score</option>
                <option value="posted">Most recently posted</option>
              </select>
            </label>
            <label className="rv-filter rv-filter-toggle">
              <input
                type="checkbox"
                checked={savedOnly}
                onChange={(e) => setSavedOnly(e.target.checked)}
                className="rv-filter-checkbox"
              />
              <span>Saved only ({saved.size})</span>
            </label>
            <span className="rv-filter-result">
              {filteredDeals.length} of {rows.length} listings
            </span>
          </div>

          <div className="rv-index-wrap">
            <table className="rv-index">
              <thead>
                <tr>
                  <th className="rv-index-th rv-index-th-save" aria-label="Save"></th>
                  <th className="rv-index-th rv-index-th-vehicle">Vehicle</th>
                  <th className="rv-index-th rv-index-th-loc">Location</th>
                  <th className="rv-index-th rv-index-th-num">Miles</th>
                  <th className="rv-index-th rv-index-th-num">Fair</th>
                  <th className="rv-index-th rv-index-th-num">Asking</th>
                  <th className="rv-index-th rv-index-th-num">Δ</th>
                  <th className="rv-index-th rv-index-th-conf">Confidence</th>
                  <th className="rv-index-th rv-index-th-score">Score</th>
                  <th className="rv-index-th rv-index-th-act"></th>
                </tr>
              </thead>
              <tbody>
                {filteredDeals.length === 0 && (
                  <tr>
                    <td colSpan={10} className="rv-index-empty">
                      No listings match these filters. <button onClick={() => { setFilterMake("all"); setFilterMinScore(0); setSavedOnly(false); }} className="rv-link">Clear filters</button>
                    </td>
                  </tr>
                )}
                {filteredDeals.map((d) => {
                  const isOpen = expanded === d.id;
                  const isSaved = saved.has(d.id);
                  return (
                    <Fragment key={d.id}>
                      <tr className={`rv-lot-row ${isOpen ? "rv-lot-row-open" : ""}`}>
                        <td className="rv-lot-cell rv-lot-cell-save">
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
                        <td className="rv-lot-cell rv-lot-cell-vehicle">
                          <span className="rv-lot-vehicle">{d.title}</span>
                          <span className="rv-lot-source">{d.source} · posted {d.postedLabel}</span>
                        </td>
                        <td className="rv-lot-cell rv-lot-cell-loc">{d.location}</td>
                        <td className="rv-lot-cell rv-lot-cell-num">{d.miles}</td>
                        <td className="rv-lot-cell rv-lot-cell-num rv-lot-cell-strike">{d.fair}</td>
                        <td className="rv-lot-cell rv-lot-cell-num">
                          <span className="rv-lot-price">{d.price}</span>
                        </td>
                        <td className="rv-lot-cell rv-lot-cell-num rv-lot-cell-delta">{d.delta}</td>
                        <td className="rv-lot-cell rv-lot-cell-conf">
                          <ConfidenceBars level={d.confidence} />
                        </td>
                        <td className="rv-lot-cell rv-lot-cell-score">
                          <span className="rv-lot-score-pill">{d.score}<span className="rv-lot-score-of">/100</span></span>
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
                              <div className="rv-lot-detail-col">
                                <div className="rv-lot-detail-k">Why this score?</div>
                                <ul className="rv-lot-detail-list">
                                  {d.reasons.map((r) => (
                                    <li key={r}><span className="rv-lot-detail-mark">·</span>{r}</li>
                                  ))}
                                </ul>
                              </div>
                              <div className="rv-lot-detail-col">
                                <div className="rv-lot-detail-k">Confidence interval</div>
                                <div className="rv-confidence-bar">
                                  <div className="rv-confidence-bar-rail">
                                    <div className="rv-confidence-bar-fill" style={{ left: `${d.ciLow}%`, width: `${d.ciHigh - d.ciLow}%` }} />
                                    <div className="rv-confidence-bar-mark" style={{ left: `${d.ciFair}%` }} />
                                  </div>
                                  <div className="rv-confidence-bar-labels">
                                    <span>${d.ciLowVal}k</span>
                                    <span className="rv-confidence-bar-fair">fair · ${d.ciFairVal}k</span>
                                    <span>${d.ciHighVal}k</span>
                                  </div>
                                </div>
                                <div className="rv-lot-detail-meta">
                                  Based on {d.compCount} comparable sales · {d.daysOnMarket} days on market
                                </div>
                              </div>
                              <div className="rv-lot-detail-col rv-lot-detail-col-actions">
                                <a href="#" className="rv-btn rv-btn-primary rv-btn-sm">
                                  <span>View listing</span>
                                  <Arrow size={11} />
                                </a>
                                <button onClick={() => toggleSave(d.id)} className="rv-btn rv-btn-outline rv-btn-sm">
                                  <span>{isSaved ? "Saved" : "Save"}</span>
                                </button>
                                <a href="#" className="rv-btn rv-btn-ghost rv-btn-sm">
                                  <span>Run VIN check</span>
                                </a>
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
            <span className="rv-index-foot-meta">Showing top 5 of 12,408 listings.</span>
            <button onClick={onGetStarted} className="rv-btn rv-btn-ghost rv-btn-sm">
              <span>See the full index</span>
              <Arrow size={11} />
            </button>
          </div>
        </div>
      </section>

      {/* ── MANIFESTO ────────────────────────────────────── */}
      <section data-rv-section="compare" data-rv-panel className="rv-section rv-section-paper rv-section-compact" style={{ zIndex: 4 }}>
        <div className="rv-section-inner">
          <SectionHead
            title="Most sites work for sellers. <em class='rv-emph'>We work for buyers.</em>"
            html
            headingRef="compare"
          />

          <div className="rv-manifesto">
            <div className="rv-manifesto-col">
              <span className="rv-manifesto-col-tag">Most listing sites</span>
              <ul className="rv-manifesto-list">
                {LEGACY.map((t) => (
                  <li key={t} className="rv-legacy-item">
                    <span className="rv-legacy-mark">×</span>
                    <span className="rv-legacy-body">
                      <span className="rv-legacy-text">{t}</span>
                      <svg className="rv-legacy-strike-svg" viewBox="0 0 100 2" preserveAspectRatio="none" aria-hidden>
                        <path className="rv-draw rv-legacy-strike" d="M0,1 L100,1" stroke="currentColor" strokeWidth="1.5" />
                      </svg>
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rv-manifesto-divider" aria-hidden />

            <div className="rv-manifesto-col">
              <span className="rv-manifesto-col-tag rv-manifesto-col-tag-new">Revveal</span>
              <ul className="rv-manifesto-list">
                {REVVEAL_WAY.map((t) => (
                  <li key={t} className="rv-reveal-item">
                    <span className="rv-reveal-mark">→</span>
                    <span className="rv-reveal-text">{t}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────── */}
      <section data-rv-section="cta" data-rv-panel className="rv-section rv-section-ink rv-section-cta" style={{ zIndex: 5 }}>
        <div className="rv-section-inner rv-cta-inner">
          <h2 data-rv-cta-headline className="rv-display rv-cta-headline">
            Stop overpaying.<br />
            Start <em className="rv-emph">Revvealing</em>.
            <svg className="rv-cta-flourish-svg" viewBox="0 0 200 12" preserveAspectRatio="none" aria-hidden>
              <path
                className="rv-draw rv-cta-flourish"
                d="M2,8 C 30,2 60,10 90,5 C 120,1 150,9 180,4 C 188,3 195,6 198,7"
                fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"
              />
            </svg>
          </h2>
          <p data-rv-cta-sub className="rv-cta-lede">
            Free for buyers — we earn from dealers, not from you.
          </p>
          <div data-rv-cta-sub className="rv-cta-buttons">
            <button onClick={onGetStarted} className="rv-btn rv-btn-primary-on-dark rv-btn-xl">
              <span>Get started — it&apos;s free</span>
              <Arrow size={16} />
            </button>
            <a href="#how" className="rv-btn rv-btn-ghost-on-dark rv-btn-xl">
              <span>How it works</span>
            </a>
          </div>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────── */}
      <footer className="rv-colophon">
        <div className="rv-section-inner">
          <div className="rv-colophon-top">
            <Wordmark />
            <span className="rv-colophon-rule" />
            <span className="rv-colophon-meta">Buyer-first used car index · 2026</span>
          </div>

          <DonationStrip />

          <div className="rv-colophon-bot">
            <div className="rv-colophon-links">
              {([
                ["Privacy", "#/privacy"],
                ["Terms", "#/terms"],
                ["Press", "#"],
                ["Careers", "#"],
                ["GitHub", "#"],
              ] as const).map(([l, h]) => (
                <a key={l} href={h} className="rv-colophon-link">{l}</a>
              ))}
            </div>
            <div className="rv-colophon-copy">© 2026 Revveal · Built for buyers, not dealers.</div>
          </div>
        </div>
      </footer>

      {/* ── BUYER DESK (floating assistant) ──────────────── */}
      <BuyerDesk />
    </div>
    </>
  );
}

/* ── COMPONENTS ───────────────────────────────────────────── */

function Wordmark() {
  return (
    <a href="#" className="rv-wordmark">
      <span className="rv-wordmark-mark">
        <img src="/revveal-logo.png" alt="Revveal" className="rv-wordmark-img" />
      </span>
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

function PaperGrain() {
  return (
    <svg className="rv-grain" aria-hidden>
      <filter id="rv-grain-filter">
        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" />
        <feColorMatrix values="0 0 0 0 0.05  0 0 0 0 0.04  0 0 0 0 0.03  0 0 0 0.55 0" />
      </filter>
      <rect width="100%" height="100%" filter="url(#rv-grain-filter)" />
    </svg>
  );
}

function SectionHead({
  title, sub, html = false, headingRef,
}: {
  title: string; sub?: string;
  html?: boolean; headingRef?: string;
}) {
  const refAttr = headingRef ? { [`data-rv-${headingRef}-headline`]: "" } : {};
  return (
    <header className="rv-section-head">
      {html ? (
        <h2
          className="rv-display rv-section-head-title"
          {...refAttr}
          dangerouslySetInnerHTML={{ __html: title }}
        />
      ) : (
        <h2 className="rv-display rv-section-head-title" {...refAttr}>{title}</h2>
      )}
      {sub && <p className="rv-section-head-sub">{sub}</p>}
    </header>
  );
}

function ConfidenceBars({ level }: { level: "low" | "med" | "high" }) {
  const filled = level === "high" ? 3 : level === "med" ? 2 : 1;
  return (
    <span className="rv-conf" aria-label={`Confidence: ${level}`}>
      {[0, 1, 2].map((i) => (
        <span key={i} className={`rv-conf-bar ${i < filled ? "rv-conf-bar-on" : ""}`} />
      ))}
      <span className="rv-conf-label">{level}</span>
    </span>
  );
}

function BuyerDesk() {
  const [open, setOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => { setSubmitted(false); setOpen(false); }, 1800);
  };

  return (
    <div className="rv-desk">
      {open && (
        <div className="rv-desk-panel" role="dialog" aria-label="Buyer desk">
          <div className="rv-desk-head">
            <div className="rv-desk-head-inner">
              <span className="rv-desk-status">
                <span className="rv-desk-status-dot" />
                Open · replies in &lt; 1 hour
              </span>
              <button onClick={() => setOpen(false)} className="rv-desk-close" aria-label="Close">×</button>
            </div>
            <h4 className="rv-display rv-desk-title">Ask a buyer.</h4>
            <p className="rv-desk-body">
              Send a listing URL or what you&apos;re after. A real person replies, usually within the hour.
            </p>
          </div>
          {submitted ? (
            <div className="rv-desk-sent">
              <span className="rv-desk-sent-mark">✓</span>
              <span>Sent. We&apos;ll be in touch.</span>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="rv-desk-form">
              <input
                type="text"
                className="rv-desk-input"
                placeholder="A listing URL, or 'looking for a 2019 Civic under $13k'…"
                aria-label="Your question"
              />
              <button type="submit" className="rv-btn rv-btn-primary rv-btn-sm">
                <span>Send</span>
                <Arrow size={11} />
              </button>
            </form>
          )}
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        className={`rv-desk-tab ${open ? "rv-desk-tab-open" : ""}`}
        aria-expanded={open}
      >
        <span className="rv-desk-tab-mark">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
        </span>
        <span className="rv-desk-tab-label">{open ? "Close" : "Ask a buyer"}</span>
      </button>
    </div>
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
      <div className="rv-donate-copy">
        <span className="rv-donate-text">
          Revveal is free for buyers. Donations are optional and help keep it running.
        </span>
      </div>

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
              type="number"
              min={1}
              max={500}
              inputMode="numeric"
              value={custom}
              onChange={(e) => { setCustom(e.target.value); setError(null); }}
              placeholder="custom"
              className="rv-donate-custom-input"
              aria-label="Custom donation amount in dollars"
            />
          </span>
        </div>

        <button type="button" onClick={donate} disabled={pending} className="rv-donate-btn">
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

  // Strip the ?donate param once we've read it (no state update here).
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
      <span className="rv-donate-banner-text">
        {status === "success"
          ? "Thank you for your support."
          : "Checkout cancelled — no charge made."}
      </span>
      <button onClick={() => setStatus(null)} className="rv-donate-banner-close" aria-label="Dismiss">×</button>
    </div>
  );
}

/* ── DATA ─────────────────────────────────────────────────── */

const NAV_LINKS: [string, string][] = [
  ["Deals", "deals"],
  ["How it works", "how"],
];

const TICKER_ITEMS = [
  "Honda Civic EX 2019 · Austin, TX · $12,400 · −20.5%",
  "Subaru Forester 2020 · Denver, CO · $18,900 · −15.6%",
  "Toyota Camry SE 2018 · Phoenix, AZ · $11,250 · −24.1%",
  "Mazda CX-5 2021 · Portland, OR · $19,400 · −18.2%",
  "Ford F-150 XLT 2019 · Houston, TX · $24,800 · −13.4%",
  "12,408 listings scanned today · 47 markets · no paid placement",
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
    title: "Pull every listing.",
    body: "Marketplace, Craigslist, AutoTrader, CarGurus and dealer feeds — every major US market, refreshed every few minutes and deduped.",
    foot: "Live · 47 markets",
  },
  {
    title: "Compare to fair market.",
    body: "We score each listing against thousands of comparable sales, then surface title, history and odometer flags.",
    foot: "Math published",
  },
  {
    title: "Surface the underpriced ones.",
    body: "Ranked by % below fair value, with a confidence band. Save a search and we&apos;ll text you within five minutes of a match.",
    foot: "Alerts in &lt; 5 min",
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
  "Dealers pay to rank higher in results.",
  "Badges with no math behind them.",
  "Private and Marketplace listings buried.",
  "Pages full of sponsored inventory.",
];

const REVVEAL_WAY = [
  "Pure algorithmic ranking. No paid placement.",
  "Every score shows its comps and confidence.",
  "Marketplace, Craigslist, dealers — one index.",
  "Built for buyers, not the inventory page.",
];

/* ── STYLES ───────────────────────────────────────────────── */

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght,SOFT,WONK@0,9..144,300..900,0..100,0..1;1,9..144,300..900,0..100,0..1&family=Newsreader:ital,opsz,wght@0,6..72,300..700;1,6..72,300..700&family=JetBrains+Mono:wght@400;500;600;700&display=swap');

  .rv-catalog {
    --paper:        #ece2cd;
    --paper-deep:   #ddd0b4;
    --paper-soft:   #f3eada;
    --paper-pale:   #f7f0df;
    --ink:          #18130a;
    --ink-soft:     #2a2418;
    --ink-muted:    #6f6244;
    --ink-fade:     #968866;
    --red:          #b8312e;
    --red-deep:     #8a1d1c;
    --brass:        #a3792c;
    --rv-nav-h:     62px;

    background: var(--paper);
    color: var(--ink);
    font-family: 'Newsreader', Georgia, serif;
    font-feature-settings: "ss01", "ss02", "liga";
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
  }

  .rv-catalog .rv-display {
    font-family: 'Fraunces', 'Times New Roman', serif;
    font-variation-settings: "opsz" 144, "SOFT" 50, "WONK" 0;
    font-weight: 600;
    letter-spacing: -0.018em;
  }

  /* Red italic — used sparingly, 3 instances on the page total. */
  .rv-catalog .rv-emph {
    font-style: italic;
    color: var(--red);
    font-variation-settings: "opsz" 144, "SOFT" 100, "WONK" 1;
  }

  /* Paper grain overlay */
  .rv-catalog .rv-grain {
    position: fixed; inset: 0;
    width: 100vw; height: 100vh;
    pointer-events: none;
    z-index: 100;
    opacity: 0.28;
    mix-blend-mode: multiply;
  }

  /* ── TICKER ───────────────────────────────────────── */
  .rv-catalog .rv-ticker {
    position: relative;
    z-index: 60;
    background: var(--ink);
    color: var(--paper);
    overflow: hidden;
  }
  .rv-catalog .rv-ticker-track {
    display: flex; gap: 36px;
    padding: 8px 0;
    white-space: nowrap;
    animation: rv-ticker 64s linear infinite;
    font-family: 'JetBrains Mono', monospace;
    font-size: 10.5px;
    letter-spacing: 0.04em;
    width: max-content;
  }
  .rv-catalog .rv-ticker-item { display: inline-flex; align-items: center; gap: 10px; }
  .rv-catalog .rv-ticker-dot { width: 4px; height: 4px; background: var(--red); display: inline-block; flex-shrink: 0; }
  .rv-catalog .rv-ticker-text { opacity: 0.88; }
  @keyframes rv-ticker {
    from { transform: translateX(0); }
    to   { transform: translateX(-50%); }
  }

  /* ── NAV ──────────────────────────────────────────── */
  .rv-catalog .rv-nav {
    position: sticky; top: 0;
    z-index: 50;
    background: var(--paper);
    border-bottom: 1px solid var(--ink);
    transition: box-shadow 0.3s ease;
  }
  .rv-catalog .rv-nav-pinned {
    box-shadow: 0 1px 0 var(--ink), 0 6px 14px -10px rgba(20,15,8,0.18);
  }
  .rv-catalog .rv-nav-inner {
    max-width: 1320px; margin: 0 auto;
    padding: 12px 24px;
    display: flex; align-items: center; justify-content: space-between;
    gap: 24px;
  }

  .rv-catalog .rv-wordmark {
    display: inline-flex; align-items: center; gap: 10px;
    color: var(--ink); text-decoration: none;
  }
  .rv-catalog .rv-wordmark-mark {
    display: inline-flex; align-items: center; justify-content: center;
    width: 36px; height: 36px;
  }
  .rv-catalog .rv-wordmark-img {
    width: 100%; height: 100%;
    object-fit: contain;
    display: block;
  }
  .rv-catalog .rv-wordmark-name {
    font-family: 'Fraunces', serif;
    font-variation-settings: "opsz" 144, "SOFT" 30;
    font-weight: 700;
    font-size: 22px;
    letter-spacing: -0.02em;
    color: var(--ink);
    line-height: 1;
  }

  .rv-catalog .rv-nav-link {
    font-family: 'Fraunces', serif;
    font-variation-settings: "opsz" 14, "SOFT" 30;
    font-weight: 500;
    font-size: 15px;
    color: var(--ink);
    padding: 8px 14px;
    text-decoration: none;
    transition: color 0.2s ease;
    position: relative;
  }
  .rv-catalog .rv-nav-link:hover { color: var(--red); }
  .rv-catalog .rv-nav-link-active { color: var(--red); }
  .rv-catalog .rv-nav-link-active::before {
    content: "·"; position: absolute; left: 4px; top: 50%;
    transform: translateY(-50%); color: var(--red); font-size: 18px;
  }
  .rv-catalog .rv-nav-login {
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--ink);
    background: transparent; border: none;
    padding: 8px 4px; cursor: pointer;
    transition: color 0.2s ease;
  }
  .rv-catalog .rv-nav-login:hover { color: var(--red); }

  .rv-catalog .rv-burger {
    width: 38px; height: 38px;
    display: inline-flex; flex-direction: column; gap: 4px;
    align-items: center; justify-content: center;
    background: transparent; border: 1px solid var(--ink);
    cursor: pointer;
  }
  .rv-catalog .rv-burger-bar {
    width: 16px; height: 1.4px; background: var(--ink);
    transition: transform 0.3s ease, opacity 0.2s ease, width 0.3s ease;
    transform-origin: center;
  }
  .rv-catalog .rv-burger-bar-top-open { transform: translateY(5px) rotate(45deg); }
  .rv-catalog .rv-burger-bar-mid-open { opacity: 0; width: 0; }
  .rv-catalog .rv-burger-bar-bot-open { transform: translateY(-5px) rotate(-45deg); }

  .rv-catalog .rv-mobile-panel {
    background: var(--paper);
    border-top: 1px solid var(--ink);
    border-bottom: 1px solid var(--ink);
  }
  .rv-catalog .rv-mobile-link {
    font-family: 'Fraunces', serif;
    font-variation-settings: "opsz" 36, "SOFT" 40;
    font-weight: 500;
    font-size: 20px;
    color: var(--ink);
    background: transparent; border: none;
    padding: 8px 0; cursor: pointer;
    text-decoration: none;
    transition: color 0.2s ease, transform 0.2s ease;
  }
  .rv-catalog .rv-mobile-link:hover { color: var(--red); transform: translateX(3px); }
  .rv-catalog .rv-rule-static { height: 1px; background: var(--ink); opacity: 0.4; }

  /* ── BUTTONS ──────────────────────────────────────── */
  .rv-catalog .rv-btn {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 10px 16px;
    border-radius: 0;
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    line-height: 1;
    cursor: pointer;
    text-decoration: none;
    transition: background 0.2s ease, color 0.2s ease, border-color 0.2s ease, transform 0.15s ease;
    white-space: nowrap;
    border: 1px solid transparent;
  }
  .rv-catalog .rv-btn-sm { padding: 8px 12px; font-size: 10px; }
  .rv-catalog .rv-btn-lg { padding: 13px 20px; font-size: 11.5px; gap: 10px; }
  .rv-catalog .rv-btn-xl { padding: 16px 26px; font-size: 12.5px; gap: 12px; }
  .rv-catalog .rv-btn-arrow { transition: transform 0.25s cubic-bezier(0.16,1,0.3,1); }
  .rv-catalog .rv-btn:hover .rv-btn-arrow { transform: translateX(3px); }

  .rv-catalog .rv-btn-primary {
    background: var(--red); color: var(--paper-pale);
    border-color: var(--red);
    box-shadow: 3px 3px 0 var(--ink);
  }
  .rv-catalog .rv-btn-primary:hover {
    background: var(--ink); color: var(--paper-pale); border-color: var(--ink);
    transform: translate(-1px, -1px);
    box-shadow: 4px 4px 0 var(--red);
  }
  .rv-catalog .rv-btn-primary:active {
    transform: translate(2px, 2px); box-shadow: 1px 1px 0 var(--red);
  }

  .rv-catalog .rv-btn-outline {
    background: transparent; color: var(--ink);
    border: 1px solid var(--ink);
  }
  .rv-catalog .rv-btn-outline:hover {
    background: var(--ink); color: var(--paper-pale);
  }

  .rv-catalog .rv-btn-ghost {
    background: transparent; color: var(--ink);
    border: none;
    padding-left: 4px; padding-right: 4px;
    border-bottom: 1px solid var(--ink);
  }
  .rv-catalog .rv-btn-ghost:hover { color: var(--red); border-color: var(--red); }

  .rv-catalog .rv-btn-primary-on-dark {
    background: var(--paper-pale); color: var(--ink);
    border-color: var(--paper-pale);
    box-shadow: 3px 3px 0 var(--red);
  }
  .rv-catalog .rv-btn-primary-on-dark:hover {
    background: var(--red); color: var(--paper-pale); border-color: var(--red);
    transform: translate(-1px, -1px);
    box-shadow: 4px 4px 0 var(--paper-pale);
  }
  .rv-catalog .rv-btn-ghost-on-dark {
    background: transparent; color: var(--paper-pale);
    border: none;
    padding-left: 4px; padding-right: 4px;
    border-bottom: 1px solid var(--paper-pale);
  }
  .rv-catalog .rv-btn-ghost-on-dark:hover { color: var(--red); border-color: var(--red); }

  .rv-catalog .rv-link {
    color: var(--red); text-decoration: underline;
    background: transparent; border: none; padding: 0;
    cursor: pointer; font: inherit;
  }

  /* ── HERO ─────────────────────────────────────────── */
  .rv-catalog .rv-hero {
    position: relative;
    padding: 48px 24px 72px;
    overflow: hidden;
    isolation: isolate;
    background: var(--paper);
  }
  .rv-catalog .rv-hero-inner {
    max-width: 1320px; margin: 0 auto;
    position: relative; z-index: 2;
  }
  .rv-catalog .rv-hero-grid {
    display: grid; grid-template-columns: 1fr; gap: 44px;
  }
  @media (min-width: 1024px) {
    .rv-catalog .rv-hero-grid {
      grid-template-columns: minmax(0, 1.55fr) minmax(0, 1fr);
      gap: 64px;
    }
  }

  .rv-catalog .rv-hero-eyebrow {
    display: inline-flex; align-items: center; gap: 10px;
    padding: 6px 12px;
    background: var(--paper-pale);
    border: 1px solid var(--ink);
    color: var(--ink);
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    letter-spacing: 0.10em;
    font-weight: 600;
    margin-bottom: 22px;
  }
  .rv-catalog .rv-hero-eyebrow-dot {
    width: 6px; height: 6px;
    background: var(--red); border-radius: 50%;
    animation: rv-pulse 2s ease-in-out infinite;
  }
  @keyframes rv-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }

  .rv-catalog .rv-hero-headline {
    font-size: clamp(2.6rem, 6.2vw, 5.2rem);
    line-height: 0.98;
    letter-spacing: -0.025em;
    margin: 4px 0 6px;
    color: var(--ink);
    font-weight: 600;
    max-width: 18ch;
  }
  .rv-catalog .rv-hero-underline-svg {
    display: block;
    width: 100%;
    max-width: 320px;
    height: 12px;
    color: var(--red);
    margin-top: -4px;
    overflow: visible;
  }

  .rv-catalog .rv-hero-lede {
    font-family: 'Newsreader', serif;
    font-variation-settings: "opsz" 18;
    font-size: clamp(1.05rem, 1.4vw, 1.18rem);
    line-height: 1.55;
    color: var(--ink-soft);
    max-width: 56ch;
    margin: 24px 0 28px;
    font-weight: 400;
  }

  .rv-catalog .rv-hero-cta-row {
    display: flex; gap: 16px; flex-wrap: wrap;
    align-items: center;
    margin-bottom: 40px;
  }

  .rv-catalog .rv-hero-meta { max-width: 640px; }
  .rv-catalog .rv-hero-meta-svg {
    display: block; width: 100%; height: 4px;
    color: var(--ink); overflow: visible;
    margin-bottom: 14px;
  }
  .rv-catalog .rv-hero-meta-row {
    display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px;
  }
  .rv-catalog .rv-hero-meta-cell {
    display: flex; flex-direction: column; gap: 2px;
  }
  .rv-catalog .rv-hero-meta-v {
    font-family: 'Fraunces', serif;
    font-variation-settings: "opsz" 72, "SOFT" 30;
    font-weight: 600;
    font-size: 1.45rem;
    line-height: 1;
    color: var(--ink);
    letter-spacing: -0.01em;
  }
  .rv-catalog .rv-hero-meta-k {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--ink-muted);
  }

  /* Hero side — practical lot preview, no journal cosplay */
  .rv-catalog .rv-hero-side {
    position: relative;
    background: var(--paper-pale);
    border: 1px solid var(--ink);
    padding: 20px 22px 18px;
    box-shadow: 5px 5px 0 var(--ink);
  }
  .rv-catalog .rv-hero-side-head {
    display: flex; align-items: baseline; justify-content: space-between;
    gap: 12px;
    padding-bottom: 12px;
    border-bottom: 1.5px solid var(--ink);
    margin-bottom: 14px;
  }
  .rv-catalog .rv-hero-side-title {
    font-family: 'Fraunces', serif;
    font-variation-settings: "opsz" 36, "SOFT" 40;
    font-weight: 600;
    font-size: 18px;
    color: var(--ink);
    letter-spacing: -0.01em;
  }
  .rv-catalog .rv-hero-side-meta {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--ink-muted);
  }
  .rv-catalog .rv-hero-lots {
    list-style: none; padding: 0; margin: 0;
    display: flex; flex-direction: column;
  }
  .rv-catalog .rv-hero-lot-preview {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 14px;
    align-items: baseline;
    padding: 10px 0;
    border-bottom: 1px dashed var(--ink-fade);
    will-change: transform, opacity;
  }
  .rv-catalog .rv-hero-lot-preview:last-of-type { border-bottom: none; }
  .rv-catalog .rv-hero-lot-body {
    display: flex; flex-direction: column; gap: 2px;
  }
  .rv-catalog .rv-hero-lot-title {
    font-family: 'Fraunces', serif;
    font-variation-settings: "opsz" 18, "SOFT" 30;
    font-weight: 500;
    font-size: 14.5px;
    color: var(--ink);
    line-height: 1.15;
    letter-spacing: -0.005em;
  }
  .rv-catalog .rv-hero-lot-meta {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    color: var(--ink-muted);
  }
  .rv-catalog .rv-hero-lot-pricecol {
    display: flex; flex-direction: column; align-items: flex-end; gap: 1px;
  }
  .rv-catalog .rv-hero-lot-price {
    font-family: 'JetBrains Mono', monospace;
    font-size: 13px; font-weight: 600;
    color: var(--ink);
    font-variant-numeric: tabular-nums;
  }
  .rv-catalog .rv-hero-lot-delta {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10.5px; font-weight: 600;
    color: var(--red);
    font-variant-numeric: tabular-nums;
  }
  .rv-catalog .rv-hero-side-foot {
    padding-top: 14px; margin-top: 8px;
    border-top: 1px solid var(--ink);
  }
  .rv-catalog .rv-hero-side-cta {
    display: inline-flex; align-items: center; gap: 8px;
    background: transparent; border: none;
    padding: 4px 0;
    color: var(--ink);
    font-family: 'JetBrains Mono', monospace;
    font-size: 10.5px; font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    cursor: pointer;
    border-bottom: 1px solid var(--ink);
    transition: color 0.2s ease, border-color 0.2s ease;
  }
  .rv-catalog .rv-hero-side-cta:hover { color: var(--red); border-color: var(--red); }

  /* ── SECTION FRAME ────────────────────────────────── */
  .rv-catalog .rv-section {
    position: relative;
    padding: 72px 24px 80px;
    border-top: 1px solid var(--ink);
    background: var(--paper);
  }
  .rv-catalog .rv-section-paper { background: var(--paper-soft); }
  .rv-catalog .rv-section-ink {
    background: var(--ink);
    color: var(--paper);
  }
  .rv-catalog .rv-section-compact { padding: 60px 24px 64px; }
  .rv-catalog .rv-section-inner {
    max-width: 1280px; margin: 0 auto;
    position: relative; z-index: 2;
  }

  /* ── STACKING PANELS — each section pins under the nav and the next
        slides up to cover it; GSAP eases the covered panel back for depth.
        Desktop-only enhancement; falls back to normal flow below. ─────── */
  .rv-catalog [data-rv-panel] {
    position: sticky;
    top: var(--rv-nav-h, 62px);
    min-height: calc(100vh - var(--rv-nav-h, 62px));
    will-change: transform, filter;
    transform-origin: 50% 0%;
  }
  @media (max-width: 900px) {
    .rv-catalog [data-rv-panel] {
      position: static;
      min-height: 0;
      transform: none;
      filter: none;
    }
  }

  /* ── SECTION HEAD ─────────────────────────────────── */
  .rv-catalog .rv-section-head {
    margin-bottom: 40px;
    max-width: 760px;
  }
  .rv-catalog .rv-section-head-title {
    font-size: clamp(2rem, 4.4vw, 3.2rem);
    line-height: 1.05;
    letter-spacing: -0.022em;
    color: var(--ink);
    font-weight: 600;
    margin: 0;
    max-width: 22ch;
  }
  .rv-catalog .rv-section-head-sub {
    font-family: 'Newsreader', serif;
    font-variation-settings: "opsz" 18;
    font-size: clamp(1.02rem, 1.3vw, 1.15rem);
    line-height: 1.55;
    color: var(--ink-muted);
    margin: 14px 0 0;
    max-width: 58ch;
  }

  /* ── HOW IT WORKS — asymmetric ────────────────────── */
  .rv-catalog .rv-how-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 32px;
  }
  @media (min-width: 900px) {
    .rv-catalog .rv-how-grid {
      grid-template-columns: minmax(0, 0.85fr) minmax(0, 1.2fr);
      gap: 72px;
    }
  }
  .rv-catalog .rv-how-side {
    position: relative;
  }
  @media (min-width: 900px) {
    .rv-catalog .rv-how-side {
      position: sticky;
      top: 100px;
      align-self: start;
    }
  }
  .rv-catalog .rv-how-title {
    font-size: clamp(1.9rem, 3.8vw, 2.8rem);
    line-height: 1.05;
    letter-spacing: -0.02em;
    color: var(--ink);
    font-weight: 600;
    margin: 4px 0 16px;
  }
  .rv-catalog .rv-how-side-sub {
    font-family: 'Newsreader', serif;
    font-variation-settings: "opsz" 18;
    font-size: 16px;
    color: var(--ink-muted);
    line-height: 1.55;
    margin: 0;
    max-width: 40ch;
  }

  .rv-catalog .rv-how-steps {
    list-style: none; padding: 0; margin: 0;
    display: flex; flex-direction: column;
    gap: 0;
    border-top: 1.5px solid var(--ink);
    border-bottom: 1.5px solid var(--ink);
  }
  .rv-catalog .rv-step-row {
    display: grid;
    grid-template-columns: 70px 1fr;
    gap: 24px;
    padding: 22px 4px 24px;
    border-bottom: 1px solid var(--ink);
    opacity: 0;
    transform: translateY(20px);
    will-change: transform, opacity;
  }
  .rv-catalog .rv-step-row:last-child { border-bottom: none; }
  .rv-catalog .rv-step-num {
    font-family: 'Fraunces', serif;
    font-variation-settings: "opsz" 144, "SOFT" 60;
    font-weight: 700;
    font-size: 3rem;
    line-height: 0.85;
    color: var(--red);
    letter-spacing: -0.03em;
    font-variant-numeric: tabular-nums;
  }
  .rv-catalog .rv-step-body { display: flex; flex-direction: column; }
  .rv-catalog .rv-step-title {
    font-size: 1.4rem;
    line-height: 1.1;
    letter-spacing: -0.015em;
    color: var(--ink);
    margin: 6px 0 8px;
    font-weight: 600;
  }
  .rv-catalog .rv-step-text {
    font-family: 'Newsreader', serif;
    font-variation-settings: "opsz" 16;
    font-size: 15px;
    line-height: 1.55;
    color: var(--ink-soft);
    margin: 0 0 10px;
  }
  .rv-catalog .rv-step-foot {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10.5px;
    letter-spacing: 0.10em;
    text-transform: uppercase;
    color: var(--ink-muted);
  }

  /* ── INDEX (deals table — product UI) ─────────────── */
  .rv-catalog .rv-filter-bar {
    display: flex;
    gap: 18px;
    flex-wrap: wrap;
    align-items: flex-end;
    padding: 14px 16px;
    background: var(--paper-pale);
    border: 1px solid var(--ink);
    border-bottom: none;
  }
  .rv-catalog .rv-filter {
    display: flex; flex-direction: column; gap: 4px;
  }
  .rv-catalog .rv-filter-k {
    font-family: 'JetBrains Mono', monospace;
    font-size: 9.5px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--ink-muted);
    font-weight: 600;
  }
  .rv-catalog .rv-filter-input {
    background: var(--paper);
    border: 1px solid var(--ink);
    padding: 7px 10px;
    font-family: 'Newsreader', serif;
    font-size: 14px;
    color: var(--ink);
    min-width: 160px;
    border-radius: 0;
    cursor: pointer;
  }
  .rv-catalog .rv-filter-input:focus {
    outline: 2px solid var(--red);
    outline-offset: -2px;
  }
  .rv-catalog .rv-filter-score {
    display: flex; align-items: center; gap: 10px;
    padding: 4px 0;
  }
  .rv-catalog .rv-filter-range {
    accent-color: var(--red);
    width: 140px;
    cursor: pointer;
  }
  .rv-catalog .rv-filter-range-val {
    font-family: 'JetBrains Mono', monospace;
    font-size: 12px;
    font-weight: 600;
    color: var(--ink);
    min-width: 24px;
    font-variant-numeric: tabular-nums;
  }
  .rv-catalog .rv-filter-toggle {
    flex-direction: row;
    align-items: center;
    gap: 8px;
    padding: 4px 0;
    font-family: 'Newsreader', serif;
    font-size: 14px;
    color: var(--ink);
    cursor: pointer;
    user-select: none;
  }
  .rv-catalog .rv-filter-checkbox {
    width: 16px; height: 16px;
    accent-color: var(--red);
    margin: 0;
  }
  .rv-catalog .rv-filter-result {
    margin-left: auto;
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    letter-spacing: 0.10em;
    color: var(--ink-muted);
    padding-bottom: 4px;
  }

  .rv-catalog .rv-index-wrap {
    border: 1px solid var(--ink);
    background: var(--paper-pale);
    overflow-x: auto;
  }
  .rv-catalog .rv-index {
    width: 100%;
    border-collapse: collapse;
    min-width: 880px;
  }
  .rv-catalog .rv-index-th {
    text-align: left;
    padding: 12px 14px;
    border-bottom: 1.5px solid var(--ink);
    background: var(--paper);
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--ink-soft);
    font-weight: 600;
    white-space: nowrap;
  }
  .rv-catalog .rv-index-th-num { text-align: right; }
  .rv-catalog .rv-index-th-score { text-align: center; width: 72px; }
  .rv-catalog .rv-index-th-save { width: 38px; }
  .rv-catalog .rv-index-th-conf { width: 110px; }
  .rv-catalog .rv-index-th-act { width: 36px; }

  .rv-catalog .rv-lot-row {
    border-bottom: 1px solid var(--paper-deep);
    transition: background 0.15s ease;
    will-change: transform, opacity;
  }
  .rv-catalog .rv-lot-row:hover { background: var(--paper); }
  .rv-catalog .rv-lot-row-open { background: var(--paper); }
  .rv-catalog .rv-lot-cell {
    padding: 14px 14px;
    font-size: 14.5px;
    color: var(--ink);
    vertical-align: middle;
  }
  .rv-catalog .rv-lot-cell-num {
    text-align: right;
    font-family: 'JetBrains Mono', monospace;
    font-size: 13px;
    font-variant-numeric: tabular-nums;
    color: var(--ink-soft);
  }
  .rv-catalog .rv-lot-cell-strike {
    color: var(--ink-fade);
    text-decoration: line-through;
    text-decoration-thickness: 1px;
    text-decoration-color: var(--ink-muted);
  }
  .rv-catalog .rv-lot-cell-delta { color: var(--red); font-weight: 600; }
  .rv-catalog .rv-lot-cell-vehicle {
    display: flex; flex-direction: column; gap: 2px;
    min-width: 220px;
  }
  .rv-catalog .rv-lot-vehicle {
    font-family: 'Fraunces', serif;
    font-variation-settings: "opsz" 24, "SOFT" 30;
    font-weight: 500;
    font-size: 16px;
    color: var(--ink);
    letter-spacing: -0.005em;
  }
  .rv-catalog .rv-lot-source {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    letter-spacing: 0.06em;
    color: var(--ink-fade);
  }
  .rv-catalog .rv-lot-cell-loc { font-style: italic; color: var(--ink-soft); white-space: nowrap; }
  .rv-catalog .rv-lot-price {
    font-family: 'JetBrains Mono', monospace;
    font-size: 14px; font-weight: 700;
    color: var(--ink);
    font-variant-numeric: tabular-nums;
  }
  .rv-catalog .rv-lot-cell-save { padding-right: 0; }
  .rv-catalog .rv-save-btn {
    background: transparent; border: none;
    color: var(--ink-fade);
    cursor: pointer;
    padding: 6px;
    transition: color 0.18s ease, transform 0.18s ease;
    border-radius: 0;
  }
  .rv-catalog .rv-save-btn:hover { color: var(--ink); transform: scale(1.1); }
  .rv-catalog .rv-save-btn-on { color: var(--red); }
  .rv-catalog .rv-save-btn-on:hover { color: var(--red-deep); }
  .rv-catalog .rv-lot-cell-score { text-align: center; }
  .rv-catalog .rv-lot-score-pill {
    display: inline-flex; align-items: baseline; gap: 1px;
    padding: 5px 9px;
    background: var(--ink); color: var(--paper-pale);
    font-family: 'JetBrains Mono', monospace;
    font-size: 12px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.04em;
  }
  .rv-catalog .rv-lot-score-of { font-size: 9px; opacity: 0.6; margin-left: 2px; }
  .rv-catalog .rv-lot-expand {
    background: transparent; border: 1px solid var(--ink-fade);
    width: 22px; height: 22px;
    display: inline-flex; align-items: center; justify-content: center;
    color: var(--ink); cursor: pointer;
    transition: border-color 0.15s ease, background 0.15s ease;
  }
  .rv-catalog .rv-lot-expand:hover { border-color: var(--ink); background: var(--paper); }
  .rv-catalog .rv-lot-row-open .rv-lot-expand { background: var(--ink); color: var(--paper); border-color: var(--ink); }

  /* Confidence dots */
  .rv-catalog .rv-conf {
    display: inline-flex; align-items: center; gap: 6px;
  }
  .rv-catalog .rv-conf-bar {
    width: 6px; height: 14px;
    background: var(--paper-deep);
    border: 1px solid var(--ink-fade);
  }
  .rv-catalog .rv-conf-bar-on { background: var(--ink); border-color: var(--ink); }
  .rv-catalog .rv-conf-label {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    letter-spacing: 0.10em;
    text-transform: uppercase;
    color: var(--ink-muted);
    font-weight: 600;
  }

  /* Expanded row */
  .rv-catalog .rv-lot-detail { background: var(--paper); }
  .rv-catalog .rv-lot-detail-cell { padding: 0; border-bottom: 1px solid var(--paper-deep); }
  .rv-catalog .rv-lot-detail-grid {
    display: grid;
    grid-template-columns: 1.2fr 1fr auto;
    gap: 32px;
    padding: 22px 18px 24px;
    border-top: 2px solid var(--ink);
  }
  @media (max-width: 900px) {
    .rv-catalog .rv-lot-detail-grid { grid-template-columns: 1fr; gap: 18px; }
  }
  .rv-catalog .rv-lot-detail-col { display: flex; flex-direction: column; gap: 10px; }
  .rv-catalog .rv-lot-detail-col-actions {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
    align-self: center;
  }
  .rv-catalog .rv-lot-detail-k {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--red);
    font-weight: 700;
  }
  .rv-catalog .rv-lot-detail-list {
    list-style: none; padding: 0; margin: 0;
    display: flex; flex-direction: column; gap: 6px;
    font-family: 'Newsreader', serif;
    font-variation-settings: "opsz" 16;
    font-size: 14.5px;
    color: var(--ink-soft);
  }
  .rv-catalog .rv-lot-detail-list li { padding-left: 14px; position: relative; line-height: 1.5; }
  .rv-catalog .rv-lot-detail-mark {
    position: absolute; left: 0;
    color: var(--red);
    font-weight: 700;
  }
  .rv-catalog .rv-confidence-bar { display: flex; flex-direction: column; gap: 6px; }
  .rv-catalog .rv-confidence-bar-rail {
    position: relative;
    height: 8px;
    background: var(--paper-deep);
    border: 1px solid var(--ink-fade);
  }
  .rv-catalog .rv-confidence-bar-fill {
    position: absolute; top: 0; bottom: 0;
    background: var(--red);
    opacity: 0.85;
  }
  .rv-catalog .rv-confidence-bar-mark {
    position: absolute; top: -3px; bottom: -3px;
    width: 2px;
    background: var(--ink);
  }
  .rv-catalog .rv-confidence-bar-labels {
    display: flex; justify-content: space-between;
    font-family: 'JetBrains Mono', monospace;
    font-size: 10.5px;
    color: var(--ink-muted);
    font-variant-numeric: tabular-nums;
  }
  .rv-catalog .rv-confidence-bar-fair { color: var(--ink); font-weight: 600; }
  .rv-catalog .rv-lot-detail-meta {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10.5px;
    letter-spacing: 0.06em;
    color: var(--ink-muted);
    margin-top: 4px;
  }
  .rv-catalog .rv-index-empty {
    text-align: center;
    padding: 36px 16px;
    font-family: 'Newsreader', serif;
    font-style: italic;
    font-size: 15px;
    color: var(--ink-muted);
  }

  .rv-catalog .rv-index-foot {
    margin-top: 18px;
    display: flex; align-items: center; justify-content: space-between;
    flex-wrap: wrap; gap: 14px;
    font-family: 'Newsreader', serif;
    font-style: italic;
    font-size: 14.5px;
    color: var(--ink-muted);
  }

  /* ── MANIFESTO ─────────────────────────────────────── */
  .rv-catalog .rv-manifesto {
    display: grid;
    grid-template-columns: 1fr 1px 1fr;
    gap: 0;
    border-top: 1.5px solid var(--ink);
    border-bottom: 1.5px solid var(--ink);
    background: var(--paper-pale);
  }
  @media (max-width: 900px) {
    .rv-catalog .rv-manifesto { grid-template-columns: 1fr; }
  }
  .rv-catalog .rv-manifesto-col { padding: 32px 30px 36px; }
  .rv-catalog .rv-manifesto-divider { background: var(--ink); }
  @media (max-width: 900px) {
    .rv-catalog .rv-manifesto-divider { height: 1px; width: 100%; }
  }
  .rv-catalog .rv-manifesto-col-tag {
    display: inline-block;
    margin-bottom: 22px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 10.5px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    font-weight: 700;
    color: var(--ink-muted);
  }
  .rv-catalog .rv-manifesto-col-tag-new { color: var(--red); }
  .rv-catalog .rv-manifesto-list {
    list-style: none; padding: 0; margin: 0;
    display: flex; flex-direction: column;
    gap: 16px;
  }
  .rv-catalog .rv-legacy-item {
    display: flex; gap: 12px; align-items: baseline;
    will-change: transform, opacity;
  }
  .rv-catalog .rv-legacy-mark {
    color: var(--ink-fade);
    font-family: 'Fraunces', serif;
    font-size: 20px;
    font-weight: 600;
    line-height: 1;
    flex-shrink: 0;
  }
  .rv-catalog .rv-legacy-body { position: relative; display: inline-block; }
  .rv-catalog .rv-legacy-text {
    font-family: 'Newsreader', serif;
    font-variation-settings: "opsz" 18;
    font-size: 15.5px;
    line-height: 1.5;
    color: var(--ink-muted);
  }
  .rv-catalog .rv-legacy-strike-svg {
    position: absolute; left: -2%; right: -2%; top: 52%;
    width: 104%; height: 3px;
    color: var(--red);
    overflow: visible;
    pointer-events: none;
  }
  .rv-catalog .rv-reveal-item {
    display: flex; gap: 12px; align-items: baseline;
    will-change: transform, opacity;
  }
  .rv-catalog .rv-reveal-mark {
    color: var(--red);
    font-family: 'Fraunces', serif;
    font-size: 18px;
    font-weight: 700;
    line-height: 1;
    flex-shrink: 0;
  }
  .rv-catalog .rv-reveal-text {
    font-family: 'Newsreader', serif;
    font-variation-settings: "opsz" 18;
    font-size: 15.5px;
    line-height: 1.5;
    color: var(--ink);
  }

  /* ── CTA ──────────────────────────────────────────── */
  .rv-catalog .rv-section-cta {
    padding: 96px 24px 110px;
    text-align: center;
    position: relative;
    overflow: hidden;
  }
  .rv-catalog .rv-cta-inner {
    max-width: 920px;
    text-align: center;
    position: relative;
    z-index: 2;
  }
  .rv-catalog .rv-cta-headline {
    font-size: clamp(2.8rem, 7vw, 6rem);
    line-height: 0.95;
    letter-spacing: -0.03em;
    color: var(--paper-pale);
    font-weight: 600;
    margin: 0 auto 28px;
    max-width: 14ch;
    position: relative;
  }
  .rv-catalog .rv-cta-headline em.rv-emph {
    position: relative;
    display: inline-block;
  }
  .rv-catalog .rv-cta-flourish-svg {
    position: absolute;
    bottom: -0.1em; left: 50%;
    transform: translateX(-50%);
    width: min(540px, 78%);
    height: 22px;
    color: var(--red);
    overflow: visible;
  }
  .rv-catalog .rv-cta-lede {
    font-family: 'Newsreader', serif;
    font-variation-settings: "opsz" 18;
    font-size: clamp(1.05rem, 1.4vw, 1.2rem);
    line-height: 1.5;
    color: var(--paper-deep);
    max-width: 50ch;
    margin: 0 auto 36px;
  }
  .rv-catalog .rv-cta-buttons {
    display: flex; gap: 20px; justify-content: center; align-items: center;
    flex-wrap: wrap;
  }

  /* ── FOOTER ───────────────────────────────────────── */
  .rv-catalog .rv-colophon {
    background: var(--paper);
    border-top: 1.5px solid var(--ink);
    padding: 32px 24px 24px;
    color: var(--ink);
    position: relative;
    z-index: 20;
  }
  .rv-catalog .rv-colophon-top {
    display: flex; align-items: center; gap: 24px;
    padding-bottom: 20px;
    border-bottom: 1px solid var(--ink);
    margin-bottom: 16px;
    flex-wrap: wrap;
  }
  .rv-catalog .rv-colophon-rule {
    flex: 1; height: 1px; background: var(--ink-fade); min-width: 40px;
  }
  .rv-catalog .rv-colophon-meta {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10.5px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--ink-muted);
  }
  .rv-catalog .rv-colophon-bot {
    display: flex; justify-content: space-between; align-items: center;
    gap: 18px;
    flex-wrap: wrap;
  }
  .rv-catalog .rv-colophon-links {
    display: flex; gap: 20px; flex-wrap: wrap;
  }
  .rv-catalog .rv-colophon-link {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10.5px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--ink);
    text-decoration: none;
    transition: color 0.2s ease;
  }
  .rv-catalog .rv-colophon-link:hover { color: var(--red); }
  .rv-catalog .rv-colophon-copy {
    font-family: 'Newsreader', serif;
    font-style: italic;
    font-size: 13px;
    color: var(--ink-muted);
  }

  /* ── DONATION STRIP (footer) ──────────────────────── */
  .rv-catalog .rv-donate {
    display: flex; align-items: center; justify-content: space-between;
    flex-wrap: wrap;
    gap: 16px 24px;
    padding: 22px 0;
    margin: 4px 0 20px;
    border-top: 1px dashed var(--ink-fade);
    border-bottom: 1px dashed var(--ink-fade);
  }
  .rv-catalog .rv-donate-copy {
    display: inline-flex; align-items: baseline; gap: 9px;
    max-width: 42ch;
  }
  .rv-catalog .rv-donate-text {
    font-family: 'Newsreader', serif;
    font-variation-settings: "opsz" 18;
    font-size: 15px;
    line-height: 1.45;
    color: var(--ink-soft);
  }
  .rv-catalog .rv-donate-controls {
    display: inline-flex; align-items: center; gap: 14px;
    flex-wrap: wrap;
  }
  .rv-catalog .rv-donate-presets { display: inline-flex; align-items: center; gap: 8px; }
  .rv-catalog .rv-donate-chip {
    font-family: 'JetBrains Mono', monospace;
    font-size: 12px; font-weight: 600;
    letter-spacing: 0.04em;
    color: var(--ink);
    background: transparent;
    border: 1px solid var(--ink);
    padding: 8px 12px;
    cursor: pointer;
    line-height: 1;
    transition: background 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease, color 0.15s ease;
  }
  .rv-catalog .rv-donate-chip:hover {
    transform: translate(-1px, -1px);
    box-shadow: 3px 3px 0 var(--ink);
  }
  .rv-catalog .rv-donate-chip-on {
    background: var(--ink);
    color: var(--paper-pale);
  }
  .rv-catalog .rv-donate-custom {
    display: inline-flex; align-items: center;
    border: 1px solid var(--ink);
    background: var(--paper-pale);
    padding: 0 10px;
  }
  .rv-catalog .rv-donate-custom-sign {
    font-family: 'JetBrains Mono', monospace;
    font-size: 12px; font-weight: 600;
    color: var(--ink-muted);
  }
  .rv-catalog .rv-donate-custom-input {
    width: 64px;
    border: none; background: transparent; outline: none;
    font-family: 'JetBrains Mono', monospace;
    font-size: 12px; color: var(--ink);
    padding: 8px 4px;
  }
  .rv-catalog .rv-donate-btn {
    display: inline-flex; align-items: center; gap: 8px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 12px; font-weight: 600;
    letter-spacing: 0.10em;
    text-transform: uppercase;
    line-height: 1;
    color: var(--paper-pale);
    background: var(--red);
    border: 1px solid var(--red);
    padding: 11px 18px;
    cursor: pointer;
    box-shadow: 3px 3px 0 var(--ink);
    transition: background 0.2s ease, transform 0.15s ease, box-shadow 0.15s ease;
  }
  .rv-catalog .rv-donate-btn:hover:not(:disabled) {
    background: var(--ink);
    border-color: var(--ink);
    transform: translate(-1px, -1px);
    box-shadow: 4px 4px 0 var(--red);
  }
  .rv-catalog .rv-donate-btn:active:not(:disabled) {
    transform: translate(2px, 2px);
    box-shadow: 1px 1px 0 var(--red);
  }
  .rv-catalog .rv-donate-btn:disabled { opacity: 0.7; cursor: wait; }
  .rv-catalog .rv-donate-error {
    flex-basis: 100%;
    margin: 0;
    font-family: 'Newsreader', serif;
    font-style: italic;
    font-size: 13px;
    color: var(--red);
  }

  /* Return-from-Stripe banner */
  .rv-catalog .rv-donate-banner {
    position: fixed;
    top: 16px; left: 50%;
    transform: translateX(-50%);
    z-index: 80;
    display: inline-flex; align-items: center; gap: 14px;
    padding: 11px 14px 11px 18px;
    background: var(--ink);
    color: var(--paper-pale);
    border: 1px solid var(--ink);
    box-shadow: 4px 4px 0 var(--red);
    font-family: 'JetBrains Mono', monospace;
    font-size: 12px;
    letter-spacing: 0.04em;
    animation: rv-donate-banner-in 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
  }
  .rv-catalog .rv-donate-banner-cancelled { box-shadow: 4px 4px 0 var(--ink-fade); }
  @keyframes rv-donate-banner-in {
    from { opacity: 0; transform: translate(-50%, -12px); }
    to { opacity: 1; transform: translate(-50%, 0); }
  }
  .rv-catalog .rv-donate-banner-close {
    background: transparent; border: none;
    color: var(--paper-deep);
    font-size: 18px; line-height: 1;
    cursor: pointer; padding: 0 2px;
    transition: color 0.2s ease;
  }
  .rv-catalog .rv-donate-banner-close:hover { color: var(--paper-pale); }

  /* ── BUYER DESK (floating widget) ─────────────────── */
  .rv-catalog .rv-desk {
    position: fixed;
    bottom: 22px;
    right: 22px;
    z-index: 90;
    display: flex; flex-direction: column;
    align-items: flex-end;
    gap: 10px;
  }
  .rv-catalog .rv-desk-tab {
    display: inline-flex; align-items: center; gap: 9px;
    padding: 11px 15px;
    background: var(--ink);
    color: var(--paper-pale);
    border: 1px solid var(--ink);
    border-radius: 0;
    cursor: pointer;
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    letter-spacing: 0.10em;
    text-transform: uppercase;
    font-weight: 600;
    box-shadow: 3px 3px 0 var(--red);
    transition: transform 0.15s ease, box-shadow 0.15s ease;
  }
  .rv-catalog .rv-desk-tab:hover {
    transform: translate(-1px, -1px);
    box-shadow: 4px 4px 0 var(--red);
  }
  .rv-catalog .rv-desk-tab-open {
    background: var(--paper-pale);
    color: var(--ink);
    box-shadow: 3px 3px 0 var(--ink);
  }
  .rv-catalog .rv-desk-tab-mark {
    display: inline-flex; align-items: center; justify-content: center;
    color: var(--red);
  }
  .rv-catalog .rv-desk-tab-open .rv-desk-tab-mark { color: var(--ink); }
  .rv-catalog .rv-desk-tab-label {
    line-height: 1;
  }

  .rv-catalog .rv-desk-panel {
    width: min(360px, calc(100vw - 44px));
    background: var(--paper-pale);
    border: 1.5px solid var(--ink);
    padding: 18px 18px 16px;
    box-shadow: 5px 5px 0 var(--ink);
  }
  .rv-catalog .rv-desk-head { display: flex; flex-direction: column; gap: 6px; }
  .rv-catalog .rv-desk-head-inner {
    display: flex; align-items: center; justify-content: space-between;
    gap: 8px;
    margin-bottom: 4px;
  }
  .rv-catalog .rv-desk-status {
    display: inline-flex; align-items: center; gap: 7px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    letter-spacing: 0.10em;
    text-transform: uppercase;
    color: var(--ink-soft);
    font-weight: 600;
  }
  .rv-catalog .rv-desk-status-dot {
    width: 6px; height: 6px;
    background: #2c8c4f;
    border-radius: 50%;
    animation: rv-pulse 2s ease-in-out infinite;
  }
  .rv-catalog .rv-desk-close {
    background: transparent; border: none;
    width: 24px; height: 24px;
    display: inline-flex; align-items: center; justify-content: center;
    font-size: 20px; line-height: 1;
    color: var(--ink); cursor: pointer;
    padding: 0;
  }
  .rv-catalog .rv-desk-close:hover { color: var(--red); }
  .rv-catalog .rv-desk-title {
    font-size: 22px;
    line-height: 1;
    margin: 0;
    color: var(--ink);
    font-weight: 600;
  }
  .rv-catalog .rv-desk-body {
    font-family: 'Newsreader', serif;
    font-variation-settings: "opsz" 16;
    font-size: 14px;
    line-height: 1.5;
    color: var(--ink-soft);
    margin: 8px 0 14px;
  }
  .rv-catalog .rv-desk-form {
    display: flex; flex-direction: column; gap: 10px;
    padding-top: 12px;
    border-top: 1px solid var(--ink);
  }
  .rv-catalog .rv-desk-input {
    background: var(--paper);
    border: 1px solid var(--ink);
    padding: 10px 12px;
    font-family: 'Newsreader', serif;
    font-size: 14px;
    color: var(--ink);
    border-radius: 0;
  }
  .rv-catalog .rv-desk-input:focus {
    outline: 2px solid var(--red); outline-offset: -2px;
  }
  .rv-catalog .rv-desk-sent {
    display: flex; align-items: center; gap: 10px;
    padding: 14px 0 4px;
    font-family: 'Newsreader', serif;
    font-style: italic;
    font-size: 14.5px;
    color: var(--ink);
  }
  .rv-catalog .rv-desk-sent-mark {
    width: 20px; height: 20px;
    background: var(--red);
    color: var(--paper-pale);
    display: inline-flex; align-items: center; justify-content: center;
    font-size: 12px; font-weight: 700;
  }

  /* ── REDUCED MOTION ───────────────────────────────── */
  @media (prefers-reduced-motion: reduce) {
    .rv-catalog .rv-ticker-track,
    .rv-catalog .rv-hero-eyebrow-dot,
    .rv-catalog .rv-desk-status-dot {
      animation: none;
    }
    .rv-catalog .rv-legacy-item,
    .rv-catalog .rv-reveal-item,
    .rv-catalog .rv-step-row,
    .rv-catalog .rv-lot-row,
    .rv-catalog .rv-hero-lot-preview {
      opacity: 1 !important; transform: none !important;
    }
    .rv-catalog .rv-btn:hover { transform: none; }
    .rv-catalog .rv-donate-banner { animation: none; }
    .rv-catalog .rv-donate-chip:hover,
    .rv-catalog .rv-donate-btn:hover { transform: none; }
    /* Drop the sticky stack entirely — normal document flow. */
    .rv-catalog [data-rv-panel] {
      position: static;
      min-height: 0;
      transform: none !important;
      filter: none !important;
    }
  }

  /* ── RESPONSIVE ───────────────────────────────────── */
  @media (max-width: 720px) {
    .rv-catalog .rv-hero { padding: 32px 18px 56px; }
    .rv-catalog .rv-section { padding: 56px 18px 60px; }
    .rv-catalog .rv-section-compact { padding: 48px 18px 52px; }
    .rv-catalog .rv-section-cta { padding: 72px 18px 80px; }
    .rv-catalog .rv-nav-inner { padding: 10px 18px; }
    .rv-catalog .rv-hero-side { padding: 18px 18px 16px; }
    .rv-catalog .rv-manifesto-col { padding: 26px 22px 28px; }
    .rv-catalog .rv-step-row { grid-template-columns: 54px 1fr; gap: 18px; padding: 18px 4px; }
    .rv-catalog .rv-step-num { font-size: 2.4rem; }
    .rv-catalog .rv-desk { bottom: 14px; right: 14px; }
    .rv-catalog .rv-desk-tab { padding: 10px 12px; font-size: 10.5px; }
  }
`;
