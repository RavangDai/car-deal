import { useEffect } from "react";
import { motion, useReducedMotion, type Variants } from "framer-motion";

const EASE_OUT_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1];

const heroContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.18 } },
};

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 26 },
  show: { opacity: 1, y: 0, transition: { duration: 0.9, ease: EASE_OUT_EXPO } },
};

const fadeUpSmall: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE_OUT_EXPO } },
};

const badgeIn: Variants = {
  hidden: { opacity: 0, y: 12, scale: 0.94 },
  show: (i: number) => ({
    opacity: 1, y: 0, scale: 1,
    transition: { duration: 0.7, ease: EASE_OUT_EXPO, delay: 1.0 + i * 0.12 },
  }),
};

export default function HomePage({ onGetStarted }: { onGetStarted: () => void }) {
  const prefersReduced = useReducedMotion();

  useEffect(() => {
    const onScroll = () => {
      const nav = document.querySelector(".rv-nav");
      if (!nav) return;
      if (window.scrollY > 16) {
        nav.classList.add("rv-nav-scrolled");
        nav.classList.remove("rv-nav-dark");
      } else {
        nav.classList.remove("rv-nav-scrolled");
        nav.classList.add("rv-nav-dark");
      }
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-screen overflow-x-hidden relative bg-[var(--paper)] text-[var(--ink)]">
      <style>{STYLES}</style>

      {/* ── NAV ───────────────────────────────────────────────── */}
      <nav className="rv-nav rv-nav-dark fixed top-0 inset-x-0 z-50">
        <div className="max-w-[1320px] mx-auto px-6 md:px-10 h-[72px] flex items-center justify-between">
          <Wordmark />
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

      {/* ── HERO ──────────────────────────────────────────────── */}
      <section className="rv-hero">
        {/* Full-bleed showroom backdrop */}
        <div
          className="rv-hero-bg"
          style={{ backgroundImage: "url('/assets/bg-showroom.png')" }}
          aria-hidden
        />
        {/* Left dark gradient for text legibility */}
        <div className="rv-hero-mask" aria-hidden />
        {/* Bottom vignette */}
        <div className="rv-hero-vignette" aria-hidden />

        {/* ── AMBIENT EFFECTS — disabled when prefers-reduced-motion ── */}
        {!prefersReduced && (
          <>
            {/* Soft headlight pulse over the front of the car */}
            <div className="rv-headlight" aria-hidden />

            {/* AI scan beam sweeping across the car */}
            <motion.div
              className="rv-scan-beam"
              aria-hidden
              initial={{ opacity: 0, x: "-12%" }}
              animate={{
                opacity: [0, 0.55, 0.55, 0],
                x: ["-12%", "-12%", "112%", "112%"],
              }}
              transition={{
                duration: 5.2,
                times: [0, 0.06, 0.9, 1],
                ease: "easeInOut",
                repeat: Infinity,
                repeatDelay: 4.5,
                delay: 2.0,
              }}
            />

            {/* Floor shimmer line */}
            <div className="rv-floor-shimmer" aria-hidden />
          </>
        )}

        {/* ── CONTENT ── */}
        <motion.div
          className="rv-hero-content"
          variants={heroContainer}
          initial="hidden"
          animate="show"
        >
          <div className="max-w-[1320px] mx-auto px-6 md:px-10 w-full grid lg:grid-cols-12 gap-10 items-center relative">

            <div className="lg:col-span-7 text-center lg:text-left">
              <motion.div variants={fadeUpSmall} className="inline-flex">
                <AIPill onDark />
              </motion.div>

              <h1 className="display rv-headline tracking-[-0.025em] leading-[1.02] mt-7 mb-6 text-[clamp(2.3rem,5.4vw,4.4rem)] text-white max-w-[18ch] mx-auto lg:mx-0">
                <motion.span className="block" variants={fadeUp}>Reveal the Best</motion.span>
                <motion.span className="block" variants={fadeUp}>Car Deals Before</motion.span>
                <motion.span className="block text-[#7da8ff]" variants={fadeUp}>Everyone Else.</motion.span>
              </h1>

              <motion.p
                className="text-[16px] md:text-[17px] leading-[1.6] text-white/70 max-w-[54ch] mx-auto lg:mx-0 mb-9"
                variants={fadeUpSmall}
              >
                Revveal scans listings, price history, mileage, title signals, and market value — so you can spot hidden deals faster.
              </motion.p>

              <motion.div
                className="flex flex-wrap justify-center lg:justify-start items-center gap-3.5"
                variants={fadeUpSmall}
              >
                <button onClick={onGetStarted} className="rv-btn rv-btn-primary rv-btn-lg">
                  <span>Start Finding Deals</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
                </button>
                <a href="#how" className="rv-btn rv-btn-outline rv-btn-lg">
                  <svg width="11" height="13" viewBox="0 0 9 11" fill="currentColor" className="opacity-90"><path d="M0 0v11l9-5.5z"/></svg>
                  <span>See How It Works</span>
                </a>
              </motion.div>
            </div>

            {/* Floating deal badges — positioned around the car (desktop only) */}
            <div className="hidden lg:block lg:col-span-5">
              <div className="relative w-full h-[min(60vh,520px)]">
                {DEAL_BADGES.map((b, i) => (
                  <DealBadge key={b.label} badge={b} index={i} reduce={!!prefersReduced} />
                ))}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Bottom thin trust line */}
        <motion.div
          className="rv-hero-trust"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: EASE_OUT_EXPO, delay: 1.4 }}
        >
          <div className="max-w-[1320px] mx-auto px-6 md:px-10 flex flex-wrap items-center gap-x-7 gap-y-2 text-[12.5px]">
            <span className="flex items-center gap-2 text-white/75">
              <span className="rv-live-dot rv-live-dot-bright" />
              <span className="font-mono text-[10.5px] tracking-[0.2em] uppercase font-medium">Live</span>
              <span className="text-white/40">·</span>
              <span>12,400 listings indexed today</span>
            </span>
            <span className="hidden md:flex items-center gap-2 text-white/55 font-mono text-[10.5px] tracking-[0.18em] uppercase">
              <span className="w-1 h-1 rounded-full bg-white/35" />
              <span>Trusted by 8,500+ buyers</span>
            </span>
          </div>
        </motion.div>

        {/* Smooth fade to next section */}
        <div className="rv-hero-fade" aria-hidden />
      </section>

      {/* ── FEATURE GRID ─────────────────────────────────────── */}
      <section className="relative z-10 px-6 md:px-10 py-24">
        <div className="max-w-[1280px] mx-auto grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
          {FEATURES.map((f) => (
            <FeatureChip key={f.title} feature={f} />
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────── */}
      <section id="how" className="relative z-10 px-6 md:px-10 py-28 md:py-36 bg-[var(--paper-warm)] border-y border-[var(--rule)]">
        <div className="max-w-[1280px] mx-auto">
          <SectionLabel kicker="How It Works" tag="03 steps · zero guesswork" />
          <h2 className="display tracking-[-0.025em] leading-[0.98] text-[clamp(2.2rem,4.8vw,4rem)] max-w-[18ch] mt-6 mb-16">
            From listing to deal in <span className="rv-accent-text italic">three quiet steps</span>.
          </h2>

          <div className="grid md:grid-cols-3 gap-5">
            {STEPS.map((s, i) => (
              <article key={s.title} className="rv-step">
                <div className="rv-step-num">{String(i + 1).padStart(2, "0")}</div>
                <div className="rv-step-icon">{s.icon}</div>
                <h3 className="display text-[1.4rem] leading-tight tracking-[-0.015em] mb-3 mt-6">{s.title}</h3>
                <p className="text-[15px] leading-[1.6] text-[var(--ink-soft)]">{s.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURED DEALS ───────────────────────────────────── */}
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

      {/* ── COMPARISON ───────────────────────────────────────── */}
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

      {/* ── CTA ──────────────────────────────────────────────── */}
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
            <button onClick={onGetStarted} className="rv-btn rv-btn-primary rv-btn-xl">
              <span>Find My Next Deal</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
            </button>
            <a href="#how" className="rv-btn rv-btn-ghost rv-btn-xl">See how it works</a>
          </div>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────── */}
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

function Wordmark() {
  return (
    <a href="#" className="flex items-center gap-2.5">
      <img
        src="/assets/revveal-icon.png"
        alt=""
        aria-hidden
        className="w-8 h-8 rounded-[8px]"
      />
      <span className="display text-[1.45rem] leading-none tracking-[-0.02em] font-semibold">
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

function DealBadge({
  badge,
  index,
  reduce,
}: {
  badge: typeof DEAL_BADGES[0];
  index: number;
  reduce: boolean;
}) {
  return (
    <motion.div
      className="rv-deal-badge"
      style={{ top: badge.top, left: badge.left, right: badge.right }}
      custom={index}
      variants={badgeIn}
      initial="hidden"
      animate={reduce
        ? "show"
        : {
            opacity: 1, y: [0, -4, 0],
            transition: {
              opacity: { duration: 0.7, ease: EASE_OUT_EXPO, delay: 1.0 + index * 0.12 },
              y: { duration: 6 + (index % 3), repeat: Infinity, ease: "easeInOut", delay: 1.6 + index * 0.2 },
            },
          }
      }
    >
      <span
        className="rv-deal-badge-dot"
        style={{ background: badge.color }}
      />
      <span className="rv-deal-badge-icon" style={{ color: badge.color }}>
        {badge.icon}
      </span>
      <span className="rv-deal-badge-label">{badge.label}</span>
    </motion.div>
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

/* ── FEATURE CHIPS ───────────────────────────────────────────── */

function FeatureChip({ feature }: { feature: typeof FEATURES[0] }) {
  return (
    <div className="rv-feature">
      <div className="rv-feature-icon">{feature.icon}</div>
      <h3 className="font-semibold text-[15px] tracking-[-0.005em] mt-5 mb-1.5">{feature.title}</h3>
      <p className="text-[13.5px] leading-[1.55] text-[var(--ink-muted)]">{feature.body}</p>
    </div>
  );
}

/* ── FEATURED DEAL CARDS ─────────────────────────────────────── */

function FeaturedDealCard({ deal, idx }: { deal: typeof FEATURED[0]; idx: number }) {
  return (
    <a href="#" className="rv-listing">
      <div className="rv-listing-img" style={{ background: deal.tone }}>
        <svg viewBox="0 0 240 100" className="absolute inset-0 w-full h-full p-7">
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

const DEAL_BADGES = [
  {
    label: "AI Verified",
    color: "#7da8ff",
    top: "6%", left: "30%", right: undefined as string | undefined,
    icon: (
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2L4 6v6c0 4.5 3.2 8.5 8 10 4.8-1.5 8-5.5 8-10V6l-8-4z" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    ),
  },
  {
    label: "Great Deal",
    color: "#7dffb1",
    top: "12%", left: undefined, right: "2%",
    icon: (
      <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
        <path d="M2 6.5 L5 9 L10 3" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    label: "Clean Title",
    color: "#7da8ff",
    top: "36%", left: "2%", right: undefined,
    icon: (
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <path d="M14 2v6h6" /><path d="M9 13h6" /><path d="M9 17h4" />
      </svg>
    ),
  },
  {
    label: "Low Mileage",
    color: "#ffd27d",
    top: "56%", left: undefined, right: "-4%",
    icon: (
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22a10 10 0 100-20 10 10 0 000 20z" />
        <path d="M12 6v6l4 2" />
      </svg>
    ),
  },
  {
    label: "Price Drop",
    color: "#ff9a7d",
    top: "82%", left: "44%", right: undefined,
    icon: (
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 7l10 10" />
        <path d="M17 7v10H7" />
      </svg>
    ),
  },
];

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

  /* Elements driven by anime.js start invisible */
  [data-anim] { opacity: 0; will-change: opacity, transform; }

  /* Nav — theme adapts to scroll position */
  .rv-nav { transition: background 0.35s ease, border-color 0.35s ease, box-shadow 0.35s ease; background: transparent; }
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
  }
  .rv-nav .display { transition: color 0.35s ease; }
  .rv-nav-dark .display { color: white; }
  .rv-nav-scrolled .display { color: var(--ink); }

  .rv-nav-link { position: relative; transition: color 0.2s; }
  .rv-nav-dark .rv-nav-link { color: rgba(255,255,255,0.78); }
  .rv-nav-dark .rv-nav-link:hover { color: white; }
  .rv-nav-scrolled .rv-nav-link { color: var(--ink-soft); }
  .rv-nav-scrolled .rv-nav-link:hover { color: var(--ink); }

  .rv-nav-login { transition: color 0.2s; }
  .rv-nav-dark .rv-nav-login { color: rgba(255,255,255,0.85); }
  .rv-nav-dark .rv-nav-login:hover { color: white; }
  .rv-nav-scrolled .rv-nav-login { color: var(--ink-soft); }
  .rv-nav-scrolled .rv-nav-login:hover { color: var(--ink); }

  /* Buttons — color transitions only, no lift/shadow growth */
  .rv-btn {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 10px 18px; border-radius: 999px;
    font-weight: 500; line-height: 1;
    transition: background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease;
    white-space: nowrap;
  }
  .rv-btn-lg { padding: 14px 24px; gap: 10px; font-size: 15px; }
  .rv-btn-xl { padding: 18px 32px; gap: 12px; font-size: 16px; }

  .rv-btn-primary {
    background: var(--blue); color: white;
    box-shadow: 0 4px 14px rgba(31,95,255,0.28), inset 0 1px 0 rgba(255,255,255,0.18);
  }
  .rv-btn-primary:hover { background: var(--blue-deep); }

  .rv-btn-ghost {
    background: white; color: var(--ink);
    border: 1px solid var(--rule-strong);
  }
  .rv-btn-ghost:hover { border-color: var(--ink); }

  .rv-btn-glass {
    background: rgba(255,255,255,0.08);
    color: white;
    border: 1px solid rgba(255,255,255,0.18);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
  }
  .rv-btn-glass:hover { background: rgba(255,255,255,0.14); border-color: rgba(255,255,255,0.30); }

  .rv-link { color: var(--ink-soft); transition: color 0.2s; }
  .rv-link:hover { color: var(--ink); }

  .rv-play {
    display: inline-flex; align-items: center; justify-content: center;
    width: 22px; height: 22px; border-radius: 50%;
    background: var(--blue-tint); color: var(--blue);
    margin-left: -4px;
  }
  .rv-play-dark { background: rgba(255,255,255,0.18); color: white; box-shadow: 0 0 0 1px rgba(255,255,255,0.12); }

  .rv-sparkle {
    display: inline-flex; align-items: center; justify-content: center;
    width: 18px; height: 18px; border-radius: 50%;
    background: white; color: var(--blue);
    box-shadow: 0 2px 6px rgba(31,95,255,0.22);
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
  .rv-tag-green { background: var(--green-soft); color: #0f7a3a; padding: 5px 9px 5px 8px; }
  .rv-tag-muted { background: #f1f3f8; color: var(--ink-muted); }
  .rv-tag-white { background: rgba(255,255,255,0.92); color: var(--ink); backdrop-filter: blur(4px); }
  .rv-tag-ink { background: var(--ink); color: white; }

  /* Live dots — functional status indicator, subtle pulse */
  .rv-live-dot {
    width: 7px; height: 7px; border-radius: 50%;
    background: var(--blue);
    box-shadow: 0 0 0 0 rgba(31,95,255,0);
    animation: liveBeat 2.4s ease-in-out infinite;
    display: inline-block;
  }
  .rv-live-dot-bright {
    background: #7dffb1;
    animation: liveBeatBright 2.4s ease-in-out infinite;
  }
  @keyframes liveBeat {
    0%, 100% { box-shadow: 0 0 0 0 rgba(31,95,255,0.45); }
    50%      { box-shadow: 0 0 0 5px rgba(31,95,255,0); }
  }
  @keyframes liveBeatBright {
    0%, 100% { box-shadow: 0 0 0 0 rgba(125,255,177,0.45); }
    50%      { box-shadow: 0 0 0 5px rgba(125,255,177,0); }
  }

  /* Hero accent — one-shot underline draw on mount */
  .rv-accent-bright { position: relative; display: inline-block; color: #7da8ff; }
  .rv-accent-text { color: var(--blue); }
  .rv-accent-underline {
    position: absolute; left: 2%; right: 0; bottom: -0.04em;
    width: 96%; height: 0.18em; color: currentColor;
    stroke-dasharray: 600;
    stroke-dashoffset: 600;
    animation: drawLine 1.6s cubic-bezier(0.16, 1, 0.3, 1) 1.0s forwards;
    opacity: 0.7;
  }
  @keyframes drawLine { to { stroke-dashoffset: 0; } }

  /* ── CINEMATIC HERO — dark luxury showroom ──────────────── */

  .rv-hero {
    position: relative;
    min-height: 100vh;
    overflow: hidden;
    background: #04060d;
    color: white;
    isolation: isolate;
  }

  /* Full-bleed showroom backdrop */
  .rv-hero-bg {
    position: absolute; inset: 0;
    background-size: cover;
    background-position: 65% center;
    background-repeat: no-repeat;
    z-index: 0;
    filter: saturate(1.05) contrast(1.04) brightness(0.96);
  }

  /* Heavy left gradient for text legibility */
  .rv-hero-mask {
    position: absolute; inset: 0;
    background:
      linear-gradient(90deg,
        rgba(4,6,13,0.96) 0%,
        rgba(4,6,13,0.92) 18%,
        rgba(4,6,13,0.62) 38%,
        rgba(4,6,13,0.28) 55%,
        rgba(4,6,13,0.08) 70%,
        transparent 85%);
    z-index: 1;
    pointer-events: none;
  }

  .rv-hero-vignette {
    position: absolute; inset: 0;
    background:
      linear-gradient(180deg, rgba(4,6,13,0.45) 0%, transparent 18%, transparent 64%, rgba(4,6,13,0.85) 100%);
    z-index: 2;
    pointer-events: none;
  }

  /* Headlight soft pulse — over the front-left of the car */
  .rv-headlight {
    position: absolute;
    top: 42%; left: 52%;
    width: 380px; height: 380px;
    transform: translate(-50%, -50%);
    background: radial-gradient(circle, rgba(180,215,255,0.30) 0%, rgba(120,170,255,0.10) 35%, transparent 65%);
    filter: blur(4px);
    mix-blend-mode: screen;
    z-index: 3;
    pointer-events: none;
    animation: rv-headlight 5.5s ease-in-out infinite;
  }
  @keyframes rv-headlight {
    0%, 100% { opacity: 0.45; transform: translate(-50%, -50%) scale(1); }
    50%      { opacity: 0.85; transform: translate(-50%, -50%) scale(1.06); }
  }

  /* AI scan beam — thin vertical bar that sweeps across the car */
  .rv-scan-beam {
    position: absolute;
    top: 12%; bottom: 18%;
    left: 35%;
    width: 28%;
    background:
      linear-gradient(90deg,
        transparent 0%,
        rgba(140,200,255,0) 15%,
        rgba(180,220,255,0.45) 48%,
        rgba(140,200,255,0.85) 50%,
        rgba(180,220,255,0.45) 52%,
        rgba(140,200,255,0) 85%,
        transparent 100%);
    filter: blur(6px);
    mix-blend-mode: screen;
    z-index: 4;
    pointer-events: none;
    will-change: transform, opacity;
  }

  /* Floor shimmer — horizontal line of light traveling along the floor edge */
  .rv-floor-shimmer {
    position: absolute;
    bottom: 16%;
    left: 38%; right: 4%;
    height: 1px;
    background-image:
      linear-gradient(90deg, transparent 0%, rgba(140,200,255,0.85) 50%, transparent 100%);
    background-size: 40% 100%;
    background-repeat: no-repeat;
    background-position: -40% 0;
    box-shadow: 0 0 18px rgba(140,200,255,0.45);
    z-index: 3;
    pointer-events: none;
    opacity: 0.7;
    animation: rv-shimmer 7s linear infinite;
  }
  @keyframes rv-shimmer {
    0%   { background-position: -40% 0; opacity: 0; }
    10%  { opacity: 0.7; }
    90%  { opacity: 0.7; }
    100% { background-position: 140% 0; opacity: 0; }
  }

  .rv-hero-content {
    position: relative;
    z-index: 5;
    min-height: 100vh;
    padding-top: 120px;
    padding-bottom: 140px;
    display: flex;
    align-items: center;
  }

  .rv-hero-trust {
    position: absolute;
    bottom: 28px;
    left: 0; right: 0;
    z-index: 6;
    pointer-events: none;
  }
  .rv-hero-trust > div { pointer-events: auto; }

  .rv-hero-fade {
    position: absolute;
    bottom: 0; left: 0; right: 0;
    height: 140px;
    background: linear-gradient(180deg, transparent 0%, rgba(247,249,252,0.55) 60%, var(--paper) 100%);
    z-index: 7;
    pointer-events: none;
  }

  /* ── FLOATING DEAL BADGES — solid dark, thin border, no glass ── */
  .rv-deal-badge {
    position: absolute;
    display: inline-flex; align-items: center; gap: 8px;
    padding: 8px 13px 8px 11px;
    border-radius: 999px;
    background: rgba(8, 14, 28, 0.92);
    border: 1px solid rgba(125, 170, 255, 0.18);
    box-shadow:
      0 12px 28px -8px rgba(0,0,0,0.55),
      0 0 0 1px rgba(125,170,255,0.06) inset;
    font-size: 12.5px;
    font-weight: 500;
    color: rgba(255,255,255,0.92);
    white-space: nowrap;
    will-change: transform, opacity;
  }
  .rv-deal-badge-dot {
    width: 6px; height: 6px;
    border-radius: 50%;
    box-shadow: 0 0 8px currentColor;
  }
  .rv-deal-badge-icon {
    display: inline-flex; align-items: center; justify-content: center;
  }
  .rv-deal-badge-label {
    font-family: 'Geist', sans-serif;
    letter-spacing: 0.005em;
  }

  /* Outline button — dark luxury, no glass */
  .rv-btn-outline {
    background: transparent;
    color: white;
    border: 1px solid rgba(255,255,255,0.22);
  }
  .rv-btn-outline:hover {
    border-color: rgba(255,255,255,0.55);
    background: rgba(255,255,255,0.04);
  }

  /* ── FEATURE CHIPS ──────────────────────────────────────── */

  .rv-feature {
    background: white;
    border: 1px solid var(--rule);
    border-radius: 16px;
    padding: 22px 22px 24px;
    transition: border-color 0.2s ease;
  }
  .rv-feature:hover { border-color: var(--rule-strong); }
  .rv-feature-icon {
    width: 38px; height: 38px;
    border-radius: 10px;
    background: var(--blue-tint);
    color: var(--blue);
    display: flex; align-items: center; justify-content: center;
  }

  /* ── STEPS ──────────────────────────────────────────────── */

  .rv-step {
    position: relative;
    background: white;
    border: 1px solid var(--rule);
    border-radius: 18px;
    padding: 28px 28px 30px;
    overflow: hidden;
    transition: border-color 0.2s ease;
  }
  .rv-step:hover { border-color: var(--rule-strong); }
  .rv-step-num {
    position: absolute;
    top: 14px; right: 18px;
    font-family: 'Bricolage Grotesque', serif;
    font-variation-settings: "wdth" 100, "opsz" 96;
    font-size: 5.5rem; line-height: 0.9;
    color: var(--paper-cool);
    font-weight: 700;
    user-select: none;
  }
  .rv-step-icon {
    position: relative;
    width: 46px; height: 46px;
    border-radius: 12px;
    background: var(--blue);
    color: white;
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 6px 14px rgba(31,95,255,0.24);
  }

  /* ── LISTING CARDS ──────────────────────────────────────── */

  .rv-listing {
    display: block;
    background: white;
    border: 1px solid var(--rule);
    border-radius: 18px;
    overflow: hidden;
    transition: border-color 0.2s ease;
  }
  .rv-listing:hover { border-color: var(--rule-strong); }
  .rv-listing-img { aspect-ratio: 4/3; position: relative; overflow: hidden; }

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
  }

  .shadow-soft { box-shadow: 0 10px 40px -10px rgba(10,21,48,0.10), 0 4px 14px rgba(10,21,48,0.04); }

  .rv-cta-glow {
    position: absolute; inset: 0;
    background:
      radial-gradient(ellipse 60% 50% at 50% 100%, rgba(31,95,255,0.16) 0%, transparent 70%),
      radial-gradient(ellipse 80% 40% at 50% 0%, rgba(31,95,255,0.06) 0%, transparent 60%);
    pointer-events: none;
  }

  /* Responsive */
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
      transform: translate(calc(var(--px, 0) * -6px), 0);
      opacity: 0.9;
    }
    .rv-showroom-dial { top: auto; bottom: 0; right: -10%; width: 560px; height: 560px; transform: none; }
    .rv-hero-right { min-height: 240px; margin-top: 28px; }
    [data-anim="deal-card"] { position: relative; top: auto; right: auto; }
    .rv-deal-card { position: relative; top: auto; right: auto; width: 100%; max-width: 360px; margin-left: auto; }
    [data-anim="score-badge"] { right: 4%; bottom: -8px; }
    .rv-score-badge { width: 84px; height: 84px; }
    [data-anim="plate-chip"] { bottom: -36px; right: auto; left: 0; }
  }
  @media (max-width: 640px) {
    .rv-hero-car { min-width: 460px; bottom: 18%; opacity: 0.75; }
    .rv-deal-card { padding: 14px 16px; }
    .rv-score-badge { width: 76px; height: 76px; }
    [data-anim="score-badge"] { right: 2%; }
    .rv-hero-trust { bottom: 18px; }
  }

  /* Reduced motion fallback */
  @media (prefers-reduced-motion: reduce) {
    [data-anim] { opacity: 1 !important; }
    .rv-live-dot, .rv-live-dot-bright { animation: none; }
    .rv-accent-underline { animation: none; stroke-dashoffset: 0; }
  }
`;
