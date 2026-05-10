import { useState, useEffect, useRef } from "react";

export default function HomePage({ onGetStarted }: { onGetStarted: () => void }) {
  const [scrolled, setScrolled] = useState(false);
  const [mounted, setMounted] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);
  const stackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 60);
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });

    const onMove = (e: MouseEvent) => {
      if (!heroRef.current || !stackRef.current) return;
      const r = heroRef.current.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      stackRef.current.style.setProperty("--mx", String(x));
      stackRef.current.style.setProperty("--my", String(y));
    };
    window.addEventListener("mousemove", onMove);

    return () => {
      clearTimeout(t);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("mousemove", onMove);
    };
  }, []);

  return (
    <div className="min-h-screen overflow-x-hidden relative" style={{
      background: "var(--bone)", color: "var(--ink)", fontFamily: "'DM Sans', sans-serif",
    }}>
      <style>{STYLES}</style>

      {/* Grain overlay (page-wide) */}
      <div className="grain pointer-events-none fixed inset-0 z-[1]" />

      {/* ── NAV ─────────────────────────────────────────────────── */}
      <nav className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${scrolled ? "border-b border-[var(--rule)] bg-[var(--bone)]/92 backdrop-blur" : ""}`}>
        <div className="px-6 md:px-10 py-4 flex items-center justify-between">
          <Wordmark />
          <div className="hidden md:flex items-center gap-9 text-[13px] text-[var(--ink-soft)]">
            {[["The Method", "method"], ["Index", "index"], ["For Dealers", "dealers"]].map(([l, h]) => (
              <a key={h} href={`#${h}`} className="link-line">{l}</a>
            ))}
          </div>
          <div className="flex items-center gap-5">
            <button onClick={onGetStarted} className="text-[13px] text-[var(--ink-soft)] link-line">Sign in</button>
            <button onClick={onGetStarted} className="btn-primary">Get started</button>
          </div>
        </div>
      </nav>

      {/* ── LIVE TICKER ─────────────────────────────────────────── */}
      <div className="ticker-bar mt-[68px] border-y border-[var(--rule-strong)] bg-[var(--ink)] text-[var(--bone)] py-2.5 overflow-hidden relative z-10">
        <div className="flex items-center gap-2 px-6 md:px-10 mb-1.5">
          <span className="font-mono text-[10px] tracking-[0.25em] uppercase opacity-60">Form 01</span>
          <span className="opacity-30">/</span>
          <span className="font-mono text-[10px] tracking-[0.25em] uppercase opacity-60">Live Intelligence</span>
          <span className="ml-auto live-dot w-1.5 h-1.5 rounded-full bg-[var(--red)]" />
        </div>
        <div className="ticker-track flex gap-12 whitespace-nowrap font-mono text-[13px]">
          {[...TICKER, ...TICKER].map((t, i) => (
            <span key={i} className="flex items-center gap-2 shrink-0">
              <span className="opacity-50">{t.tag}</span>
              <span>{t.label}</span>
              <span className={t.dir === "down" ? "text-[var(--red-light)]" : "opacity-70"}>{t.delta}</span>
            </span>
          ))}
        </div>
      </div>

      {/* ── HERO ────────────────────────────────────────────────── */}
      <section
        ref={heroRef}
        className="relative px-6 md:px-10 pt-24 md:pt-28 pb-32 z-10 overflow-hidden"
      >
        {/* Background gauge */}
        <BackgroundGauge />

        {/* Soft warm glow */}
        <div className="absolute top-[20%] right-[15%] w-[420px] h-[420px] rounded-full opacity-50 pointer-events-none -z-[1]"
          style={{ background: "radial-gradient(circle, rgba(196,30,58,0.10) 0%, transparent 70%)" }} />

        <div className="relative max-w-[1280px] mx-auto grid lg:grid-cols-12 gap-12 lg:gap-16">

          {/* LEFT — Editorial headline */}
          <div className={`lg:col-span-7 fade-in ${mounted ? "in" : ""}`}>
            <div className="flex items-baseline gap-3 mb-10">
              <span className="font-mono text-[11px] tracking-[0.2em] uppercase text-[var(--ink-muted)]">§ 01</span>
              <span className="h-px flex-1 max-w-[80px] bg-[var(--rule-strong)] translate-y-[-3px]" />
              <span className="font-mono text-[11px] tracking-[0.2em] uppercase text-[var(--ink-soft)]">The Question</span>
            </div>

            <h1 className="display tracking-[-0.025em] leading-[0.86] mb-12 hero-headline">
              <span className="block text-[clamp(3.5rem,9vw,8.5rem)]">What's it</span>
              <span className="block italic text-[clamp(3.5rem,9vw,8.5rem)] text-[var(--red)] -mt-1 wonk-on">actually</span>
              <span className="block text-[clamp(3.5rem,9vw,8.5rem)]">worth?</span>
            </h1>

            <div className="grid md:grid-cols-12 gap-6 mb-14">
              <div className="md:col-span-1 hidden md:block">
                <div className="display text-3xl text-[var(--red)] leading-none">¶</div>
              </div>
              <p className="md:col-span-7 text-[1.15rem] leading-[1.55] text-[var(--ink-soft)]">
                Stop guessing. Stop trusting the sticker. The fair price exists in the data — we just had to build a model honest enough to find it.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-8">
              <button onClick={onGetStarted} className="btn-primary-lg group">
                <span>Find your deal</span>
                <span className="inline-block transition-transform group-hover:translate-x-1">→</span>
              </button>
              <a href="#method" className="text-[14px] text-[var(--ink-soft)] link-line flex items-center gap-2">
                Read the method <span className="text-[var(--red)]">↓</span>
              </a>
            </div>

            <div className="mt-20 flex items-center gap-4 text-[11px] font-mono uppercase tracking-[0.18em] text-[var(--ink-muted)]">
              <span>Vol. III</span>
              <span className="opacity-30">/</span>
              <span>Issue 02</span>
              <span className="opacity-30">/</span>
              <span>Buyer's Index</span>
              <span className="opacity-30">/</span>
              <span>2026</span>
            </div>
          </div>

          {/* RIGHT — Stacked Deal Reports with parallax */}
          <div className={`lg:col-span-5 fade-in stagger-1 ${mounted ? "in" : ""}`}>
            <div ref={stackRef} className="report-stack relative" style={{ ["--mx" as any]: 0, ["--my" as any]: 0 }}>
              {/* Back card */}
              <div className="report-card report-back absolute inset-0">
                <DealReport variant="back" />
              </div>
              {/* Middle card */}
              <div className="report-card report-middle absolute inset-0">
                <DealReport variant="middle" />
              </div>
              {/* Front card */}
              <div className="report-card report-front relative">
                <DealReport variant="front" />
              </div>

              {/* Floating stamp — savings */}
              <div className="absolute -left-6 -bottom-6 hidden md:block stamp-savings">
                <SavingsStamp />
              </div>

              {/* Floating badge — model */}
              <div className="absolute -right-3 top-8 hidden md:block stamp-model">
                <ModelBadge />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── BRAND MARQUEE ──────────────────────────────────────── */}
      <section className="relative z-10 border-y border-[var(--rule-strong)] bg-[var(--paper)] py-10 overflow-hidden">
        <div className="marquee-line">
          <div className="marquee-track display italic text-[clamp(3rem,7vw,6rem)] leading-none whitespace-nowrap">
            {[...BRANDS, ...BRANDS].map((b, i) => (
              <span key={i} className="inline-flex items-center mr-12">
                <span className="tracking-tight">{b}</span>
                <span className="ml-12 w-2 h-2 bg-[var(--red)] inline-block" />
              </span>
            ))}
          </div>
        </div>
        <div className="marquee-line mt-2">
          <div className="marquee-track-reverse display text-[clamp(2rem,4vw,3.5rem)] leading-none whitespace-nowrap text-[var(--ink-muted)]">
            {[...SUB_BRANDS, ...SUB_BRANDS].map((b, i) => (
              <span key={i} className="inline-flex items-center mr-10">
                <span className="font-mono text-[0.45em] mr-3 opacity-60">№</span>
                <span className="tracking-tight">{b}</span>
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── BIG STAT BAND ──────────────────────────────────────── */}
      <section className="relative z-10 border-b border-[var(--rule-strong)] bg-[var(--bone)]">
        <div className="max-w-[1280px] mx-auto px-6 md:px-10 py-16 grid grid-cols-2 md:grid-cols-4 gap-y-10 gap-x-6">
          {STATS.map((s, i) => (
            <div key={s.lbl} className="flex flex-col">
              <span className="display text-[clamp(2.5rem,5vw,4rem)] leading-none tracking-tight">
                {s.num}
                {i === 1 && <span className="text-[var(--red)]">.</span>}
              </span>
              <span className="mt-3 text-[11px] font-mono uppercase tracking-[0.18em] text-[var(--ink-muted)]">{s.lbl}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURED DEALS GRID ─────────────────────────────────── */}
      <section id="index" className="relative z-10 px-6 md:px-10 py-32">
        <div className="max-w-[1280px] mx-auto">
          <div className="flex items-baseline justify-between mb-16 flex-wrap gap-6">
            <div>
              <div className="flex items-baseline gap-3 mb-6">
                <span className="font-mono text-[11px] tracking-[0.2em] uppercase text-[var(--ink-muted)]">§ 02</span>
                <span className="h-px w-20 bg-[var(--rule-strong)] translate-y-[-3px]" />
                <span className="font-mono text-[11px] tracking-[0.2em] uppercase text-[var(--ink-soft)]">This Week's Index</span>
              </div>
              <h2 className="display text-[clamp(2.5rem,5vw,4.5rem)] leading-[0.95] tracking-[-0.02em] max-w-[14ch]">
                The <span className="italic text-[var(--red)]">honest</span> deals.
              </h2>
            </div>
            <a href="#" className="text-[14px] text-[var(--ink-soft)] link-line flex items-center gap-2 self-end">
              Open the full index <span className="text-[var(--red)]">→</span>
            </a>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {FEATURED.map((d, i) => (
              <FeaturedCard key={d.title} deal={d} idx={i} />
            ))}
          </div>
        </div>
      </section>

      {/* ── EDITORIAL CALLOUT ───────────────────────────────────── */}
      <section className="relative z-10 px-6 md:px-10 py-28 bg-[var(--ink)] text-[var(--bone)] overflow-hidden">
        <div className="absolute -left-20 top-0 display text-[24rem] leading-none text-[var(--red)] opacity-15 select-none pointer-events-none">"</div>
        <div className="max-w-[1280px] mx-auto grid md:grid-cols-12 gap-8 items-start relative">
          <div className="md:col-span-9 md:col-start-3">
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] opacity-60">A statement</span>
            <blockquote className="display text-[clamp(1.7rem,3.5vw,3rem)] leading-[1.2] tracking-tight mt-6 max-w-[24ch]">
              The legacy listing sites sell <span className="italic">visibility</span> to dealers.
              <br />
              We sell <span className="italic text-[var(--red-light)]">truth</span> to buyers.
            </blockquote>
            <div className="mt-8 flex items-center gap-3">
              <span className="w-12 h-px bg-[var(--bone)]/40" />
              <span className="font-mono text-[10px] uppercase tracking-[0.22em] opacity-60">Revveal — Founding Note</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── THE METHOD ─────────────────────────────────────────── */}
      <section id="method" className="relative z-10 px-6 md:px-10 py-32">
        <div className="max-w-[1280px] mx-auto">
          <div className="flex items-baseline gap-3 mb-16">
            <span className="font-mono text-[11px] tracking-[0.2em] uppercase text-[var(--ink-muted)]">§ 03</span>
            <span className="h-px flex-1 max-w-[80px] bg-[var(--rule-strong)] translate-y-[-3px]" />
            <span className="font-mono text-[11px] tracking-[0.2em] uppercase text-[var(--ink-soft)]">The Method</span>
          </div>

          <h2 className="display tracking-[-0.02em] leading-[0.92] mb-20 max-w-[18ch] text-[clamp(2.5rem,5.5vw,5rem)]">
            Three steps. <span className="italic text-[var(--red)]">Zero</span> guesswork.
          </h2>

          <div className="grid md:grid-cols-3 gap-px bg-[var(--rule-strong)] border-y border-[var(--rule-strong)]">
            {STEPS.map((s, i) => (
              <article key={s.title} className="bg-[var(--bone)] p-10 md:p-12 group hover:bg-[var(--paper)] transition-colors duration-300 relative overflow-hidden">
                <div className="absolute -right-4 -top-2 display text-[12rem] leading-none text-[var(--rule)] select-none pointer-events-none transition-colors duration-300 group-hover:text-[var(--red)]/20">
                  {i + 1}
                </div>
                <div className="relative">
                  <div className="flex items-start justify-between mb-12">
                    <span className="display text-[5rem] leading-none text-[var(--red)] tracking-tighter italic">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--ink-muted)] mt-3">
                      Step {i + 1}/3
                    </span>
                  </div>
                  <h3 className="display text-[1.65rem] leading-[1.1] mb-4 tracking-tight">{s.title}</h3>
                  <p className="text-[15px] text-[var(--ink-soft)] leading-[1.6]">{s.body}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── COMPARISON ─────────────────────────────────────────── */}
      <section className="relative z-10 px-6 md:px-10 py-32 bg-[var(--paper)] border-y border-[var(--rule-strong)]">
        <div className="max-w-[1280px] mx-auto">
          <div className="flex items-baseline gap-3 mb-16">
            <span className="font-mono text-[11px] tracking-[0.2em] uppercase text-[var(--ink-muted)]">§ 04</span>
            <span className="h-px flex-1 max-w-[80px] bg-[var(--rule-strong)] translate-y-[-3px]" />
            <span className="font-mono text-[11px] tracking-[0.2em] uppercase text-[var(--ink-soft)]">A Comparison</span>
          </div>

          <h2 className="display tracking-[-0.02em] leading-[0.92] mb-20 max-w-[20ch] text-[clamp(2.5rem,5vw,4.5rem)]">
            The way it's <span className="italic">always</span> worked.<br />
            <span className="text-[var(--red)]">And the way it should.</span>
          </h2>

          <div className="grid md:grid-cols-2 border border-[var(--rule-strong)]">
            <div className="p-10 md:p-14 border-b md:border-b-0 md:border-r border-[var(--rule-strong)] bg-[var(--bone)]">
              <div className="flex items-center gap-3 mb-10">
                <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--ink-muted)]">The legacy way</span>
                <span className="h-px flex-1 bg-[var(--rule)]" />
              </div>
              <ul className="space-y-7">
                {[
                  "Dealers pay to rank higher in your results.",
                  "A green badge with no explanation of why.",
                  "Private sellers and Marketplace listings ignored.",
                  "Pages clogged with promotional inventory.",
                ].map(t => (
                  <li key={t} className="flex gap-4 items-start text-[15px] text-[var(--ink-muted)]">
                    <span className="font-mono text-[10px] uppercase tracking-widest mt-1.5 shrink-0">no</span>
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="p-10 md:p-14 bg-[var(--bone)]">
              <div className="flex items-center gap-3 mb-10">
                <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--red)]">The Revveal way</span>
                <span className="h-px flex-1 bg-[var(--red)]/40" />
              </div>
              <ul className="space-y-7">
                {[
                  "Pure algorithmic ranking. No pay-to-play. Ever.",
                  "A score with the math shown — comps, deltas, confidence.",
                  "Marketplace, classifieds, dealers — one honest feed.",
                  "Built for buyers. Not for the inventory page.",
                ].map(t => (
                  <li key={t} className="flex gap-4 items-start text-[15px] text-[var(--ink)]">
                    <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--red)] mt-1.5 shrink-0">yes</span>
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────────────── */}
      <section className="relative z-10 px-6 md:px-10 py-36 text-center overflow-hidden">
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse 60% 50% at 50% 100%, rgba(196,30,58,0.08) 0%, transparent 70%)" }} />
        <div className="absolute left-1/2 -translate-x-1/2 top-12 display text-[20rem] leading-none text-[var(--rule)] select-none pointer-events-none italic">§</div>
        <div className="max-w-[1280px] mx-auto relative">
          <div className="flex items-center justify-center gap-3 mb-10">
            <span className="font-mono text-[11px] tracking-[0.2em] uppercase text-[var(--red)]">§ 05 — Coda</span>
          </div>
          <h2 className="display tracking-[-0.025em] leading-[0.86] mb-12 text-[clamp(3.5rem,8vw,8rem)]">
            Stop overpaying.<br />
            Start <span className="italic text-[var(--red)]">Revvealing.</span>
          </h2>
          <button onClick={onGetStarted} className="btn-primary-xl group">
            <span>Find your first deal</span>
            <span className="inline-block transition-transform group-hover:translate-x-1">→</span>
          </button>
          <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--ink-muted)]">
            Free · No card · No upsell
          </p>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────── */}
      <footer className="relative z-10 border-t border-[var(--rule-strong)] px-6 md:px-10 py-12 bg-[var(--ink)] text-[var(--bone)]">
        <div className="max-w-[1280px] mx-auto flex flex-wrap items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            <a href="#" className="flex items-baseline gap-1">
              <span className="display text-[1.4rem] leading-none tracking-tight text-[var(--bone)]">Revveal</span>
              <span className="w-[7px] h-[7px] bg-[var(--red)] inline-block translate-y-[-2px]" />
            </a>
            <span className="hidden md:inline font-mono text-[11px] uppercase tracking-[0.2em] opacity-60">
              Buyer's Index · Vol. III · 2026
            </span>
          </div>
          <div className="flex items-center gap-7 text-[12px] opacity-70">
            {["Privacy", "Terms", "Press", "GitHub"].map(l => (
              <a key={l} href="#" className="link-line">{l}</a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ── BACKGROUND GAUGE (atmospheric) ───────────────────────── */

function BackgroundGauge() {
  return (
    <svg
      className="absolute right-[-8%] top-[-2%] w-[680px] h-[680px] opacity-[0.06] pointer-events-none gauge-spin -z-[1]"
      viewBox="0 0 400 400"
      fill="none"
      stroke="currentColor"
    >
      <circle cx="200" cy="200" r="190" strokeWidth="1" />
      <circle cx="200" cy="200" r="160" strokeWidth="1" />
      <circle cx="200" cy="200" r="120" strokeWidth="0.5" strokeDasharray="2 6" />
      {Array.from({ length: 60 }).map((_, i) => {
        const a = (i / 60) * Math.PI * 2 - Math.PI / 2;
        const x1 = 200 + Math.cos(a) * 180;
        const y1 = 200 + Math.sin(a) * 180;
        const x2 = 200 + Math.cos(a) * (i % 5 === 0 ? 165 : 172);
        const y2 = 200 + Math.sin(a) * (i % 5 === 0 ? 165 : 172);
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth={i % 5 === 0 ? 1.5 : 0.5} />;
      })}
      <line x1="200" y1="200" x2="320" y2="120" stroke="var(--red)" strokeWidth="2" />
      <circle cx="200" cy="200" r="6" fill="var(--red)" stroke="none" />
    </svg>
  );
}

/* ── DEAL REPORT CENTERPIECE ──────────────────────────────── */

function DealReport({ variant = "front" }: { variant?: "front" | "middle" | "back" }) {
  const isBack = variant !== "front";
  return (
    <article className={`bg-[var(--paper)] border border-[var(--rule-strong)] p-7 md:p-9 relative ${isBack ? "" : "shadow-warm"}`}>
      <div className="flex items-start justify-between mb-1">
        <span className="font-mono text-[10px] uppercase tracking-[0.22em]">Deal Report</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--ink-muted)]">№ 0247</span>
      </div>
      <div className="border-b-2 border-[var(--ink)] mb-7" />

      <h3 className="display text-[1.7rem] leading-tight tracking-tight">2019 Honda Civic EX</h3>
      <p className="text-[13px] text-[var(--ink-muted)] mt-1 mb-7">Austin, TX · 45,210 mi · Sedan · Automatic</p>

      <div className="border-t border-dashed border-[var(--rule-strong)]/40 mb-6" />

      <dl className="space-y-3.5 font-mono text-[13px]">
        <Row label="Listed price" value="$12,400" />
        <Row label="Fair value" value="$15,600" />
        <Row label="Differential" value="−$3,200 (20.5%)" accent />
        <Row label="Comparables (90d)" value="127" />
        <Row label="Source" value="Classifieds" />
        <Row label="Days listed" value="8" />
      </dl>

      <div className="border-t border-dashed border-[var(--rule-strong)]/40 my-7" />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-5">
          <ScoreGauge score={87} />
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--ink-muted)] mb-1">Verdict</p>
            <p className="display text-[1.6rem] leading-none tracking-tight">Great deal</p>
          </div>
        </div>
        <div className="border-2 border-[var(--red)] px-3 py-1.5 -rotate-3 stamp">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--red)] font-bold">Approved</p>
        </div>
      </div>

      <div className="border-t border-dashed border-[var(--rule-strong)]/40 mt-7 pt-4 flex items-center justify-between">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--ink-muted)]">Revveal Model v3.2</p>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--ink-muted)]">Generated 2m ago</p>
      </div>
    </article>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="text-[var(--ink-muted)]">{label}</span>
      <span className="flex-1 border-b border-dotted border-[var(--rule-strong)]/30 translate-y-[-4px]" />
      <span className={accent ? "font-bold text-[var(--red)]" : "text-[var(--ink)]"}>{value}</span>
    </div>
  );
}

function ScoreGauge({ score }: { score: number }) {
  const r = 26;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <div className="relative w-16 h-16 flex items-center justify-center">
      <svg viewBox="0 0 64 64" className="absolute inset-0 -rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" stroke="var(--rule)" strokeWidth="4" />
        <circle cx="32" cy="32" r={r} fill="none" stroke="var(--red)" strokeWidth="4" strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`} className="gauge-fill" />
      </svg>
      <div className="text-center">
        <div className="display text-[1.4rem] leading-none">{score}</div>
        <div className="font-mono text-[8px] text-[var(--ink-muted)] tracking-widest -mt-0.5">/100</div>
      </div>
    </div>
  );
}

/* ── FLOATING STAMPS ──────────────────────────────────────── */

function SavingsStamp() {
  return (
    <div className="w-32 h-32 rounded-full border-2 border-[var(--ink)] bg-[var(--bone)] flex flex-col items-center justify-center -rotate-12 stamp shadow-warm relative">
      <svg className="absolute inset-0 stamp-rotate" viewBox="0 0 100 100">
        <defs>
          <path id="circ" d="M 50,50 m -38,0 a 38,38 0 1,1 76,0 a 38,38 0 1,1 -76,0" />
        </defs>
        <text className="font-mono" fontSize="6" letterSpacing="2" fill="var(--ink-muted)">
          <textPath href="#circ">REVVEAL · MODEL · v3.2 · VERIFIED · </textPath>
        </text>
      </svg>
      <span className="display text-[1.6rem] leading-none italic text-[var(--red)]">save</span>
      <span className="display text-[1.8rem] leading-none font-bold mt-0.5">$3,200</span>
    </div>
  );
}

function ModelBadge() {
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-[var(--ink)] text-[var(--bone)] rotate-3 shadow-warm">
      <span className="live-dot w-1.5 h-1.5 rounded-full bg-[var(--red)]" />
      <span className="font-mono text-[10px] uppercase tracking-[0.22em]">Live · Model v3.2</span>
    </div>
  );
}

/* ── FEATURED DEAL CARDS ──────────────────────────────────── */

function FeaturedCard({ deal, idx }: { deal: typeof FEATURED[0]; idx: number }) {
  return (
    <a href="#" className="card-hover group bg-[var(--bone)] border border-[var(--rule-strong)] block relative overflow-hidden">
      {/* Color block "image" */}
      <div className="aspect-[4/3] relative overflow-hidden" style={{ background: deal.tone }}>
        <div className="absolute inset-0 mix-blend-multiply opacity-40"
          style={{ background: "radial-gradient(circle at 30% 30%, transparent, rgba(0,0,0,0.3))" }} />

        {/* SVG car silhouette */}
        <svg viewBox="0 0 240 100" className="absolute inset-0 w-full h-full p-8 transition-transform duration-700 group-hover:scale-105">
          <path
            d="M 20,75 Q 25,55 50,55 L 75,40 Q 85,32 100,32 L 165,32 Q 180,32 195,45 L 215,55 Q 220,57 220,75 L 220,80 L 200,80 Q 195,90 185,90 Q 175,90 170,80 L 70,80 Q 65,90 55,90 Q 45,90 40,80 L 20,80 Z"
            fill="var(--ink)" opacity="0.85"
          />
          <circle cx="55" cy="80" r="10" fill="var(--ink)" />
          <circle cx="55" cy="80" r="4" fill={deal.tone} />
          <circle cx="185" cy="80" r="10" fill="var(--ink)" />
          <circle cx="185" cy="80" r="4" fill={deal.tone} />
        </svg>

        {/* Index number */}
        <div className="absolute top-4 left-4 font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--ink)]/70">
          № {String(idx + 1).padStart(2, "0")}
        </div>
        {/* Score chip */}
        <div className="absolute top-4 right-4 bg-[var(--ink)] text-[var(--bone)] px-2.5 py-1 font-mono text-[11px] tracking-widest">
          {deal.score}/100
        </div>
      </div>

      <div className="p-6">
        <div className="flex items-baseline justify-between mb-1.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--ink-muted)]">{deal.source}</span>
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--red)]">{deal.label}</span>
        </div>
        <h3 className="display text-[1.45rem] leading-tight tracking-tight mb-1">{deal.title}</h3>
        <p className="text-[13px] text-[var(--ink-muted)] mb-5">{deal.location} · {deal.miles}</p>

        <div className="flex items-baseline gap-3">
          <span className="display text-[1.7rem] tracking-tight">{deal.price}</span>
          <span className="text-[12px] text-[var(--ink-muted)] font-mono line-through">{deal.fair}</span>
          <span className="ml-auto font-mono text-[12px] font-bold text-[var(--red)]">{deal.delta}</span>
        </div>
      </div>

      <div className="border-t border-[var(--rule-strong)] px-6 py-3 flex items-center justify-between text-[12px] font-mono uppercase tracking-[0.18em]">
        <span className="text-[var(--ink-muted)]">View report</span>
        <span className="text-[var(--red)] transition-transform group-hover:translate-x-1">→</span>
      </div>
    </a>
  );
}

/* ── BRAND MARK ────────────────────────────────────────────── */

function Wordmark() {
  return (
    <a href="#" className="flex items-baseline gap-1 group">
      <span className="display text-[1.4rem] leading-none tracking-[-0.02em]">Revveal</span>
      <span className="w-[7px] h-[7px] bg-[var(--red)] inline-block translate-y-[-2px]" />
    </a>
  );
}

/* ── DATA ──────────────────────────────────────────────────── */

const TICKER = [
  { tag: "AUSTIN/TX", label: "2019 CIVIC EX", delta: "↓20.5%", dir: "down" },
  { tag: "DALLAS/TX", label: "2020 RAV4 LE", delta: "↓18.2%", dir: "down" },
  { tag: "PHOENIX/AZ", label: "2018 CAMRY SE", delta: "↓24.1%", dir: "down" },
  { tag: "DENVER/CO", label: "2021 CR-V EX-L", delta: "↑3.8%", dir: "up" },
  { tag: "ATLANTA/GA", label: "2017 ALTIMA SR", delta: "↓31.4%", dir: "down" },
  { tag: "SEATTLE/WA", label: "2022 MAZDA3", delta: "↓12.6%", dir: "down" },
  { tag: "MIAMI/FL", label: "2019 ACCORD SPORT", delta: "↓15.9%", dir: "down" },
  { tag: "CHICAGO/IL", label: "2020 FORESTER", delta: "↓9.2%", dir: "down" },
];

const BRANDS = ["Honda", "Toyota", "Subaru", "Mazda", "Ford", "Hyundai", "Kia", "Nissan"];
const SUB_BRANDS = ["Civic", "RAV4", "Forester", "CX-5", "F-150", "Sonata", "Telluride", "Altima"];

const STATS = [
  { num: "12,400", lbl: "listings analyzed today" },
  { num: "$3,200", lbl: "average savings per deal" },
  { num: "94%", lbl: "model accuracy rate" },
  { num: "15+", lbl: "sources aggregated" },
];

const STEPS = [
  {
    title: "Aggregate every honest source.",
    body: "Marketplace, classifieds, dealer feeds, auction houses. Every listing in every major US market — refreshed in real time, deduplicated, normalized.",
  },
  {
    title: "Score against 50,000+ comparables.",
    body: "Year, trim, mileage, region, condition, days-on-market. Our model returns a fair value with a confidence interval — and shows the comparables it used.",
  },
  {
    title: "Move before the listing's gone.",
    body: "The truly undervalued cars sell in hours. Save searches, set price-drop alerts, and Revveal puts the next great deal in your hands first.",
  },
];

const FEATURED = [
  {
    title: "2019 Honda Civic EX",
    location: "Austin, TX",
    miles: "45,210 mi",
    price: "$12,400",
    fair: "$15,600",
    delta: "−20.5%",
    score: 87,
    source: "Classifieds",
    label: "Great deal",
    tone: "#dccba8",
  },
  {
    title: "2020 Subaru Forester",
    location: "Denver, CO",
    miles: "38,902 mi",
    price: "$18,900",
    fair: "$22,400",
    delta: "−15.6%",
    score: 81,
    source: "Marketplace",
    label: "Great deal",
    tone: "#9caf94",
  },
  {
    title: "2018 Toyota Camry SE",
    location: "Phoenix, AZ",
    miles: "62,450 mi",
    price: "$11,250",
    fair: "$14,820",
    delta: "−24.1%",
    score: 91,
    source: "Classifieds",
    label: "Excellent",
    tone: "#c4938a",
  },
];

/* ── STYLES ───────────────────────────────────────────────── */

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght,SOFT,WONK@0,9..144,400..800,0..100,0..1;1,9..144,400..800,0..100,0..1&family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap');

  :root {
    --bone: #efe9dd;
    --paper: #f7f1e3;
    --ink: #131310;
    --ink-soft: #3a3a36;
    --ink-muted: #7a756c;
    --rule: #ddd6c7;
    --rule-strong: #131310;
    --red: #c41e3a;
    --red-deep: #a01a30;
    --red-light: #e85a73;
  }

  .display {
    font-family: 'Fraunces', serif;
    font-weight: 500;
    font-variation-settings: "WONK" 1, "SOFT" 30, "opsz" 144;
  }
  .display.italic, .wonk-on { font-style: italic; font-variation-settings: "WONK" 1, "SOFT" 50, "opsz" 144; }

  /* Grain texture */
  .grain {
    background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.55 0'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.4'/></svg>");
    opacity: 0.045;
    mix-blend-mode: multiply;
  }

  /* Buttons */
  .btn-primary { background: var(--ink); color: var(--bone); padding: 10px 18px; font-size: 13px; font-weight: 500; border-radius: 999px; transition: background 0.15s ease; }
  .btn-primary:hover { background: var(--red); }

  .btn-primary-lg {
    display: inline-flex; align-items: center; gap: 14px;
    background: var(--ink); color: var(--bone);
    padding: 16px 28px; font-size: 15px; font-weight: 500;
    border-radius: 999px; transition: background 0.2s ease, gap 0.2s ease, box-shadow 0.3s ease;
    box-shadow: 0 8px 24px rgba(19,19,16,0.15);
  }
  .btn-primary-lg:hover { background: var(--red); gap: 18px; box-shadow: 0 12px 32px rgba(196,30,58,0.3); }

  .btn-primary-xl {
    display: inline-flex; align-items: center; gap: 16px;
    background: var(--ink); color: var(--bone);
    padding: 22px 40px; font-size: 18px; font-weight: 500;
    border-radius: 999px; transition: background 0.2s ease, gap 0.2s ease, box-shadow 0.3s ease;
    box-shadow: 0 12px 32px rgba(19,19,16,0.18);
  }
  .btn-primary-xl:hover { background: var(--red); gap: 22px; box-shadow: 0 16px 48px rgba(196,30,58,0.32); }

  /* Underline animation */
  .link-line { position: relative; transition: color 0.15s; }
  .link-line:hover { color: var(--ink); }
  .link-line::after {
    content: ""; position: absolute; left: 0; right: 0; bottom: -3px;
    height: 1px; background: currentColor; transform: scaleX(0); transform-origin: left;
    transition: transform 0.3s cubic-bezier(.2,.8,.2,1);
  }
  .link-line:hover::after { transform: scaleX(1); }

  /* Live ticker */
  .ticker-track { animation: tickerScroll 50s linear infinite; will-change: transform; }
  .ticker-bar:hover .ticker-track { animation-play-state: paused; }
  @keyframes tickerScroll { from { transform: translateX(0);} to { transform: translateX(-50%);} }

  /* Brand marquee */
  .marquee-line { overflow: hidden; }
  .marquee-track { animation: marquee 40s linear infinite; }
  .marquee-track-reverse { animation: marquee-reverse 50s linear infinite; }
  @keyframes marquee { from { transform: translateX(0);} to { transform: translateX(-50%);} }
  @keyframes marquee-reverse { from { transform: translateX(-50%);} to { transform: translateX(0);} }

  /* Live dot */
  .live-dot { animation: livePulse 1.4s ease-in-out infinite; box-shadow: 0 0 0 0 rgba(196, 30, 58, 0.7); }
  @keyframes livePulse {
    0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(196,30,58,0.6); }
    50% { opacity: 0.5; box-shadow: 0 0 0 6px rgba(196,30,58,0); }
  }

  /* Background gauge spin */
  .gauge-spin { animation: spinSlow 60s linear infinite; transform-origin: 50% 50%; color: var(--ink); }
  @keyframes spinSlow { to { transform: rotate(360deg); }}

  /* Gauge fill animation */
  .gauge-fill { animation: gaugeFill 1.6s ease-out 0.4s both; }
  @keyframes gaugeFill { from { stroke-dasharray: 0 999; }}

  /* Stamp rotation */
  .stamp-rotate { animation: spinSlow 30s linear infinite; transform-origin: 50% 50%; }
  .stamp { animation: stampPop 0.6s cubic-bezier(.34,1.56,.64,1) 0.6s both; }
  @keyframes stampPop {
    from { transform: scale(0.7) rotate(0deg); opacity: 0; }
    to { transform: scale(1) rotate(-3deg); opacity: 1; }
  }

  /* Fade-in on mount */
  .fade-in { opacity: 0; transform: translateY(20px); transition: opacity .9s ease, transform .9s ease; }
  .fade-in.in { opacity: 1; transform: translateY(0); }
  .fade-in.stagger-1 { transition-delay: .15s; }

  /* Warm drop shadow */
  .shadow-warm { box-shadow: 12px 14px 0 0 rgba(19,19,16,0.08), 0 4px 16px rgba(50,30,30,0.06); }

  /* Report stack — layered + parallax */
  .report-stack { transform-style: preserve-3d; perspective: 1200px; }
  .report-card { transition: transform 0.6s cubic-bezier(.2,.8,.2,1); }
  .report-back {
    transform:
      translate(calc(var(--mx, 0) * -10px), calc(var(--my, 0) * -8px))
      rotate(-5deg) translate(20px, -32px) scale(0.93);
    opacity: 0.7;
    z-index: 1;
  }
  .report-middle {
    transform:
      translate(calc(var(--mx, 0) * -6px), calc(var(--my, 0) * -4px))
      rotate(-2.5deg) translate(8px, -16px) scale(0.97);
    opacity: 0.9;
    z-index: 2;
  }
  .report-front {
    transform:
      translate(calc(var(--mx, 0) * 6px), calc(var(--my, 0) * 4px))
      rotate(-0.8deg);
    z-index: 3;
  }

  .stamp-savings { animation: stampPop 0.7s cubic-bezier(.34,1.56,.64,1) 0.9s both; }
  .stamp-model { animation: stampPop 0.6s cubic-bezier(.34,1.56,.64,1) 1.1s both; }

  /* Featured card hover */
  .card-hover { transition: transform 0.4s cubic-bezier(.2,.8,.2,1), box-shadow 0.4s; }
  .card-hover:hover {
    transform: translateY(-6px);
    box-shadow: 12px 14px 0 0 rgba(19,19,16,0.1), 0 4px 24px rgba(50,30,30,0.08);
  }

  /* Hero headline subtle weight transition */
  .hero-headline span { transition: font-variation-settings 0.4s; }
`;
