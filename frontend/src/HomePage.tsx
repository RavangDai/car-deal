import { useState, useEffect } from "react";

export default function HomePage({ onGetStarted }: { onGetStarted: () => void }) {
  const [scrolled, setScrolled] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 60);
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { clearTimeout(t); window.removeEventListener("scroll", onScroll); };
  }, []);

  return (
    <div className="min-h-screen overflow-x-hidden" style={{
      background: "var(--bone)",
      color: "var(--ink)",
      fontFamily: "'DM Sans', sans-serif",
    }}>
      <style>{STYLES}</style>

      {/* ── NAV ─────────────────────────────────────────────────── */}
      <nav className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${scrolled ? "border-b border-[var(--rule)] bg-[var(--bone)]/92 backdrop-blur" : ""}`}>
        <div className="px-6 md:px-10 py-4 flex items-center justify-between">
          <Wordmark />
          <div className="hidden md:flex items-center gap-9 text-[13px] text-[var(--ink-soft)]">
            {[["The Method", "method"], ["Sources", "sources"], ["For Dealers", "dealers"]].map(([l, h]) => (
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
      <div className="ticker-bar mt-[68px] border-y border-[var(--rule-strong)] bg-[var(--ink)] text-[var(--bone)] py-2.5 overflow-hidden">
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
      <section className="relative px-6 md:px-10 pt-24 md:pt-32 pb-32">
        <div className="max-w-[1280px] mx-auto grid lg:grid-cols-12 gap-12 lg:gap-16">

          {/* LEFT — Editorial headline */}
          <div className={`lg:col-span-7 fade-in ${mounted ? "in" : ""}`}>
            <div className="flex items-baseline gap-3 mb-10">
              <span className="font-mono text-[11px] tracking-[0.2em] uppercase text-[var(--ink-muted)]">§ 01</span>
              <span className="h-px flex-1 max-w-[80px] bg-[var(--rule-strong)] translate-y-[-3px]" />
              <span className="font-mono text-[11px] tracking-[0.2em] uppercase text-[var(--ink-soft)]">The Question</span>
            </div>

            <h1 className="display tracking-[-0.025em] leading-[0.88] mb-12">
              <span className="block text-[clamp(3.5rem,9vw,8.5rem)]">What's it</span>
              <span className="block italic text-[clamp(3.5rem,9vw,8.5rem)] text-[var(--red)] -mt-1">actually</span>
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

            {/* Author / dateline */}
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

          {/* RIGHT — Deal Report Card */}
          <div className={`lg:col-span-5 fade-in stagger-1 ${mounted ? "in" : ""}`}>
            <DealReport />
          </div>
        </div>
      </section>

      {/* ── BIG STAT BAND ──────────────────────────────────────── */}
      <section className="border-y border-[var(--rule-strong)] bg-[var(--paper)]">
        <div className="max-w-[1280px] mx-auto px-6 md:px-10 py-12 grid grid-cols-2 md:grid-cols-4 gap-y-10 gap-x-6">
          {[
            { num: "12,400", lbl: "listings analyzed today" },
            { num: "$3,200", lbl: "average savings per deal" },
            { num: "94%", lbl: "model accuracy rate" },
            { num: "15+", lbl: "sources aggregated" },
          ].map(s => (
            <div key={s.lbl} className="flex flex-col">
              <span className="display text-[clamp(2.5rem,5vw,4rem)] leading-none tracking-tight">{s.num}</span>
              <span className="mt-3 text-[11px] font-mono uppercase tracking-[0.18em] text-[var(--ink-muted)]">{s.lbl}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── THE METHOD ─────────────────────────────────────────── */}
      <section id="method" className="px-6 md:px-10 py-32">
        <div className="max-w-[1280px] mx-auto">
          <div className="flex items-baseline gap-3 mb-16">
            <span className="font-mono text-[11px] tracking-[0.2em] uppercase text-[var(--ink-muted)]">§ 02</span>
            <span className="h-px flex-1 max-w-[80px] bg-[var(--rule-strong)] translate-y-[-3px]" />
            <span className="font-mono text-[11px] tracking-[0.2em] uppercase text-[var(--ink-soft)]">The Method</span>
          </div>

          <h2 className="display tracking-[-0.02em] leading-[0.92] mb-20 max-w-[18ch] text-[clamp(2.5rem,5.5vw,5rem)]">
            Three steps. <span className="italic text-[var(--red)]">Zero</span> guesswork.
          </h2>

          <div className="grid md:grid-cols-3 gap-px bg-[var(--rule-strong)] border-y border-[var(--rule-strong)]">
            {STEPS.map((s, i) => (
              <article key={s.title} className="bg-[var(--bone)] p-10 md:p-12 group">
                <div className="flex items-start justify-between mb-12">
                  <span className="display text-[5rem] leading-none text-[var(--red)] tracking-tighter">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--ink-muted)] mt-3">
                    Step {i + 1}/3
                  </span>
                </div>
                <h3 className="display text-[1.65rem] leading-[1.1] mb-4 tracking-tight">{s.title}</h3>
                <p className="text-[15px] text-[var(--ink-soft)] leading-[1.6]">{s.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── EDITORIAL CALLOUT ───────────────────────────────────── */}
      <section className="px-6 md:px-10 py-24 bg-[var(--ink)] text-[var(--bone)]">
        <div className="max-w-[1280px] mx-auto grid md:grid-cols-12 gap-8 items-start">
          <div className="md:col-span-2">
            <div className="display text-7xl text-[var(--red)] leading-none">"</div>
          </div>
          <blockquote className="md:col-span-9 display text-[clamp(1.6rem,3.2vw,2.6rem)] leading-[1.25] tracking-tight">
            The legacy listing sites work for dealers, not buyers. They sell <span className="italic">visibility</span>.
            We sell <span className="italic text-[var(--red-light)]">truth</span>.
          </blockquote>
          <div className="md:col-span-1" />
        </div>
      </section>

      {/* ── COMPARISON ─────────────────────────────────────────── */}
      <section className="px-6 md:px-10 py-32">
        <div className="max-w-[1280px] mx-auto">
          <div className="flex items-baseline gap-3 mb-16">
            <span className="font-mono text-[11px] tracking-[0.2em] uppercase text-[var(--ink-muted)]">§ 03</span>
            <span className="h-px flex-1 max-w-[80px] bg-[var(--rule-strong)] translate-y-[-3px]" />
            <span className="font-mono text-[11px] tracking-[0.2em] uppercase text-[var(--ink-soft)]">A Comparison</span>
          </div>

          <h2 className="display tracking-[-0.02em] leading-[0.92] mb-20 max-w-[20ch] text-[clamp(2.5rem,5vw,4.5rem)]">
            The way it's <span className="italic">always</span> worked.<br />
            <span className="text-[var(--red)]">And the way it should.</span>
          </h2>

          <div className="grid md:grid-cols-2 border border-[var(--rule-strong)]">
            <div className="p-10 md:p-14 border-b md:border-b-0 md:border-r border-[var(--rule-strong)]">
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
                  <li key={t} className="flex gap-4 items-start text-[15px] text-[var(--ink-muted)] line-through-soft">
                    <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--ink-muted)] mt-1.5 shrink-0">no</span>
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="p-10 md:p-14 bg-[var(--paper)]">
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
      <section className="px-6 md:px-10 py-36 border-t border-[var(--rule-strong)] bg-[var(--paper)] text-center relative">
        <div className="max-w-[1280px] mx-auto">
          <div className="flex items-center justify-center gap-3 mb-10">
            <span className="font-mono text-[11px] tracking-[0.2em] uppercase text-[var(--red)]">§ 04 — Coda</span>
          </div>
          <h2 className="display tracking-[-0.025em] leading-[0.88] mb-12 text-[clamp(3.5rem,8vw,8rem)]">
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
      <footer className="border-t border-[var(--rule-strong)] px-6 md:px-10 py-12">
        <div className="max-w-[1280px] mx-auto flex flex-wrap items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            <Wordmark />
            <span className="hidden md:inline font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--ink-muted)]">
              Buyer's Index · Vol. III · 2026
            </span>
          </div>
          <div className="flex items-center gap-7 text-[12px] text-[var(--ink-soft)]">
            {["Privacy", "Terms", "Press", "GitHub"].map(l => (
              <a key={l} href="#" className="link-line">{l}</a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ── DEAL REPORT — the document-style centerpiece ─────────────── */

function DealReport() {
  return (
    <article className="bg-[var(--paper)] border border-[var(--rule-strong)] p-7 md:p-9 relative">
      {/* Header */}
      <div className="flex items-start justify-between mb-1">
        <span className="font-mono text-[10px] uppercase tracking-[0.22em]">Deal Report</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--ink-muted)]">№ 0247</span>
      </div>
      <div className="border-b-2 border-[var(--ink)] mb-7" />

      {/* Vehicle */}
      <h3 className="display text-[1.7rem] leading-tight tracking-tight">2019 Honda Civic EX</h3>
      <p className="text-[13px] text-[var(--ink-muted)] mt-1 mb-7">Austin, TX · 45,210 mi · Sedan · Automatic</p>

      <div className="border-t border-dashed border-[var(--rule-strong)]/40 mb-6" />

      {/* Data table */}
      <dl className="space-y-3.5 font-mono text-[13px]">
        <Row label="Listed price" value="$12,400" />
        <Row label="Fair value" value="$15,600" />
        <Row label="Differential" value="−$3,200 (20.5%)" accent />
        <Row label="Comparables (90d)" value="127" />
        <Row label="Source" value="Classifieds" />
        <Row label="Days listed" value="8" />
      </dl>

      <div className="border-t border-dashed border-[var(--rule-strong)]/40 my-7" />

      {/* Verdict block */}
      <div className="flex items-center justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--ink-muted)] mb-1">Verdict</p>
          <p className="display text-[2.6rem] leading-none tracking-tight">
            87<span className="text-[var(--ink-muted)] text-[1.4rem]">/100</span>
          </p>
        </div>
        <div className="border-2 border-[var(--red)] px-4 py-2 -rotate-3">
          <p className="font-mono text-[12px] uppercase tracking-[0.2em] text-[var(--red)] font-bold">Great Deal</p>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-dashed border-[var(--rule-strong)]/40 mt-7 pt-4 flex items-center justify-between">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--ink-muted)]">
          Revveal Model v3.2
        </p>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--ink-muted)]">
          Generated 2m ago
        </p>
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
  .display.italic { font-style: italic; }

  /* Buttons */
  .btn-primary {
    background: var(--ink);
    color: var(--bone);
    padding: 10px 18px;
    font-size: 13px;
    font-weight: 500;
    border-radius: 999px;
    transition: background 0.15s ease, transform 0.15s ease;
  }
  .btn-primary:hover { background: var(--red); }

  .btn-primary-lg {
    display: inline-flex;
    align-items: center;
    gap: 14px;
    background: var(--ink);
    color: var(--bone);
    padding: 16px 28px;
    font-size: 15px;
    font-weight: 500;
    border-radius: 999px;
    transition: background 0.2s ease, gap 0.2s ease;
  }
  .btn-primary-lg:hover { background: var(--red); gap: 18px; }

  .btn-primary-xl {
    display: inline-flex;
    align-items: center;
    gap: 16px;
    background: var(--ink);
    color: var(--bone);
    padding: 22px 40px;
    font-size: 18px;
    font-weight: 500;
    border-radius: 999px;
    transition: background 0.2s ease, gap 0.2s ease;
  }
  .btn-primary-xl:hover { background: var(--red); gap: 22px; }

  /* Underline animation for links */
  .link-line {
    position: relative;
    transition: color 0.15s;
  }
  .link-line:hover { color: var(--ink); }
  .link-line::after {
    content: "";
    position: absolute;
    left: 0; right: 0; bottom: -3px;
    height: 1px;
    background: currentColor;
    transform: scaleX(0);
    transform-origin: left;
    transition: transform 0.3s cubic-bezier(.2,.8,.2,1);
  }
  .link-line:hover::after { transform: scaleX(1); }

  /* Live ticker */
  .ticker-track {
    animation: tickerScroll 50s linear infinite;
    will-change: transform;
  }
  .ticker-bar:hover .ticker-track { animation-play-state: paused; }
  @keyframes tickerScroll {
    from { transform: translateX(0); }
    to   { transform: translateX(-50%); }
  }

  /* Live dot pulse */
  .live-dot {
    animation: livePulse 1.4s ease-in-out infinite;
    box-shadow: 0 0 0 0 rgba(196, 30, 58, 0.7);
  }
  @keyframes livePulse {
    0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(196,30,58,0.6); }
    50% { opacity: 0.5; box-shadow: 0 0 0 6px rgba(196,30,58,0); }
  }

  /* Fade-in on mount */
  .fade-in { opacity: 0; transform: translateY(20px); transition: opacity .9s ease, transform .9s ease; }
  .fade-in.in { opacity: 1; transform: translateY(0); }
  .fade-in.stagger-1 { transition-delay: .15s; }

  .line-through-soft { position: relative; }
`;
