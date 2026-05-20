import { useState, useEffect, useRef } from "react";

export default function HomePage({ onGetStarted }: { onGetStarted: () => void }) {
  const [scrolled, setScrolled] = useState(false);
  const [mounted, setMounted] = useState(false);
  const heroVisualRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 60);
    const onScroll = () => setScrolled(window.scrollY > 16);
    window.addEventListener("scroll", onScroll, { passive: true });

    // Mouse parallax on hero visual
    const onMove = (e: MouseEvent) => {
      if (!heroVisualRef.current) return;
      const r = heroVisualRef.current.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      heroVisualRef.current.style.setProperty("--px", String(x));
      heroVisualRef.current.style.setProperty("--py", String(y));
    };
    window.addEventListener("mousemove", onMove);

    return () => {
      clearTimeout(t);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("mousemove", onMove);
    };
  }, []);

  return (
    <div className="min-h-screen overflow-x-hidden relative bg-[var(--paper)] text-[var(--ink)]">
      <style>{STYLES}</style>

      {/* ── NAV — floats over the dark hero, swaps to light glass on scroll ─ */}
      <nav className={`rv-nav fixed top-0 inset-x-0 z-50 ${scrolled ? "rv-nav-scrolled" : "rv-nav-dark"}`}>
        <div className="max-w-[1320px] mx-auto px-6 md:px-10 h-[72px] flex items-center justify-between">
          <Wordmark dark={!scrolled} />
          <div className="hidden lg:flex items-center gap-9 text-[14px]">
            {NAV_LINKS.map(([l, h]) => (
              <a key={h} href={`#${h}`} className="rv-nav-link">{l}</a>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onGetStarted} className="hidden sm:inline-flex rv-nav-login text-[14px] px-3 py-2">Login</button>
            <button onClick={onGetStarted} className="rv-btn rv-btn-primary text-[14px]">
              <span>Get Started</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
            </button>
          </div>
        </div>
      </nav>

      {/* ── HERO — cinematic full-bleed dark ───────────────────────────── */}
      <section
        ref={heroVisualRef}
        className="rv-hero"
        style={{ ["--px" as any]: 0, ["--py" as any]: 0 }}
      >
        {/* Base gradient + showroom glow */}
        <div className="rv-hero-base" aria-hidden />
        <div className="rv-hero-glow" aria-hidden />
        <div className="rv-hero-grid" aria-hidden />

        {/* Concentric ring "showroom" backdrop */}
        <ShowroomDial />

        {/* Hero car image — positioned right, fades into dark on the left */}
        <img
          src="/assets/bg-showroom.png"
          alt=""
          aria-hidden
          className="rv-hero-car"
        />
        {/* Left-side dark mask gradient for text legibility */}
        <div className="rv-hero-mask" aria-hidden />

        {/* Content grid */}
        <div className="rv-hero-content">
          <div className="max-w-[1320px] mx-auto px-6 md:px-10 w-full grid lg:grid-cols-12 gap-10 items-center">

            {/* LEFT — copy */}
            <div className={`lg:col-span-7 fade-up ${mounted ? "in" : ""}`}>
              <AIPill onDark />

              <h1 className="display rv-headline tracking-[-0.035em] leading-[0.92] mt-7 mb-7 text-[clamp(2.7rem,6.8vw,5.6rem)] text-white">
                Find better<br />
                car deals.<br />
                <span className="rv-accent-bright">
                  <span className="italic">Quietly</span> <span className="italic">smarter.</span>
                  <svg className="rv-accent-underline" viewBox="0 0 380 12" fill="none" preserveAspectRatio="none">
                    <path d="M2 8 C 80 2, 180 2, 378 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                </span>
              </h1>

              <p className="text-[16.5px] md:text-[17.5px] leading-[1.6] text-white/72 max-w-[52ch] mb-9">
                Revveal uses AI to scan thousands of listings, analyze true market value, and surface the deals others miss — across every major US city.
              </p>

              <div className="flex flex-wrap items-center gap-3.5">
                <button onClick={onGetStarted} className="rv-btn rv-btn-primary rv-btn-lg group">
                  <span>Find My Next Deal</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-hover:translate-x-0.5"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
                </button>
                <a href="#how" className="rv-btn rv-btn-glass rv-btn-lg group">
                  <span className="rv-play rv-play-dark"><svg width="9" height="11" viewBox="0 0 9 11" fill="currentColor"><path d="M0 0v11l9-5.5z"/></svg></span>
                  <span>See How It Works</span>
                </a>
              </div>
            </div>

            {/* RIGHT — floating UI cards (over the car) */}
            <div className={`lg:col-span-5 fade-up stagger-1 ${mounted ? "in" : ""} rv-hero-right`}>
              <FloatingDealCard />
              <FloatingScoreBadge score={92} />
              <PlateChip />
            </div>
          </div>
        </div>

        {/* Bottom trust strip — over the hero, above the next section */}
        <div className={`rv-hero-trust fade-up stagger-2 ${mounted ? "in" : ""}`}>
          <div className="max-w-[1320px] mx-auto px-6 md:px-10 flex flex-wrap items-center gap-x-8 gap-y-3 text-[12.5px]">
            <span className="flex items-center gap-2 text-white/80">
              <span className="rv-live-dot rv-live-dot-bright" />
              <span className="font-mono text-[10.5px] tracking-[0.2em] uppercase font-medium">Live</span>
              <span className="text-white/55">·</span>
              <span>12,400 listings indexed today</span>
            </span>
            <span className="hidden md:flex items-center gap-2.5 text-white/70">
              <Avatars />
              <span>Trusted by 8,500+ buyers</span>
            </span>
            <span className="hidden lg:flex ml-auto items-center gap-2 text-white/55 font-mono text-[10.5px] tracking-[0.18em] uppercase">
              <span className="w-1 h-1 rounded-full bg-white/40" />
              <span>Buyer's Intelligence · v3.2</span>
            </span>
          </div>
        </div>

        {/* Smooth fade to next light section */}
        <div className="rv-hero-fade" aria-hidden />
      </section>

      {/* ── FEATURE GRID (matches concept's 4 chips) ─────────────── */}
      <section className="relative z-10 px-6 md:px-10 pb-24">
        <div className="max-w-[1280px] mx-auto grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
          {FEATURES.map((f, i) => (
            <FeatureChip key={f.title} feature={f} delay={i * 80} />
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────────── */}
      <section id="how" className="relative z-10 px-6 md:px-10 py-28 md:py-36 bg-[var(--paper-warm)] border-y border-[var(--rule)]">
        <div className="max-w-[1280px] mx-auto">
          <SectionLabel kicker="How It Works" tag="03 steps · zero guesswork" />
          <h2 className="display tracking-[-0.025em] leading-[0.98] text-[clamp(2.2rem,4.8vw,4rem)] max-w-[18ch] mt-6 mb-16">
            From listing to deal in <span className="rv-accent-text italic">three quiet steps</span>.
          </h2>

          <div className="grid md:grid-cols-3 gap-5">
            {STEPS.map((s, i) => (
              <article key={s.title} className="rv-step group">
                <div className="rv-step-num">{String(i + 1).padStart(2, "0")}</div>
                <div className="rv-step-icon">{s.icon}</div>
                <h3 className="display text-[1.4rem] leading-tight tracking-[-0.015em] mb-3 mt-6">{s.title}</h3>
                <p className="text-[15px] leading-[1.6] text-[var(--ink-soft)]">{s.body}</p>
                <div className="rv-step-arrow">→</div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURED DEALS (Live index) ──────────────────────────── */}
      <section id="deals" className="relative z-10 px-6 md:px-10 py-28 md:py-36">
        <div className="max-w-[1280px] mx-auto">
          <div className="flex items-end justify-between flex-wrap gap-6 mb-12">
            <div>
              <SectionLabel kicker="This Week's Index" tag="updated 2m ago" />
              <h2 className="display tracking-[-0.025em] leading-[0.98] text-[clamp(2.2rem,4.8vw,4rem)] max-w-[16ch] mt-6">
                The honest <span className="rv-accent-text italic">deals</span>.
              </h2>
            </div>
            <a href="#" className="rv-link text-[14px] flex items-center gap-2 self-end">
              See the full index
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
            </a>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {FEATURED.map((d, i) => (
              <FeaturedDealCard key={d.title} deal={d} idx={i} />
            ))}
          </div>
        </div>
      </section>

      {/* ── COMPARISON ───────────────────────────────────────────── */}
      <section className="relative z-10 px-6 md:px-10 py-28 md:py-36 bg-[var(--paper-cool)] border-y border-[var(--rule)]">
        <div className="max-w-[1280px] mx-auto">
          <SectionLabel kicker="A Comparison" tag="legacy vs. revveal" />
          <h2 className="display tracking-[-0.025em] leading-[0.98] text-[clamp(2.2rem,4.8vw,4rem)] max-w-[20ch] mt-6 mb-16">
            The way it's always worked.{" "}
            <span className="rv-accent-text italic">And the way it should.</span>
          </h2>

          <div className="grid md:grid-cols-2 rounded-[20px] overflow-hidden border border-[var(--rule)] bg-[var(--paper)] shadow-soft">
            <div className="p-9 md:p-12 border-b md:border-b-0 md:border-r border-[var(--rule)]">
              <div className="flex items-center gap-3 mb-8">
                <span className="rv-tag rv-tag-muted">Legacy listing sites</span>
                <span className="h-px flex-1 bg-[var(--rule)]" />
              </div>
              <ul className="space-y-5">
                {LEGACY.map(t => (
                  <li key={t} className="flex gap-4 items-start text-[15px] text-[var(--ink-muted)]">
                    <span className="rv-x">×</span>
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="p-9 md:p-12 bg-gradient-to-br from-[var(--paper)] to-[var(--blue-tint)]">
              <div className="flex items-center gap-3 mb-8">
                <span className="rv-tag rv-tag-blue">The Revveal way</span>
                <span className="h-px flex-1 bg-[var(--blue)]/30" />
              </div>
              <ul className="space-y-5">
                {REVVEAL_WAY.map(t => (
                  <li key={t} className="flex gap-4 items-start text-[15px] text-[var(--ink)]">
                    <span className="rv-check"><svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M2 6.5 L5 9 L10 3" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg></span>
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────── */}
      <section className="relative z-10 px-6 md:px-10 py-32 md:py-40 overflow-hidden">
        <div className="rv-cta-glow" />
        <div className="max-w-[1080px] mx-auto text-center relative">
          <SectionLabel kicker="Start Now" tag="free · no card" center />
          <h2 className="display tracking-[-0.03em] leading-[0.95] text-[clamp(2.8rem,7vw,6rem)] mt-6 mb-10">
            Stop overpaying.<br />
            Start <span className="rv-accent-text italic">Revvealing</span>.
          </h2>
          <p className="text-[17px] text-[var(--ink-soft)] max-w-[48ch] mx-auto mb-12">
            Free forever for buyers. The smartest car-finding model on the internet — and we'll show you the math.
          </p>
          <div className="flex flex-wrap justify-center items-center gap-4">
            <button onClick={onGetStarted} className="rv-btn rv-btn-primary rv-btn-xl group">
              <span>Find My Next Deal</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-hover:translate-x-0.5"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
            </button>
            <a href="#how" className="rv-btn rv-btn-ghost rv-btn-xl">See how it works</a>
          </div>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────── */}
      <footer className="relative z-10 border-t border-[var(--rule)] px-6 md:px-10 py-12 bg-[var(--paper)]">
        <div className="max-w-[1280px] mx-auto flex flex-wrap items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <Wordmark />
            <span className="hidden md:inline font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--ink-muted)]">
              Buyer's Intelligence · v3.2 · 2026
            </span>
          </div>
          <div className="flex items-center gap-7 text-[13px] text-[var(--ink-muted)]">
            {["Privacy", "Terms", "Press", "GitHub"].map(l => (
              <a key={l} href="#" className="rv-link">{l}</a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ── BRAND ────────────────────────────────────────────────────── */

function Wordmark({ dark = false }: { dark?: boolean }) {
  return (
    <a href="#" className="flex items-center gap-2.5 group">
      <img
        src="/assets/revveal-icon.png"
        alt=""
        aria-hidden
        className="w-8 h-8 rounded-[8px] shadow-[0_4px_18px_rgba(31,95,255,0.35)] transition-transform duration-300 group-hover:rotate-[-4deg]"
      />
      <span className={`display text-[1.45rem] leading-none tracking-[-0.02em] font-semibold ${dark ? "text-white" : "text-[var(--ink)]"}`}>
        Revveal
      </span>
    </a>
  );
}

function AIPill({ onDark = false }: { onDark?: boolean }) {
  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full ${onDark ? "bg-white/10 border border-white/15 text-white backdrop-blur-md" : "bg-[var(--blue-tint)] border border-[var(--blue)]/15 text-[var(--blue-deep)]"}`}>
      <span className="rv-sparkle">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0l2.39 8.61L23 11l-8.61 2.39L12 22l-2.39-8.61L1 11l8.61-2.39z"/></svg>
      </span>
      <span className="font-mono text-[11px] uppercase tracking-[0.18em] font-medium">AI-Powered Deal Discovery</span>
    </div>
  );
}

function PlateChip() {
  return (
    <div className="rv-plate-chip-floating">
      <span className="rv-plate-dot" />
      <span>AUSTIN · TX</span>
      <span className="rv-plate-dot" />
    </div>
  );
}

function Avatars() {
  return (
    <div className="flex items-center -space-x-1.5">
      {AVATAR_COLORS.map((c, i) => (
        <span
          key={i}
          className="w-5 h-5 rounded-full border-2 border-[var(--paper)]"
          style={{ background: c }}
        />
      ))}
    </div>
  );
}

function SectionLabel({ kicker, tag, center = false }: { kicker: string; tag: string; center?: boolean }) {
  return (
    <div className={`flex items-center gap-3 ${center ? "justify-center" : ""}`}>
      <span className="rv-tag rv-tag-blue">{kicker}</span>
      <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--ink-muted)]">{tag}</span>
    </div>
  );
}

/* ── HERO VISUAL ─────────────────────────────────────────────── */

function ShowroomDial() {
  return (
    <svg
      className="rv-showroom-dial"
      viewBox="0 0 700 700"
      fill="none"
      aria-hidden
    >
      {[330, 280, 230, 180, 130].map((r, i) => (
        <circle
          key={r}
          cx="350"
          cy="350"
          r={r}
          stroke="rgba(125,170,255,0.18)"
          strokeWidth={i === 0 ? "1.2" : "0.8"}
          strokeDasharray={i % 2 === 0 ? "0" : "2 6"}
        />
      ))}
      {Array.from({ length: 72 }).map((_, i) => {
        const a = (i / 72) * Math.PI * 2 - Math.PI / 2;
        const x1 = 350 + Math.cos(a) * 330;
        const y1 = 350 + Math.sin(a) * 330;
        const x2 = 350 + Math.cos(a) * (i % 6 === 0 ? 312 : 322);
        const y2 = 350 + Math.sin(a) * (i % 6 === 0 ? 312 : 322);
        return (
          <line
            key={i}
            x1={x1} y1={y1} x2={x2} y2={y2}
            stroke="rgba(125,170,255,0.32)"
            strokeWidth={i % 6 === 0 ? "1.1" : "0.5"}
          />
        );
      })}
    </svg>
  );
}

function FloatingDealCard() {
  return (
    <article className="rv-deal-card">
      <header className="flex items-center justify-between mb-3">
        <span className="rv-tag rv-tag-green">
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 6.5 L5 9 L10 3" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Great Deal
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--ink-muted)]">№ 0247</span>
      </header>

      <h3 className="display text-[1.15rem] leading-tight tracking-[-0.015em] mb-3.5 text-[var(--ink)]">2021 BMW 3 Series 330i</h3>

      <dl className="space-y-2 text-[13px]">
        <div className="flex items-center justify-between">
          <dt className="text-[var(--ink-muted)]">Listed Price</dt>
          <dd className="font-mono font-medium text-[var(--ink)]">$24,990</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-[var(--ink-muted)]">Est. Market</dt>
          <dd className="font-mono font-medium text-[var(--ink)]">$28,700</dd>
        </div>
        <div className="flex items-center justify-between pt-2 border-t border-dashed border-[var(--rule)]">
          <dt className="text-[var(--ink-muted)]">You save</dt>
          <dd className="font-mono font-semibold text-[var(--green)]">−$3,710 · 12.9%</dd>
        </div>
      </dl>

      <div className="mt-4 pt-3 border-t border-[var(--rule)] flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--ink-muted)]">Smart Deal Score</span>
        <span className="display text-[1.4rem] leading-none text-[var(--blue)] font-semibold">92<span className="text-[10px] text-[var(--ink-muted)] font-normal ml-0.5">/100</span></span>
      </div>
    </article>
  );
}

function FloatingScoreBadge({ score }: { score: number }) {
  const r = 36;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <div className="rv-score-badge">
      <svg viewBox="0 0 88 88" className="absolute inset-0">
        <defs>
          <linearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#7da8ff" />
            <stop offset="100%" stopColor="#1f5fff" />
          </linearGradient>
        </defs>
        <circle cx="44" cy="44" r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="5" />
        <circle
          cx="44" cy="44" r={r}
          fill="none"
          stroke="url(#scoreGrad)"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          transform="rotate(-90 44 44)"
          className="rv-score-fill"
        />
      </svg>
      <div className="relative text-center">
        <div className="display text-[2rem] leading-none font-semibold text-white">{score}</div>
        <div className="font-mono text-[8.5px] uppercase tracking-[0.22em] text-white/55 mt-1">Score</div>
      </div>
    </div>
  );
}

/* ── FEATURE CHIPS ───────────────────────────────────────────── */

function FeatureChip({ feature, delay }: { feature: typeof FEATURES[0]; delay: number }) {
  return (
    <div
      className="rv-feature group"
      style={{ animationDelay: `${300 + delay}ms` }}
    >
      <div className="rv-feature-icon">{feature.icon}</div>
      <h3 className="font-semibold text-[15px] tracking-[-0.005em] mt-5 mb-1.5">{feature.title}</h3>
      <p className="text-[13.5px] leading-[1.55] text-[var(--ink-muted)]">{feature.body}</p>
    </div>
  );
}

/* ── FEATURED DEAL CARDS (live index) ────────────────────────── */

function FeaturedDealCard({ deal, idx }: { deal: typeof FEATURED[0]; idx: number }) {
  return (
    <a href="#" className="rv-listing group">
      <div className="rv-listing-img" style={{ background: deal.tone }}>
        {/* car silhouette */}
        <svg viewBox="0 0 240 100" className="absolute inset-0 w-full h-full p-7 transition-transform duration-500 group-hover:scale-105">
          <path
            d="M 20,75 Q 25,55 50,55 L 75,40 Q 85,32 100,32 L 165,32 Q 180,32 195,45 L 215,55 Q 220,57 220,75 L 220,80 L 200,80 Q 195,90 185,90 Q 175,90 170,80 L 70,80 Q 65,90 55,90 Q 45,90 40,80 L 20,80 Z"
            fill="rgba(10,21,48,0.85)"
          />
          <circle cx="55" cy="80" r="10" fill="rgba(10,21,48,0.9)" />
          <circle cx="55" cy="80" r="4" fill={deal.tone} />
          <circle cx="185" cy="80" r="10" fill="rgba(10,21,48,0.9)" />
          <circle cx="185" cy="80" r="4" fill={deal.tone} />
        </svg>
        <span className="absolute top-3 left-3 rv-tag rv-tag-white">№ {String(idx + 1).padStart(2, "0")}</span>
        <span className="absolute top-3 right-3 rv-tag rv-tag-ink">{deal.score}/100</span>
      </div>
      <div className="p-5">
        <div className="flex items-center justify-between mb-1.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--ink-muted)]">{deal.source}</span>
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--green)]">{deal.label}</span>
        </div>
        <h3 className="display text-[1.2rem] leading-tight tracking-[-0.015em] mb-1">{deal.title}</h3>
        <p className="text-[12.5px] text-[var(--ink-muted)] mb-4">{deal.location} · {deal.miles}</p>
        <div className="flex items-baseline gap-3">
          <span className="display text-[1.45rem] tracking-[-0.015em] font-semibold">{deal.price}</span>
          <span className="text-[12px] text-[var(--ink-muted)] font-mono line-through">{deal.fair}</span>
          <span className="ml-auto font-mono text-[12px] font-semibold text-[var(--green)]">{deal.delta}</span>
        </div>
      </div>
    </a>
  );
}

/* ── DATA ───────────────────────────────────────────────────── */

const NAV_LINKS: [string, string][] = [
  ["How It Works", "how"],
  ["Features", "features"],
  ["Deals", "deals"],
  ["Pricing", "pricing"],
];

const AVATAR_COLORS = ["#1f5fff", "#3b82f6", "#0a1530", "#4d7fff", "#7c9eff"];

const FEATURES = [
  {
    title: "AI Price Insight",
    body: "Our AI analyzes year, trim, mileage, region, and condition to reveal each car's true fair value.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3v18h18" />
        <path d="M7 14l4-4 4 4 6-6" />
        <circle cx="7" cy="14" r="1.5" fill="currentColor" />
        <circle cx="11" cy="10" r="1.5" fill="currentColor" />
        <circle cx="15" cy="14" r="1.5" fill="currentColor" />
      </svg>
    ),
  },
  {
    title: "Real-time Scanning",
    body: "Marketplace, classifieds, dealers — refreshed continuously so listings never go cold.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="7" />
        <path d="M21 21l-4.3-4.3" />
        <path d="M11 8v3l2 1.5" />
      </svg>
    ),
  },
  {
    title: "Verified Listings",
    body: "Duplicates removed, fake listings flagged. Every car is sourced from accuracy-tested feeds.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2l8 3v6.5c0 4.5-3.4 8.5-8 10-4.6-1.5-8-5.5-8-10V5l8-3z" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    ),
  },
  {
    title: "Smart Deal Score",
    body: "Each car gets a 0–100 score with the math shown: comps, deltas, confidence. No black box.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
        <path d="M12 3v1.5M21 12h-1.5M12 21v-1.5M3 12h1.5" />
      </svg>
    ),
  },
];

const STEPS = [
  {
    title: "Aggregate every honest source",
    body: "Marketplace, classifieds, dealer feeds, auction houses — every listing in every major US market, refreshed in real time, deduplicated and normalized.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V7" />
        <path d="M3 7l9 6 9-6" />
        <path d="M3 7l4-3h10l4 3" />
      </svg>
    ),
  },
  {
    title: "Score against 50k+ comparables",
    body: "Year, trim, mileage, region, condition, days-on-market. Our model returns a fair value with a confidence interval, and shows the comps it used.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 21V10M9 21V4M15 21v-8M21 21V7" />
      </svg>
    ),
  },
  {
    title: "Move before the listing's gone",
    body: "Truly undervalued cars sell in hours. Save searches, set drop alerts — Revveal puts the next great deal in your hands first.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 2L3 14h7l-1 8 10-12h-7z" />
      </svg>
    ),
  },
];

const FEATURED = [
  { title: "2019 Honda Civic EX", location: "Austin, TX", miles: "45,210 mi", price: "$12,400", fair: "$15,600", delta: "−20.5%", score: 87, source: "Classifieds", label: "Great deal", tone: "#e2ecff" },
  { title: "2020 Subaru Forester", location: "Denver, CO", miles: "38,902 mi", price: "$18,900", fair: "$22,400", delta: "−15.6%", score: 81, source: "Marketplace", label: "Great deal", tone: "#dbe7ff" },
  { title: "2018 Toyota Camry SE", location: "Phoenix, AZ", miles: "62,450 mi", price: "$11,250", fair: "$14,820", delta: "−24.1%", score: 91, source: "Classifieds", label: "Excellent", tone: "#cfdcff" },
];

const LEGACY = [
  "Dealers pay to rank higher in your results.",
  "A green badge with no explanation of why.",
  "Private sellers and Marketplace listings ignored.",
  "Pages clogged with promotional inventory.",
];

const REVVEAL_WAY = [
  "Pure algorithmic ranking. No pay-to-play. Ever.",
  "A score with the math shown — comps, deltas, confidence.",
  "Marketplace, classifieds, dealers — one honest feed.",
  "Built for buyers. Not for the inventory page.",
];

/* ── STYLES ─────────────────────────────────────────────────── */

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=Geist:wght@300..700&family=JetBrains+Mono:wght@400;500;600;700&display=swap');

  :root {
    --paper: #ffffff;
    --paper-warm: #f7f9fc;
    --paper-cool: #eef2f9;
    --blue-tint: #ebf1ff;
    --ink: #0a1530;
    --ink-soft: #475574;
    --ink-muted: #8392ad;
    --rule: #e3e9f3;
    --rule-strong: #cfd8e6;
    --blue: #1f5fff;
    --blue-deep: #1648c4;
    --blue-soft: #4d7fff;
    --green: #16a34a;
    --green-soft: #d9f4e7;
  }

  html, body, #root { font-family: 'Geist', system-ui, sans-serif; }
  body { background: var(--paper); color: var(--ink); -webkit-font-smoothing: antialiased; }

  .display {
    font-family: 'Bricolage Grotesque', serif;
    font-variation-settings: "wdth" 100, "opsz" 96;
    font-weight: 600;
  }

  /* Nav — floats; theme adapts to scroll position */
  .rv-nav { transition: all 0.35s ease; background: transparent; }
  .rv-nav-dark {
    background: rgba(6, 12, 30, 0.38);
    backdrop-filter: blur(14px) saturate(140%);
    -webkit-backdrop-filter: blur(14px) saturate(140%);
    border-bottom: 1px solid rgba(255,255,255,0.06);
  }
  .rv-nav-scrolled {
    background: rgba(255,255,255,0.88);
    backdrop-filter: blur(16px) saturate(160%);
    -webkit-backdrop-filter: blur(16px) saturate(160%);
    border-bottom: 1px solid var(--rule);
    box-shadow: 0 6px 28px rgba(10,21,48,0.06);
  }
  .rv-nav-link {
    position: relative;
    transition: color 0.2s;
  }
  .rv-nav-dark .rv-nav-link { color: rgba(255,255,255,0.78); }
  .rv-nav-dark .rv-nav-link:hover { color: white; }
  .rv-nav-scrolled .rv-nav-link { color: var(--ink-soft); }
  .rv-nav-scrolled .rv-nav-link:hover { color: var(--ink); }
  .rv-nav-link::after {
    content: ""; position: absolute; left: 0; right: 0; bottom: -6px;
    height: 2px; background: currentColor; transform: scaleX(0); transform-origin: left;
    transition: transform 0.3s cubic-bezier(.2,.8,.2,1);
    border-radius: 2px;
    opacity: 0.7;
  }
  .rv-nav-link:hover::after { transform: scaleX(1); }
  .rv-nav-login { transition: color 0.2s; }
  .rv-nav-dark .rv-nav-login { color: rgba(255,255,255,0.85); }
  .rv-nav-dark .rv-nav-login:hover { color: white; }
  .rv-nav-scrolled .rv-nav-login { color: var(--ink-soft); }
  .rv-nav-scrolled .rv-nav-login:hover { color: var(--ink); }

  /* Buttons */
  .rv-btn {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 10px 18px; border-radius: 999px;
    font-weight: 500; line-height: 1;
    transition: all 0.2s ease;
    white-space: nowrap;
  }
  .rv-btn-lg { padding: 14px 24px; gap: 10px; font-size: 15px; }
  .rv-btn-xl { padding: 18px 32px; gap: 12px; font-size: 16px; }

  .rv-btn-primary {
    background: var(--blue); color: white;
    box-shadow: 0 4px 14px rgba(31,95,255,0.30), inset 0 1px 0 rgba(255,255,255,0.18);
  }
  .rv-btn-primary:hover {
    background: var(--blue-deep);
    box-shadow: 0 8px 22px rgba(31,95,255,0.42), inset 0 1px 0 rgba(255,255,255,0.18);
    transform: translateY(-1px);
  }

  .rv-btn-ghost {
    background: white; color: var(--ink);
    border: 1px solid var(--rule-strong);
  }
  .rv-btn-ghost:hover {
    border-color: var(--ink);
    background: var(--paper-warm);
  }

  /* Glass ghost for dark hero */
  .rv-btn-glass {
    background: rgba(255,255,255,0.08);
    color: white;
    border: 1px solid rgba(255,255,255,0.18);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
  }
  .rv-btn-glass:hover {
    background: rgba(255,255,255,0.14);
    border-color: rgba(255,255,255,0.30);
    transform: translateY(-1px);
  }

  .rv-link { color: var(--ink-soft); transition: color 0.15s; position: relative; }
  .rv-link:hover { color: var(--ink); }

  .rv-play {
    display: inline-flex; align-items: center; justify-content: center;
    width: 22px; height: 22px; border-radius: 50%;
    background: var(--blue-tint); color: var(--blue);
    margin-left: -4px;
  }
  .rv-play-dark {
    background: rgba(255,255,255,0.18);
    color: white;
    box-shadow: 0 0 0 1px rgba(255,255,255,0.12);
  }

  /* AI pill sparkle pulse */
  .rv-sparkle {
    display: inline-flex; align-items: center; justify-content: center;
    width: 18px; height: 18px; border-radius: 50%;
    background: white; color: var(--blue);
    box-shadow: 0 2px 6px rgba(31,95,255,0.25);
    animation: sparklePulse 2.4s ease-in-out infinite;
  }
  @keyframes sparklePulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.08); }
  }

  /* Tags */
  .rv-tag {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 5px 10px; border-radius: 999px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 10.5px; font-weight: 500;
    letter-spacing: 0.06em; text-transform: uppercase;
    line-height: 1;
  }
  .rv-tag-blue { background: var(--blue-tint); color: var(--blue-deep); }
  .rv-tag-green { background: var(--green-soft); color: var(--green); }
  .rv-tag-muted { background: #f1f3f8; color: var(--ink-muted); }
  .rv-tag-white { background: rgba(255,255,255,0.92); color: var(--ink); backdrop-filter: blur(4px); }
  .rv-tag-ink { background: var(--ink); color: white; }

  /* Live dots */
  .rv-live-dot {
    width: 7px; height: 7px; border-radius: 50%;
    background: var(--blue);
    box-shadow: 0 0 0 0 rgba(31,95,255,0.6);
    animation: liveBeat 1.6s ease-in-out infinite;
    display: inline-block;
  }
  .rv-live-dot-green {
    background: var(--green);
    box-shadow: 0 0 0 0 rgba(22,163,74,0.6);
    animation: liveBeatGreen 1.6s ease-in-out infinite;
  }
  .rv-live-dot-bright {
    background: #7dffb1;
    box-shadow: 0 0 0 0 rgba(125,255,177,0.55);
    animation: liveBeatBright 1.6s ease-in-out infinite;
  }
  @keyframes liveBeat {
    0%, 100% { box-shadow: 0 0 0 0 rgba(31,95,255,0.55); }
    50% { box-shadow: 0 0 0 6px rgba(31,95,255,0); }
  }
  @keyframes liveBeatGreen {
    0%, 100% { box-shadow: 0 0 0 0 rgba(22,163,74,0.55); }
    50% { box-shadow: 0 0 0 6px rgba(22,163,74,0); }
  }
  @keyframes liveBeatBright {
    0%, 100% { box-shadow: 0 0 0 0 rgba(125,255,177,0.55); }
    50% { box-shadow: 0 0 0 6px rgba(125,255,177,0); }
  }

  /* Hero accent (the "Quietly smarter." treatment) */
  .rv-accent { position: relative; display: inline-block; color: var(--blue); }
  .rv-accent-bright { position: relative; display: inline-block; color: #7da8ff; }
  .rv-accent-text { color: var(--blue); }
  .rv-accent-underline {
    position: absolute; left: 2%; right: 0; bottom: -0.04em;
    width: 96%; height: 0.18em; color: currentColor;
    stroke-dasharray: 600;
    stroke-dashoffset: 600;
    animation: drawLine 1.4s ease-out 0.6s forwards;
    opacity: 0.7;
  }
  @keyframes drawLine { to { stroke-dashoffset: 0; }}

  /* Headline glow for the cinematic hero */
  .rv-headline {
    text-shadow: 0 1px 30px rgba(0,0,0,0.35);
  }

  /* Fade-up mount */
  .fade-up { opacity: 0; transform: translateY(18px); transition: opacity 0.9s ease, transform 0.9s ease; }
  .fade-up.in { opacity: 1; transform: translateY(0); }
  .stagger-1 { transition-delay: 0.18s; }
  .stagger-2 { transition-delay: 0.32s; }

  /* ── CINEMATIC HERO ─────────────────────────────────────── */

  .rv-hero {
    position: relative;
    min-height: 100vh;
    overflow: hidden;
    background: #040814;
    color: white;
    isolation: isolate;
  }

  /* Layered background — deep navy base */
  .rv-hero-base {
    position: absolute; inset: 0;
    background:
      radial-gradient(120% 80% at 50% 0%, #0a1838 0%, #060e22 45%, #04081a 100%);
    z-index: 0;
  }

  /* Cyan/blue radial showroom glow positioned where the car sits */
  .rv-hero-glow {
    position: absolute; inset: 0;
    background:
      radial-gradient(55% 50% at 72% 55%, rgba(58, 122, 255, 0.35) 0%, rgba(31, 95, 255, 0.16) 35%, transparent 70%),
      radial-gradient(35% 30% at 78% 75%, rgba(120, 170, 255, 0.18) 0%, transparent 60%);
    z-index: 1;
    pointer-events: none;
  }

  /* Subtle floor grid */
  .rv-hero-grid {
    position: absolute; inset: 0;
    background-image:
      linear-gradient(rgba(125,170,255,0.07) 1px, transparent 1px),
      linear-gradient(90deg, rgba(125,170,255,0.07) 1px, transparent 1px);
    background-size: 80px 80px;
    background-position: -1px -1px;
    mask-image: radial-gradient(ellipse 100% 70% at 70% 60%, black 0%, transparent 75%);
    -webkit-mask-image: radial-gradient(ellipse 100% 70% at 70% 60%, black 0%, transparent 75%);
    z-index: 1;
    pointer-events: none;
  }

  /* Concentric "showroom" rings — behind car */
  .rv-showroom-dial {
    position: absolute;
    top: 50%; right: 5%;
    width: 820px; height: 820px;
    transform: translateY(-50%);
    z-index: 1;
    pointer-events: none;
    animation: dialFadeSpin 90s linear infinite;
    transform-origin: 50% 50%;
    opacity: 0.85;
  }
  @keyframes dialFadeSpin {
    from { transform: translateY(-50%) rotate(0); }
    to   { transform: translateY(-50%) rotate(360deg); }
  }

  /* The car photo — fills right portion of the hero, fades left into dark */
  .rv-hero-car {
    position: absolute;
    top: 50%; right: -5%;
    height: 95%;
    width: auto;
    max-width: 75%;
    min-width: 760px;
    transform:
      translate(calc(var(--px, 0) * -14px), calc(-50% + (var(--py, 0) * -10px)))
      scale(1.02);
    transition: transform 0.6s cubic-bezier(.2,.8,.2,1);
    object-fit: contain;
    filter: drop-shadow(0 60px 80px rgba(0,0,0,0.55)) saturate(1.08) contrast(1.06) brightness(1.02);
    z-index: 2;
    pointer-events: none;
    will-change: transform;
    animation: carFloat 8s ease-in-out infinite;
  }
  @keyframes carFloat {
    0%, 100% { translate: 0 0; }
    50%      { translate: 0 -8px; }
  }

  /* Left-side gradient mask — makes the headline legible */
  .rv-hero-mask {
    position: absolute; inset: 0;
    background:
      linear-gradient(90deg,
        rgba(4,8,20,0.96) 0%,
        rgba(4,8,20,0.86) 22%,
        rgba(4,8,20,0.52) 42%,
        rgba(4,8,20,0.18) 58%,
        transparent 75%),
      linear-gradient(180deg, rgba(4,8,20,0.30) 0%, transparent 18%, transparent 70%, rgba(4,8,20,0.65) 100%);
    z-index: 3;
    pointer-events: none;
  }

  .rv-hero-content {
    position: relative;
    z-index: 4;
    min-height: 100vh;
    padding-top: 140px;
    padding-bottom: 160px;
    display: flex;
    align-items: center;
  }

  /* Right column for floating cards — relative anchor for absolute children */
  .rv-hero-right {
    position: relative;
    min-height: clamp(360px, 50vh, 540px);
    perspective: 1400px;
  }

  /* Bottom trust strip */
  .rv-hero-trust {
    position: absolute;
    bottom: 32px;
    left: 0; right: 0;
    z-index: 5;
    pointer-events: none;
  }
  .rv-hero-trust > div { pointer-events: auto; }

  /* Smooth fade into next light section */
  .rv-hero-fade {
    position: absolute;
    bottom: 0; left: 0; right: 0;
    height: 140px;
    background: linear-gradient(180deg, transparent 0%, rgba(247,249,252,0.65) 60%, var(--paper) 100%);
    z-index: 6;
    pointer-events: none;
  }

  /* Floating Deal Card — top-right over car */
  .rv-deal-card {
    position: absolute;
    top: -10px;
    right: -8px;
    width: clamp(260px, 24vw, 310px);
    background: rgba(255,255,255,0.97);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border-radius: 16px;
    padding: 18px 20px;
    box-shadow:
      0 30px 60px -16px rgba(0,0,0,0.45),
      0 10px 24px -8px rgba(31,95,255,0.22),
      inset 0 0 0 1px rgba(255,255,255,0.5);
    transform:
      translate(calc(var(--px, 0) * 10px), calc(var(--py, 0) * 8px));
    transition: transform 0.5s cubic-bezier(.2,.8,.2,1);
    animation: cardFloat 7s ease-in-out infinite;
    z-index: 5;
  }
  @keyframes cardFloat {
    0%, 100% { translate: 0 0; }
    50%      { translate: 0 -8px; }
  }

  /* Floating Score Badge — circular glass */
  .rv-score-badge {
    position: absolute;
    bottom: -12px;
    right: 14%;
    width: 96px; height: 96px;
    border-radius: 50%;
    background: rgba(10, 21, 48, 0.70);
    backdrop-filter: blur(20px) saturate(160%);
    -webkit-backdrop-filter: blur(20px) saturate(160%);
    border: 1px solid rgba(125,170,255,0.32);
    box-shadow:
      0 24px 50px -10px rgba(31,95,255,0.55),
      0 6px 16px rgba(0,0,0,0.45),
      inset 0 1px 0 rgba(255,255,255,0.16);
    display: flex; align-items: center; justify-content: center;
    transform:
      translate(calc(var(--px, 0) * -8px), calc(var(--py, 0) * -6px));
    transition: transform 0.5s cubic-bezier(.2,.8,.2,1);
    z-index: 5;
    animation: badgeFloat 8s ease-in-out infinite 0.6s;
  }
  @keyframes badgeFloat {
    0%, 100% { translate: 0 0; }
    50%      { translate: 0 6px; }
  }
  .rv-score-fill {
    stroke-dasharray: 0 999;
    animation: scoreFill 1.8s ease-out 0.8s forwards;
  }
  @keyframes scoreFill {
    to { stroke-dasharray: var(--final-dash, 226) 999; }
  }

  /* AUSTIN · TX floating plate */
  .rv-plate-chip-floating {
    position: absolute;
    bottom: 14%;
    right: -2%;
    display: inline-flex; align-items: center; gap: 8px;
    padding: 7px 13px; border-radius: 6px;
    background: rgba(10, 21, 48, 0.65);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    border: 1px solid rgba(125,170,255,0.22);
    font-family: 'JetBrains Mono', monospace;
    font-size: 10.5px; font-weight: 600;
    letter-spacing: 0.18em; text-transform: uppercase;
    color: rgba(255,255,255,0.92);
    box-shadow: 0 8px 20px rgba(0,0,0,0.35);
    z-index: 5;
    transform: translate(calc(var(--px, 0) * 6px), calc(var(--py, 0) * 4px));
    transition: transform 0.5s cubic-bezier(.2,.8,.2,1);
  }
  .rv-plate-dot {
    width: 4px; height: 4px; border-radius: 50%;
    background: rgba(255,255,255,0.55);
  }

  /* Tweaks to the deal-card tag for the new context */
  .rv-tag-green {
    background: var(--green-soft);
    color: #0f7a3a;
    padding: 5px 9px 5px 8px;
  }

  /* Tablet / mobile ── responsive hero */
  @media (max-width: 1024px) {
    .rv-hero-content { padding-top: 124px; padding-bottom: 180px; }
    .rv-hero-mask {
      background:
        linear-gradient(180deg, rgba(4,8,20,0.55) 0%, rgba(4,8,20,0.78) 55%, rgba(4,8,20,0.92) 100%),
        linear-gradient(90deg, rgba(4,8,20,0.65) 0%, transparent 60%);
    }
    .rv-hero-car {
      top: auto; bottom: 14%;
      right: -8%;
      height: 50%;
      min-width: 540px;
      transform: translate(0, 0);
      animation: none;
      opacity: 0.85;
    }
    .rv-showroom-dial {
      top: auto; bottom: 0; right: -10%;
      width: 560px; height: 560px;
      transform: none;
    }
    .rv-hero-right {
      min-height: 240px;
      margin-top: 28px;
    }
    .rv-deal-card {
      position: relative;
      top: auto; right: auto;
      width: 100%; max-width: 360px;
      margin-left: auto;
    }
    .rv-score-badge { right: 4%; bottom: -8px; width: 84px; height: 84px; }
    .rv-plate-chip-floating { bottom: -36px; right: auto; left: 0; }
  }
  @media (max-width: 640px) {
    .rv-hero-car { min-width: 460px; bottom: 18%; opacity: 0.7; }
    .rv-deal-card { padding: 14px 16px; }
    .rv-score-badge { width: 76px; height: 76px; right: 2%; }
    .rv-hero-trust { bottom: 18px; }
  }

  /* ── FEATURE CHIPS ──────────────────────────────────────── */

  .rv-feature {
    background: white;
    border: 1px solid var(--rule);
    border-radius: 16px;
    padding: 22px 22px 24px;
    transition: all 0.3s cubic-bezier(.2,.8,.2,1);
    opacity: 0;
    transform: translateY(14px);
    animation: featureIn 0.7s ease-out forwards;
  }
  @keyframes featureIn { to { opacity: 1; transform: translateY(0); } }

  .rv-feature:hover {
    transform: translateY(-4px);
    border-color: var(--blue);
    box-shadow:
      0 14px 30px -10px rgba(31,95,255,0.22),
      0 4px 10px rgba(10,21,48,0.04);
  }
  .rv-feature-icon {
    width: 38px; height: 38px;
    border-radius: 10px;
    background: var(--blue-tint);
    color: var(--blue);
    display: flex; align-items: center; justify-content: center;
    transition: background 0.3s, color 0.3s, transform 0.3s;
  }
  .rv-feature:hover .rv-feature-icon {
    background: var(--blue);
    color: white;
    transform: rotate(-6deg) scale(1.05);
  }

  /* ── STEPS ──────────────────────────────────────────────── */

  .rv-step {
    position: relative;
    background: white;
    border: 1px solid var(--rule);
    border-radius: 18px;
    padding: 28px 28px 30px;
    overflow: hidden;
    transition: all 0.3s cubic-bezier(.2,.8,.2,1);
  }
  .rv-step:hover {
    transform: translateY(-3px);
    border-color: var(--blue-soft);
    box-shadow: 0 12px 32px -12px rgba(31,95,255,0.18);
  }
  .rv-step-num {
    position: absolute;
    top: 14px; right: 18px;
    font-family: 'Bricolage Grotesque', serif;
    font-variation-settings: "wdth" 100, "opsz" 96;
    font-size: 5.5rem; line-height: 0.9;
    color: var(--paper-cool);
    font-weight: 700;
    user-select: none;
    transition: color 0.3s;
  }
  .rv-step:hover .rv-step-num { color: var(--blue-tint); }
  .rv-step-icon {
    position: relative;
    width: 46px; height: 46px;
    border-radius: 12px;
    background: var(--blue);
    color: white;
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 6px 14px rgba(31,95,255,0.30);
  }
  .rv-step-arrow {
    position: absolute;
    bottom: 22px; right: 22px;
    font-size: 1.2rem;
    color: var(--blue);
    opacity: 0;
    transform: translateX(-4px);
    transition: all 0.3s;
  }
  .rv-step:hover .rv-step-arrow { opacity: 1; transform: translateX(0); }

  /* ── LISTING CARDS ──────────────────────────────────────── */

  .rv-listing {
    display: block;
    background: white;
    border: 1px solid var(--rule);
    border-radius: 18px;
    overflow: hidden;
    transition: all 0.35s cubic-bezier(.2,.8,.2,1);
  }
  .rv-listing:hover {
    transform: translateY(-5px);
    border-color: var(--blue);
    box-shadow: 0 18px 38px -14px rgba(31,95,255,0.22), 0 4px 10px rgba(10,21,48,0.06);
  }
  .rv-listing-img {
    aspect-ratio: 4/3;
    position: relative;
    overflow: hidden;
  }

  /* ── COMPARISON ─────────────────────────────────────────── */

  .rv-x {
    flex-shrink: 0;
    display: inline-flex; align-items: center; justify-content: center;
    width: 22px; height: 22px; border-radius: 50%;
    background: #f1f3f8; color: var(--ink-muted);
    font-weight: 600; font-size: 13px;
    margin-top: 1px;
  }
  .rv-check {
    flex-shrink: 0;
    display: inline-flex; align-items: center; justify-content: center;
    width: 22px; height: 22px; border-radius: 50%;
    background: var(--blue); color: white;
    margin-top: 1px;
    box-shadow: 0 2px 6px rgba(31,95,255,0.30);
  }

  /* Soft shadow utility */
  .shadow-soft {
    box-shadow: 0 10px 40px -10px rgba(10,21,48,0.10), 0 4px 14px rgba(10,21,48,0.04);
  }

  /* CTA radial glow */
  .rv-cta-glow {
    position: absolute; inset: 0;
    background:
      radial-gradient(ellipse 60% 50% at 50% 100%, rgba(31,95,255,0.18) 0%, transparent 70%),
      radial-gradient(ellipse 80% 40% at 50% 0%, rgba(31,95,255,0.08) 0%, transparent 60%);
    pointer-events: none;
  }
`;
